"use client"

import { useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import { AnimatePresence } from "framer-motion"
import { Link } from "@/i18n/routing"
import Navbar from "@/components/Navbar"
import ProductModal from "@/components/products/ProductModal"
import { getImageUrl } from "@/lib/getImageUrl"
import { useAutoDiscounts } from "@/lib/useAutoDiscounts"

// Same session key /r/<code> and useAutoDiscounts use for affiliate attribution.
const AFF_REF_KEY = "aff_ref"

type Variant = {
  id: string
  label_th: string
  label_en: string
  price: number
  variant_type?: string | null
  is_active?: boolean | null
  stock: number
}
type ProductImage = { url: string; alt_text?: string | null }
type Product = {
  id: string
  slug: string
  name_th: string
  name_en: string
  description_th: string | null
  description_en: string | null
  youtube_url: string | null
  tutorial_video_url: string | null
  preview_video_url: string | null
  price: number
  product_images: ProductImage[]
  product_variants: Variant[]
}
type Related = { slug: string; name_th: string; name_en: string; image: string | null; min_price: number }

const baht = (n: number) => `฿${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`

function youtubeEmbed(url: string): string | null {
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{11})/)
  return m ? `https://www.youtube.com/embed/${m[1]}` : null
}

export default function ProductPageClient({ product, related }: { product: Product; related: Related[] }) {
  const t = useTranslations("ProductPage")
  const tc = useTranslations("Common")
  const locale = useLocale()
  const isTH = locale === "th"
  const searchParams = useSearchParams()

  // 1) Persist the affiliate ref (?ref=CODE) BEFORE useAutoDiscounts resolves.
  //    Registered first so its effect runs before the hook reads aff_ref.
  //    Last-click: a newer ref overwrites the old one, matching /r/<code>.
  useEffect(() => {
    const ref = searchParams?.get("ref")?.trim().toUpperCase()
    if (ref) {
      try { sessionStorage.setItem(AFF_REF_KEY, ref) } catch { /* storage disabled */ }
    }
  }, [searchParams])

  const { bestDiscountedPrice } = useAutoDiscounts()

  const [buyOpen, setBuyOpen] = useState(false)
  const [imgIdx, setImgIdx] = useState(0)
  const [copied, setCopied] = useState(false)

  const name = isTH ? product.name_th : product.name_en
  const desc = isTH ? (product.description_th || product.description_en) : (product.description_en || product.description_th)
  const images = product.product_images.length > 0 ? product.product_images : [{ url: "/placeholder.png" }]

  const displayVariants = useMemo(
    () => product.product_variants.filter((v) => v.is_active !== false && v.variant_type !== "premium"),
    [product.product_variants],
  )

  // Lowest live price for the headline + sticky bar (with best discount applied).
  const priced = displayVariants.map((v) => {
    const d = bestDiscountedPrice(product.id, v.price)
    return { v, price: v.price, discounted: d != null && d < v.price ? d : null }
  })
  const cheapest = priced.reduce<(typeof priced)[number] | null>((min, cur) => {
    const curEff = cur.discounted ?? cur.price
    const minEff = min ? (min.discounted ?? min.price) : Infinity
    return curEff < minEff ? cur : min
  }, null)
  const headlineNow = cheapest ? (cheapest.discounted ?? cheapest.price) : product.price
  const headlineWas = cheapest?.discounted != null ? cheapest.price : null

  const ytEmbed = product.youtube_url ? youtubeEmbed(product.youtube_url) : null
  const hasVideo = !!ytEmbed || !!product.tutorial_video_url

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch { /* clipboard blocked */ }
  }

  return (
    <>
      <Navbar />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-28 lg:pb-16">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-[12px] text-text-muted mb-5">
          <Link href="/" className="hover:text-text-base transition-colors">{t("breadcrumb_home")}</Link>
          <span className="opacity-40">/</span>
          <Link href="/products" className="hover:text-text-base transition-colors">{t("breadcrumb_shop")}</Link>
          <span className="opacity-40">/</span>
          <span className="text-text-base truncate max-w-[160px] sm:max-w-none">{name}</span>
        </nav>

        <div className="grid lg:grid-cols-2 gap-6 lg:gap-10">
          {/* ── Gallery ── */}
          <div className="lg:sticky lg:top-24 lg:self-start">
            <div className="relative aspect-video rounded-2xl overflow-hidden bg-bg-card border border-accent/10">
              <img src={getImageUrl(images[imgIdx].url)} alt={name} className="w-full h-full object-cover" />
            </div>
            {images.length > 1 && (
              <div className="flex gap-2.5 mt-3 overflow-x-auto custom-scrollbar pb-1">
                {images.map((im, i) => (
                  <button
                    key={i}
                    onClick={() => setImgIdx(i)}
                    className={`relative w-20 h-14 shrink-0 rounded-xl overflow-hidden border-2 transition-all ${i === imgIdx ? "border-accent" : "border-transparent opacity-60 hover:opacity-100"}`}
                  >
                    <img src={getImageUrl(im.url)} alt={`${name}-${i}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ── Buy box ── */}
          <div>
            <h1 className="text-[24px] sm:text-[30px] font-bold leading-tight">{name}</h1>

            <div className="flex items-end gap-3 mt-4">
              <span className="text-[32px] font-bold text-accent-light leading-none">{baht(headlineNow)}</span>
              {headlineWas != null && (
                <span className="text-[17px] text-text-muted line-through mb-0.5">{baht(headlineWas)}</span>
              )}
              {displayVariants.length > 1 && <span className="text-[13px] text-text-muted mb-1">{t("from")}</span>}
            </div>

            {/* Variant list (display only — selection happens in the buy modal) */}
            {displayVariants.length > 0 && (
              <div className="mt-5 space-y-2">
                <p className="text-[12px] tracking-widest text-text-muted uppercase">{t("options")}</p>
                {/* Whitelist products have no key stock — never show "sold out",
                    just the price (matching the shop cards + modal). */}
                {priced.map(({ v, price, discounted }) => (
                  <div
                    key={v.id}
                    className="flex items-center justify-between px-4 py-3 rounded-xl border border-accent/15 bg-bg-card"
                  >
                    <span className="text-[14px] font-medium">{isTH ? v.label_th : v.label_en}</span>
                    <span className="flex items-center gap-2">
                      {discounted != null && <span className="text-[13px] text-text-muted line-through">{baht(price)}</span>}
                      <span className={`text-[15px] font-semibold ${discounted != null ? "text-accent-light" : ""}`}>
                        {baht(discounted ?? price)}
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* CTA */}
            <div className="mt-6 flex items-center gap-3">
              <button
                onClick={() => setBuyOpen(true)}
                className="flex-1 py-3.5 rounded-xl bg-accent text-white font-semibold text-[15px] hover:opacity-90 active:scale-[0.98] transition-all"
              >
                {tc("buy_now")}
              </button>
              <button
                onClick={copyLink}
                aria-label={t("share")}
                className="w-12 h-12 shrink-0 flex items-center justify-center rounded-xl border border-accent/20 text-text-muted hover:text-accent-light hover:bg-accent/5 transition-all"
              >
                {copied ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" /></svg>
                )}
              </button>
            </div>
            {copied && <p className="text-[12px] text-green-400 mt-2">{t("link_copied")}</p>}
          </div>
        </div>

        {/* ── Description ── */}
        {desc && (
          <section className="mt-12">
            <h2 className="text-[18px] font-bold mb-4">{t("description_title")}</h2>
            <div
              className="prose-product max-w-none text-[14px] text-text-muted leading-relaxed [&_img]:rounded-xl [&_a]:text-accent-light [&_h1]:text-text-base [&_h2]:text-text-base [&_h3]:text-text-base [&_strong]:text-text-base"
              dangerouslySetInnerHTML={{ __html: desc }}
            />
          </section>
        )}

        {/* ── Videos ── */}
        {hasVideo && (
          <section className="mt-12">
            <h2 className="text-[18px] font-bold mb-4">{t("videos_title")}</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              {ytEmbed && (
                <div className="aspect-video rounded-2xl overflow-hidden border border-accent/10">
                  <iframe src={ytEmbed} title="YouTube" className="w-full h-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
                </div>
              )}
              {product.tutorial_video_url && (
                <div className="aspect-video rounded-2xl overflow-hidden border border-accent/10 bg-black">
                  <video src={getImageUrl(product.tutorial_video_url)} controls className="w-full h-full object-contain" />
                </div>
              )}
            </div>
          </section>
        )}

        {/* ── Related ── */}
        {related.length > 0 && (
          <section className="mt-12">
            <h2 className="text-[18px] font-bold mb-4">{t("related_title")}</h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {related.map((r) => (
                <Link
                  key={r.slug}
                  href={`/products/${r.slug}`}
                  className="group bg-bg-card border border-accent/10 rounded-2xl overflow-hidden transition-all hover:border-accent/25 hover:-translate-y-0.5"
                >
                  <div className="aspect-video overflow-hidden bg-bg-base">
                    <img src={getImageUrl(r.image || "/placeholder.png")} alt={isTH ? r.name_th : r.name_en} className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                  </div>
                  <div className="p-3">
                    <p className="text-[13px] font-medium truncate">{isTH ? r.name_th : r.name_en}</p>
                    <p className="text-[13px] text-accent-light font-semibold mt-1">{baht(r.min_price)}</p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>

      {/* ── Sticky mobile buy bar ── */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-bg-card/95 backdrop-blur-md border-t border-accent/15 px-4 py-3 flex items-center gap-3">
        <div className="min-w-0">
          <p className="text-[11px] text-text-muted leading-none">{displayVariants.length > 1 ? t("from") : ""}</p>
          <p className="text-[19px] font-bold text-accent-light leading-tight">{baht(headlineNow)}</p>
        </div>
        <button
          onClick={() => setBuyOpen(true)}
          className="flex-1 py-3 rounded-xl bg-accent text-white font-semibold text-[15px] active:scale-[0.98] transition-all"
        >
          {tc("buy_now")}
        </button>
      </div>

      {/* Buy flow reuses the existing modal — no checkout logic duplicated. */}
      <AnimatePresence>
        {buyOpen && <ProductModal product={product} onClose={() => setBuyOpen(false)} />}
      </AnimatePresence>
    </>
  )
}
