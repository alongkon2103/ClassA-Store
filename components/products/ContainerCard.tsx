"use client"

import { useLocale } from "next-intl"
import { motion } from "framer-motion"
import ProductCard from "./ProductCard"
import { useAutoDiscounts } from "@/lib/useAutoDiscounts"

type ProductVariant = {
  id: string
  label_th: string
  label_en: string
  price: number
  is_active: boolean
  variant_type?: string
  discounted_price?: number | null
}

type ProductItem = {
  slug: string
  id: string
  name_th: string
  name_en: string
  price: number
  product_images?: { url: string }[]
  preview_video_url?: string | null
  isLower?: boolean
  is_featured?: boolean
  is_partner?: boolean
  partner_name?: string
  product_variants?: ProductVariant[]
}

// Callers pass a narrow product shape ({ slug, name_th, name_en }); the richer
// per-item fields are read via ProductItem below.
type NarrowProduct = { slug: string; name_th: string; name_en: string }

export default function ContainerCard({ products, onSelect }: {
  products: NarrowProduct[]
  onSelect: (item: NarrowProduct) => void
}) {
    const locale = useLocale()
    // Personalised strikethrough prices — one fetch for the whole grid.
    const { bestDiscountedPrice } = useAutoDiscounts()

    const container = {
        hidden: { opacity: 0 },
        show: {
            opacity: 1,
            transition: {
                staggerChildren: 0.05
            }
        }
    }

    const itemAnim = {
        hidden: { opacity: 0, y: 15 },
        show: { opacity: 1, y: 0 }
    }

    return (
        <div className="px-6 sm:px-10 py-8 pb-20">
            <motion.div 
                variants={container}
                initial="hidden"
                animate="show"
                className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4"
            >
                {(products as ProductItem[]).map((item) => (
                    <motion.div key={item.id} variants={itemAnim}>
                        <ProductCard
                            name={locale === "th" ? item.name_th : item.name_en}
                            price={item.price}
                            image={item.product_images?.[0]?.url}
                            previewVideo={item.preview_video_url}
                            is_low={item.isLower ?? false}
                            onClick={() => onSelect(item)}
                            is_featured={item.is_featured ?? false}
                            is_partner={item.is_partner ?? false}
                            partner_name={item.partner_name}
                            // Partner variants already carry their fixed final price;
                            // only OUR products get the per-shopper auto-discount.
                            product_variants={item.product_variants?.map((v) => ({
                                ...v,
                                discounted_price: item.is_partner
                                    ? v.discounted_price
                                    : bestDiscountedPrice(item.id, Number(v.price)),
                            }))}
                        />
                    </motion.div>
                ))}
            </motion.div>
        </div>
    )
}
