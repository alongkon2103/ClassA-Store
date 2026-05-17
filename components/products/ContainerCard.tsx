"use client"

import { useLocale } from "next-intl"
import { motion } from "framer-motion"
import ProductCard from "./ProductCard"

export default function ContainerCard({ products, onSelect }: any) {
    const locale = useLocale()

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
                {products.map((item: any) => (
                    <motion.div key={item.id} variants={itemAnim}>
                        <ProductCard
                            name={locale === "th" ? item.name_th : item.name_en}
                            price={item.price}
                            image={item.product_images?.[0]?.url}
                            is_low={item.isLower ?? false}
                            onClick={() => onSelect(item)}
                            is_featured={item.is_featured ?? false}
                            product_variants={item.product_variants}
                        />
                    </motion.div>
                ))}
            </motion.div>
        </div>
    )
}
