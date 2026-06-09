"use client"

import { useRef, useState } from "react"
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
  previewVideo?: string | null
  badge?: string
  is_low?: boolean
  product_variants?: Variant[]
  onClick?: () => void
}

export default function ProductCard({
  name,
  price,
  image,
  previewVideo,
  badge,
  is_low,
  product_variants,
  onClick,
}: Props) {
  const t = useTranslations("Common")
  const locale = useLocale()

  const variants = (product_variants ?? []).filter(
    (v) => v.is_active === true && v.variant_type !== "premium"
  )

  const hasVariants = variants.length > 0

  // Lazy hover video — src attached only on first hover so card list stays light.
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
      {/* Image */}
      <div className="relative aspect-video overflow-hidden">
        <img
          src={getImageUrl(image)}
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
            poster={getImageUrl(image)}
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-200 ${
              videoActive ? "opacity-100" : "opacity-0 pointer-events-none"
            }`}
          />
        )}

        {badge && (
          <span className="absolute top-2 right-2 bg-gold text-gold-text text-[10px] font-bold px-2 py-0.5 rounded-full uppercase z-10">
            {badge === "Hot" ? t("hot") : badge}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="p-3 space-y-2">
        <p className="text-[13px] font-medium text-text-base line-clamp-1">
          {name}
        </p>

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
