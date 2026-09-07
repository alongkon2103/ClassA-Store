"use client"

import { motion } from "framer-motion"
import { Link } from "@/i18n/routing"
import GameCard from "@/components/GameCard"
import { useTranslations, useLocale } from "next-intl"
import { useAutoDiscounts } from "@/lib/useAutoDiscounts"

type Variant = {
  id: string
  label_th: string
  label_en: string
  price: number
  stock: number
  duration_type?: string | null
}

export type Product = {
  id: string
  slug: string
  name_th: string
  name_en: string
  description_th?: string | null
  description_en?: string | null
  type?: string | null
  price: number
  preview_video_url?: string | null
  isLower?: boolean | null
  is_featured?: boolean | null
  product_images?: { url: string }[]
  product_variants: Variant[]
  rating_avg?: number | null
  rating_count?: number | null
}

type Props = {
  products: Product[]
  onSelect?: (product: Product) => void
  usdRate?: number | null
}

/** ตัดแท็ก HTML ออกจาก description ให้เหลือข้อความล้วนสำหรับย่อ 2 บรรทัดบนการ์ด */
function plain(html: string | null | undefined, max = 90) {
  if (!html) return ""
  const t = html.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim()
  return t.length > max ? `${t.slice(0, max).trimEnd()}…` : t
}

export default function BestSeller({ products, onSelect, usdRate }: Props) {
  const t = useTranslations("Home")
  const locale = useLocale()
  const isTH = locale === "th"
  const { bestDiscountedPrice } = useAutoDiscounts()

  return (
    <section className="page-container mb-12">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-[1.25rem] font-extrabold">{t("best_selling_keys")}</h2>
        <Link href="/products" className="group text-accent-light text-[0.85rem] font-semibold inline-flex items-center gap-1.5 hover:gap-2.5 transition-all">
          {t("view_all")}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
          </svg>
        </Link>
      </div>

      <motion.div
        initial="hidden"
        whileInView="show"
        viewport={{ once: true }}
        variants={{ hidden: {}, show: { transition: { staggerChildren: 0.05 } } }}
        className="grid grid-cols-1 min-[480px]:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4"
      >
        {products.length > 0 ? (
          products.map((p) => {
            // ราคาที่โชว์ = variant ถูกสุด ถ้ามีโค้ดลดอัตโนมัติก็โชว์ราคาเดิมขีดฆ่าไว้
            const cheapest = p.product_variants.length
              ? p.product_variants.reduce((a, b) => (a.price <= b.price ? a : b))
              : null
            const base = cheapest ? Number(cheapest.price) : Number(p.price)
            const deal = cheapest ? bestDiscountedPrice(p.id, base) : null
            const hasDeal = deal != null && deal < base

            return (
              <motion.div key={p.id} variants={{ hidden: { opacity: 0, y: 15 }, show: { opacity: 1, y: 0 } }}>
                <GameCard
                  name={isTH ? p.name_th : p.name_en}
                  description={plain(isTH ? p.description_th : p.description_en)}
                  image={p.product_images?.[0]?.url}
                  previewVideo={p.preview_video_url}
                  platform={p.type === "desktop_program" ? "PC" : "Roblox"}
                  badge={p.is_featured ? { text: "HOT", kind: "hot" } : null}
                  price={hasDeal ? (deal as number) : base}
                  oldPrice={hasDeal ? base : null}
                  usdRate={usdRate}
                  buyLabel={t("buy_short")}
                  rating={p.rating_avg}
                  reviewCount={p.rating_count}
                  href={`/products/${p.slug}`}
                />
              </motion.div>
            )
          })
        ) : (
          <div className="col-span-full text-center py-10 text-text-muted text-sm">{t("no_featured")}</div>
        )}
      </motion.div>
    </section>
  )
}
