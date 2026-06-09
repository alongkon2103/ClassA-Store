"use client"

import { useRef, useState } from "react"
import { useTranslations, useLocale } from "next-intl"
import { getImageUrl } from "@/lib/getImageUrl"

type Variant = {
  id: string
  label_th: string
  label_en: string
  price: number
  is_active: boolean
  variant_type?: string
}

type Props = {
  name: string
  price: number
  image?: string
  previewVideo?: string | null
  is_low: boolean
  is_featured: boolean
  onClick?: () => void
  product_variants?: Variant[]
}

export default function ProductCard({
  name,
  price,
  image,
  previewVideo,
  is_low,
  product_variants,
  is_featured,
  onClick,
}: Props) {
  const t = useTranslations("Common")
  const locale = useLocale()

  const variants = (product_variants ?? []).filter(
    (v: any) => v.is_active === true && v.variant_type !== "premium"
  )

  const hasVariants = variants.length > 0

  // Lazy video — src only attached on hover so list-view stays light.
  // preload="none" means the browser won't even fetch metadata until hover.
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [videoActive, setVideoActive] = useState(false)

  const handleEnter = () => {
    if (!previewVideo) return
    setVideoActive(true)
    const v = videoRef.current
    if (v) {
      if (!v.src) v.src = getImageUrl(previewVideo)
      v.currentTime = 0
      v.play().catch(() => { /* autoplay blocked — ignore */ })
    }
  }

  const handleLeave = () => {
    if (!previewVideo) return
    const v = videoRef.current
    if (v) {
      v.pause()
      v.currentTime = 0
    }
    setVideoActive(false)
  }

  return (
    <div
      onClick={onClick}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      className="group bg-bg-card border border-accent/20 rounded-2xl overflow-hidden cursor-pointer transition-all hover:scale-[1.02] hover:shadow-lg"
    >
      <div className="relative aspect-video overflow-hidden">
        <img
          src={getImageUrl(image || "/placeholder.png")}
          alt={name}
          className={`w-full h-full object-cover transition-all duration-300 ${
            videoActive
              ? "opacity-0 scale-100"
              : "opacity-100 group-hover:scale-105"
          }`}
        />

        {previewVideo && (
          <video
            ref={videoRef}
            muted
            playsInline
            loop
            preload="none"
            poster={getImageUrl(image || "/placeholder.png")}
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-200 ${
              videoActive ? "opacity-100" : "opacity-0 pointer-events-none"
            }`}
          />
        )}

        {is_featured && (
          <span className="absolute top-2 right-2 bg-gold text-gold-text text-[10px] font-bold px-2 py-0.5 rounded-full uppercase z-10">
            {t("hot")}
          </span>
        )}

        {!hasVariants && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-10">
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
