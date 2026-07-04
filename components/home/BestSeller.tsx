"use client"

import { motion } from "framer-motion"
import Link from "next/link"
import ProductCard from "./ProductCard"
import { useTranslations, useLocale } from "next-intl"


type Variant = {
  id: string
  label_th: string
  label_en: string
  price: number
  stock: number
}

export type Product = {
  id: string
  name_th: string
  name_en: string
  price: number
  preview_video_url?: string | null
  isLower?: boolean | null
  is_featured?: boolean | null
  product_images?: { url: string }[]
  product_variants: Variant[]
}

type Props = {
  products: Product[]
  onSelect?: (product: Product) => void
}

export default function BestSeller({ products, onSelect }: Props) {
  const t = useTranslations("Home")
  const locale = useLocale()

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  }

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
  }

  return (
    <section className="bg-bg-surface px-6 sm:px-10 py-20">
      <div className="max-w-5xl mx-auto">
        <motion.p
          initial={{ opacity: 0, x: -10 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          className="text-[11px] tracking-widest text-accent-light uppercase font-medium mb-2"
        >
          {t("top_sellers")}
        </motion.p>

        <motion.h2
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="font-display font-bold text-text-base mb-1"
          style={{ fontSize: "clamp(26px, 4vw, 38px)" }}
        >
          {t("best_selling_keys")}
        </motion.h2>

        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 }}
          className="text-text-muted text-[13px] mb-8"
        >
          {t("updated_daily")}
        </motion.p>

        <motion.div
          variants={container}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 gap-3"
        >
          {products.length > 0 ? (
            products.map((product) => (
              <motion.div key={product.id} variants={item}>
                <ProductCard
                  name={locale === "th" ? product.name_th : product.name_en}
                  price={Number(product.price)}
                  image={product.product_images?.[0]?.url || "/placeholder.png"}
                  previewVideo={product.preview_video_url}
                  is_low={product.isLower ?? false}
                  badge={product.is_featured ? "Hot" : undefined}
                  product_variants={product.product_variants.map((v) => ({
                    ...v,
                    label: locale === "th" ? v.label_th : v.label_en
                  }))}
                  onClick={() => onSelect?.(product)}
                />
              </motion.div>
            ))
          ) : (
            <div className="col-span-full text-center py-10 text-text-muted text-sm">
              {t("no_featured")}
            </div>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.5 }}
          className="flex justify-center mt-7"
        >
          <Link
            href="/products"
            className="border border-accent/20 hover:border-accent-light text-text-muted hover:text-text-base text-[13px] px-6 py-2.5 rounded-lg transition-colors"
          >
            {t("view_all")}
          </Link>
        </motion.div>
      </div>
    </section>
  )
}
