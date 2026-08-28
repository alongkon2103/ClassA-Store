"use client"

// Modal for a PARTNER game (external). Same look as ProductModal but read-only:
// it shows the price/discount breakdown + review video and the buy button links
// OUT to the partner's store (with our ref). No checkout happens here.

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { useTranslations, useLocale } from "next-intl"

type Plan = {
  label_th?: string; label_en?: string; is_lifetime?: boolean; duration_days?: number | null
  list_price_thb?: number; list_price_usd?: number; discount_thb?: number
  price_thb?: number; price_usd?: number
}
type Video = { video_id?: string; embed_url?: string; youtube_url?: string; thumbnail_url?: string }
type PartnerData = {
  name_th: string; name_en: string
  description_html_th?: string | null; description_html_en?: string | null
  badge?: string | null
  ref_url: string; game_link_url?: string | null
  price_from_thb: number; price_from_usd: number
  images: string[]; videos: Video[]; plans: Plan[]
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function PartnerModal({ product, onClose }: { product: any; onClose: () => void }) {
  const t = useTranslations("PartnerModal")
  const locale = useLocale()
  const isTH = locale === "th"
  const partnerName: string = product.partner_name ?? "Partner"
  const data: PartnerData = product.partner

  const images = data.images ?? []
  const video = (data.videos ?? [])[0]
  const embedUrl = video?.embed_url || (video?.video_id ? `https://www.youtube-nocookie.com/embed/${video.video_id}` : null)
  const total = images.length + (embedUrl ? 1 : 0)

  const [index, setIndex] = useState(0)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  const prev = () => setIndex((i) => Math.max(0, i - 1))
  const next = () => setIndex((i) => Math.min(total - 1, i + 1))

  const name = isTH ? data.name_th : data.name_en
  const descHtml = (isTH ? data.description_html_th : data.description_html_en) || ""
  // USD is derived from THB using the plan's own list ratio (list_usd/list_thb),
  // which is how the partner's CHECKOUT converts — NOT the API's price_usd field,
  // which uses a live FX and doesn't match what the buyer actually pays there.
  const usdRate = (pl: Plan) =>
    pl.list_price_usd && pl.list_price_thb ? pl.list_price_usd / pl.list_price_thb
      : pl.price_usd && pl.price_thb ? pl.price_usd / pl.price_thb
        : 0.03
  const money = (thb: number, rate: number) =>
    isTH ? `฿${thb.toLocaleString()}` : `$${(thb * rate).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  const videoThumb = video?.thumbnail_url || (video?.video_id ? `https://img.youtube.com/vi/${video.video_id}/mqdefault.jpg` : "")

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center sm:p-5"
      style={{ background: "var(--color-overlay)", backdropFilter: "blur(8px)" }}
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
        className="w-full bg-bg-card border border-accent/20 rounded-t-2xl sm:rounded-2xl max-h-[92vh] sm:max-w-2xl overflow-y-auto custom-scrollbar"
        onClick={(e) => e.stopPropagation()}
      >
        {/* MEDIA SLIDER */}
        <div className="relative aspect-video bg-bg-base overflow-hidden">
          <div className="flex h-full transition-transform duration-300" style={{ transform: `translateX(-${index * 100}%)` }}>
            {images.map((url, i) => (
              <img key={i} src={url} alt="" className="min-w-full h-full object-cover" />
            ))}
            {embedUrl && (
              <div className="min-w-full h-full bg-black flex items-center justify-center">
                <iframe
                  width="100%" height="100%"
                  src={`${embedUrl}?rel=0&modestbranding=1`}
                  title="Review video" frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              </div>
            )}
          </div>

          {/* Partner badge, top-left */}
          <span className="absolute top-3 left-3 bg-violet-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase z-10">
            {partnerName}
          </span>

          <button onClick={onClose} className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center transition">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
          {total > 1 && (
            <>
              <button onClick={prev} disabled={index === 0} className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 text-white disabled:opacity-30">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6" /></svg>
              </button>
              <button onClick={next} disabled={index === total - 1} className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 text-white disabled:opacity-30">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6" /></svg>
              </button>
            </>
          )}
        </div>

        {/* THUMBNAIL STRIP */}
        {total > 1 && (
          <div className="flex gap-2 px-4 py-3 bg-bg-base border-b border-white/5 overflow-x-auto scrollbar-none">
            {images.map((url, i) => (
              <button key={i} onClick={() => setIndex(i)} className={`relative flex-shrink-0 w-14 h-14 rounded-lg overflow-hidden transition-all ${i === index ? "ring-2 ring-accent opacity-100" : "opacity-40"}`}>
                <img src={url} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
            {embedUrl && videoThumb && (
              <button onClick={() => setIndex(images.length)} className={`relative flex-shrink-0 w-14 h-14 rounded-lg overflow-hidden transition-all ${index === images.length ? "ring-2 ring-accent opacity-100" : "opacity-40"}`}>
                <img src={videoThumb} alt="review" className="w-full h-full object-cover" />
                <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="red" stroke="none">
                    <path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2c.46-1.7.46-5.33.46-5.33a29 29 0 0 0-.46-5.33z" />
                    <polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02" fill="white" />
                  </svg>
                </div>
              </button>
            )}
          </div>
        )}

        <div className="p-5 space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-lg font-bold text-text-base">{name}</h2>
            <span className="text-[10px] font-semibold text-violet-300 bg-violet-500/15 border border-violet-500/30 px-2 py-0.5 rounded-full">
              {t("partner_product")}
            </span>
          </div>

          {descHtml && (
            <div className="prose prose-sm prose-invert max-w-none text-text-muted" dangerouslySetInnerHTML={{ __html: descHtml }} />
          )}

          {/* PLANS — full price / discount / final price */}
          <div className="space-y-3">
            {data.plans.map((pl, i) => {
              const rate = usdRate(pl)
              const hasDiscount = (pl.discount_thb ?? 0) > 0 && (pl.list_price_thb ?? 0) > (pl.price_thb ?? 0)
              return (
                <div key={i} className="bg-bg-base/50 border border-white/5 rounded-xl p-4">
                  <p className="text-[13px] font-semibold text-text-base mb-2">
                    {isTH ? pl.label_th : pl.label_en}
                  </p>
                  <div className="space-y-1 text-[13px]">
                    <div className="flex justify-between">
                      <span className="text-text-muted">{t("full_price")}</span>
                      <span className={hasDiscount ? "text-text-muted line-through" : "text-text-base font-semibold"}>
                        {money(pl.list_price_thb ?? 0, rate)}
                      </span>
                    </div>
                    {hasDiscount && (
                      <div className="flex justify-between">
                        <span className="text-text-muted">{t("discount")}</span>
                        <span className="text-red-400">- {money(pl.discount_thb ?? 0, rate)}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-baseline pt-1 border-t border-white/5">
                      <span className="text-text-base font-medium">{t("final_price")}</span>
                      <span className="text-[18px] font-bold text-green-400">{money(pl.price_thb ?? 0, rate)}</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* BUY — links OUT to the partner store */}
          <a
            href={data.ref_url}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full text-center py-3.5 rounded-xl font-semibold text-[15px] bg-violet-500 text-white hover:opacity-90 active:scale-95 transition"
          >
            {t("buy_at_partner", { name: partnerName })}
          </a>
          <p className="text-[11px] text-text-muted text-center -mt-1">{t("external_note")}</p>
        </div>
      </motion.div>
    </motion.div>
  )
}
