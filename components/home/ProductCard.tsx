import { useTranslations, useLocale } from "next-intl"
import { getImageUrl } from "@/lib/getImageUrl"

type Variant = {
  id: string
  label_th: string
  label_en: string
  price: number
  stock: number
  is_active?: boolean
  variant_type?: string | null
}

type Props = {
  name: string
  price: number
  image: string
  badge?: string
  is_low?: boolean
  product_variants?: Variant[]
  onClick?: () => void
}

export default function ProductCard({
  name,
  price,
  image,
  badge,
  is_low,
  product_variants,
  onClick,
}: Props) {
  const t = useTranslations("Common")
  const locale = useLocale()

  // กรองเฉพาะ variant ที่ active และไม่ใช่ premium
  const variants = (product_variants ?? []).filter(
    (v) => v.is_active === true && v.variant_type !== "premium"
  )

  // คำนวณ stock รวมเฉพาะ variant ที่แสดงจริง
  const totalStock =
    variants.reduce((sum, v) => sum + (v.stock ?? 0), 0)

  const hasVariants = variants.length > 0

  return (
    <div
      onClick={onClick}
      className="group bg-bg-card border border-accent/20 rounded-2xl overflow-hidden cursor-pointer transition-all hover:scale-[1.02] hover:shadow-lg"
    >
      {/* Image */}
      <div className="relative aspect-video overflow-hidden">
        <img
          src={getImageUrl(image)}
          alt={name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />

        {badge && (
          <span className="absolute top-2 right-2 bg-gold text-gold-text text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
            {badge === "Hot" ? t("hot") : badge}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="p-3 space-y-2">
        <p className="text-[13px] font-medium text-text-base line-clamp-1">
          {name}
        </p>

        {/* แสดงเฉพาะ variants ที่ไม่ใช่ premium */}
        {hasVariants ? (
          <div className="space-y-1">
            {variants.slice(0, 3).map((v) => (
              <div
                key={v.id}
                className="flex justify-between text-[12px]"
              >
                <span className="text-text-muted">
                  {locale === "th" ? v.label_th : v.label_en}
                </span>
                <span className="font-semibold text-accent-light">
                  ฿{v.price}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-[16px] font-bold text-accent-light">
            ฿{price}
          </div>
        )}

        <div className="h-px bg-accent/10" />
      </div>
    </div>
  )
}