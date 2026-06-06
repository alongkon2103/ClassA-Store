"use client"

import { useTranslations, useLocale } from "next-intl"
import { getImageUrl } from "@/lib/getImageUrl"

type Variant = {
  id: string
  label_th: string
  label_en: string
  price: number
  is_active: boolean
  variant_type?: string // เพิ่มเพื่อให้ Type รองรับการเช็ค premium
}

type Props = {
  name: string
  price: number
  image?: string
  is_low: boolean
  is_featured: boolean
  onClick?: () => void
  product_variants?: Variant[]
}

export default function ProductCard({
  name,
  price,
  image,
  is_low,
  product_variants,
  is_featured,
  onClick,
}: Props) {
  const t = useTranslations("Common")
  const locale = useLocale()

  // 🔥 แก้ไขจุดนี้: กรองเอาเฉพาะ Variant ที่เปิดใช้งานอยู่ และต้องไม่ใช่ประเภท premium
  const variants = (product_variants ?? []).filter(
    (v: any) => v.is_active === true && v.variant_type !== "premium"
  )

  const hasVariants = variants.length > 0

  return (
    <div
      onClick={onClick}
      className="group bg-bg-card border border-accent/20 rounded-2xl overflow-hidden cursor-pointer transition-all hover:scale-[1.02] hover:shadow-lg"
    >
      <div className="relative aspect-video overflow-hidden">
        <img
          src={getImageUrl(image || "/placeholder.png")}
          alt={name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />

        {is_featured && (
          <span className="absolute top-2 right-2 bg-gold text-gold-text text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
            {t("hot")}
          </span>
        )}

        {!hasVariants && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <span className="text-[11px] font-bold text-white/70 uppercase tracking-widest">
              Out of Stock
            </span>
          </div>
        )}
      </div>

      <div className="p-3 space-y-2">
        <p className="text-[13px] font-medium text-text-base line-clamp-1">
          {name}
        </p>

        {/* 💰 PRICE LOGIC: แสดงเฉพาะ 3 รายการแรกที่ไม่ใช่ Premium */}
        {hasVariants ? (
          <div className="space-y-1">
            {variants.slice(0, 3).map((v) => (
              <div key={v.id} className="flex justify-between text-[12px]">
                <span className="text-text-muted">
                  {locale === "th" ? v.label_th : v.label_en}
                </span>
                <span className="font-semibold text-accent-light">
                  ฿{Number(v.price).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[14px] font-bold text-accent-light">
            ฿{Number(price).toLocaleString()}
          </p>
        )}

        <div className="h-px bg-accent/10 my-1" />
      </div>
    </div>
  )
}