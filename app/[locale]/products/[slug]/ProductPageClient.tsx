"use client"
import { variantLabel } from "@/lib/i18n/locale"
import { youtubeEmbed } from "@/lib/video"

import { useEffect, useMemo, useState } from "react"
import ImageCarousel from "@/components/products/ImageCarousel"
import { useLocale, useTranslations } from "next-intl"
import { AnimatePresence } from "framer-motion"
import { Link } from "@/i18n/routing"
import Navbar from "@/components/Navbar"
import Footer from "@/components/home/Footer"
import ProductReviews from "@/components/products/ProductReviews"
import ProductModal from "@/components/products/ProductModal"
import MakiBuyModal, { type MakiBuyPlan } from "@/components/products/MakiBuyModal"
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
  duration_type?: string | null // ใช้ทำป้ายแพ็กเกจภาษา ja/zh (แพลน Maki ส่งมาด้วย)
  duration_days?: number | null
}
type ProductImage = { url: string; alt_text?: string | null }
type Product = {
  id: string
  slug: string
  name_th: string
  name_en: string
  description_th: string | null
  description_en: string | null
  videos: string[]
  preview_video_url: string | null
  price: number
  product_images: ProductImage[]
  product_variants: Variant[]
}
type Related = { slug: string; name_th: string; name_en: string; image: string | null; min_price: number }

const baht = (n: number) => `฿${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
const pct = (was: number, now: number) => (was > 0 ? Math.round(((was - now) / was) * 100) : 0)


// จุดเด่นคงที่ที่โชว์ใต้คะแนนของทุกเกม — ข้อความอยู่ใน i18n ProductPage.highlight_*
const hlSvg = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const }
const HIGHLIGHTS: { key: string; icon: React.ReactNode }[] = [
  { key: "auto_update", icon: <svg {...hlSvg}><polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" /></svg> },
  { key: "new_content", icon: <svg {...hlSvg}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg> },
  { key: "presets", icon: <svg {...hlSvg}><rect x="2" y="3" width="20" height="14" rx="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" /></svg> },
  { key: "tikfinity", icon: <svg {...hlSvg}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg> },
]

/** เกม Maki ใช้หน้าเดียวกับเกมเรา — ต่างแค่ราคาโค้ด (ไม่ต่ำกว่าขั้นต่ำ Maki) ป้ายพาร์ทเนอร์ และ popup ซื้อของ Maki */
export type MakiPageInfo = { partnerName: string; plans: MakiBuyPlan[]; hasPreset: boolean }

export default function ProductPageClient({
  product, related, reviewSummary, functions = [], features = [], pointsPerBaht = null, maki = null
}: {
  product: Product
  related: Related[]
  reviewSummary?: { average: number; count: number }
  functions?: { id: string; name: string; label_th: string | null; label_en: string | null }[]
  features?: { id: string; text_th: string; text_en: string | null }[]
  pointsPerBaht?: number | null // อัตรา AC Points ต่อบาท (null = ระบบแต้มปิด) — โชว์แต้มต่อแพ็กเกจและตรงปุ่มซื้อ
  maki?: MakiPageInfo | null
}) {
  const t = useTranslations("ProductPage")
  const tc = useTranslations("Common")
  const tr = useTranslations("Reviews")
  const tFaq = useTranslations("Faq")
  const locale = useLocale()
  const isTH = locale === "th"
  // 1) Persist the affiliate ref (?ref=CODE) BEFORE useAutoDiscounts resolves.
  //    Registered first so its effect runs before the hook reads aff_ref.
  //    Last-click: a newer ref overwrites the old one, matching /r/<code>.
  //    Read from window (not useSearchParams): that hook forces a CSR bailout on this
  //    ISR page and 500s any render that has no Suspense boundary above it.
  useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get("ref")?.trim().toUpperCase()
    if (ref) {
      try { sessionStorage.setItem(AFF_REF_KEY, ref) } catch { /* storage disabled */ }
    }
  }, [])

  const { bestDiscountedPrice, bestMakiPrice } = useAutoDiscounts()

  const [buyOpen, setBuyOpen] = useState(false)
  const [imgIdx, setImgIdx] = useState(0)
  const [tab, setTab] = useState<"about" | "reviews" | "faq">("about")
  const [pkgId, setPkgId] = useState<string | null>(null)
  const [fav, setFav] = useState({ liked: false, saved: false, likes: 0, signedIn: false })
  const [copied, setCopied] = useState(false)

  const name = isTH ? product.name_th : product.name_en
  const desc = isTH ? (product.description_th || product.description_en) : (product.description_en || product.description_th)
  // คะแนนหัวหน้า: ค่าจาก server เป็นค่าเริ่ม แล้วให้ส่วนรีวิวอัปเดตสดหลังโหลด/ส่งรีวิว (หน้า cache ISR 60 วิ เลยเคยไม่ขึ้นทันที)
  const [summary, setSummary] = useState<{ average: number; count: number }>(reviewSummary ?? { average: 0, count: 0 })
  const images = product.product_images.length > 0 ? product.product_images : [{ url: "/placeholder.png" }]

  const displayVariants = useMemo(
    () => product.product_variants.filter((v) => v.is_active !== false && v.variant_type !== "premium"),
    [product.product_variants],
  )

  // Lowest live price for the headline + sticky bar (with best discount applied).
  const priced = displayVariants.map((v) => {
    const d = maki
      ? bestMakiPrice(product.id, v.price, maki.plans.find((p) => p.key === v.id)?.min ?? 0)
      : bestDiscountedPrice(product.id, v.price)
    return { v, price: v.price, discounted: d != null && d < v.price ? d : null }
  })
  const cheapest = priced.reduce<(typeof priced)[number] | null>((min, cur) => {
    const curEff = cur.discounted ?? cur.price
    const minEff = min ? (min.discounted ?? min.price) : Infinity
    return curEff < minEff ? cur : min
  }, null)
  const headlineNow = cheapest ? (cheapest.discounted ?? cheapest.price) : product.price
  const headlineWas = cheapest?.discounted != null ? cheapest.price : null

  // YouTube-only video section — every valid URL becomes an embed.
  const ytEmbeds = (product.videos ?? []).map(youtubeEmbed).filter((u): u is string => !!u)

  // เลือกแพ็กเกจ: ค่าเริ่มต้นเป็นตัวที่ "คุ้มสุด" (ราคาสูงสุด = lifetime ตามดีไซน์)
  useEffect(() => {
    if (!pkgId && displayVariants.length) {
      const best = displayVariants.reduce((a, b) => (a.price >= b.price ? a : b))
      setPkgId(best.id)
    }
  }, [displayVariants, pkgId])

  // สถานะปุ่มกดใจ / รายการโปรด
  useEffect(() => {
    fetch(`/api/favorites/${product.slug}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setFav({ liked: d.liked, saved: d.saved, likes: d.likes, signedIn: d.signedIn }))
      .catch(() => {})
  }, [product.slug])

  const toggleFav = async (key: "liked" | "saved") => {
    if (!fav.signedIn) return
    const next = !fav[key]
    setFav((f) => ({ ...f, [key]: next })) // อัปเดตทันทีให้กดแล้วรู้สึกไว
    const r = await fetch(`/api/favorites/${product.slug}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [key]: next }),
    })
    if (r.ok) { const d = await r.json(); setFav((f) => ({ ...f, liked: d.liked, saved: d.saved, likes: d.likes })) }
  }

  const copyLink = async () => {
    try { await navigator.clipboard.writeText(window.location.href); setCopied(true); setTimeout(() => setCopied(false), 2000) } catch { /* ไม่รองรับ */ }
  }

  // แท็บเลื่อนไปยัง section (ตามดีไซน์ ทุก section แสดงพร้อมกัน)
  const goSection = (id: "about" | "reviews" | "faq") => {
    setTab(id)
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  const selected = displayVariants.find((v) => v.id === pkgId) ?? null
  const selectedPriced = priced.find((x) => x.v.id === pkgId) ?? null
  // ป้าย "16 ฟังก์ชัน" ยังนับจาก product_functions · รายการจุดเด่นในแท็บรายละเอียดมาจากที่แอดมินพิมพ์เอง (product_features)
  const functionCount = functions.length
  const featureList = features.map((f) => (isTH ? f.text_th : f.text_en || f.text_th) || f.text_th)
  const typeChip = maki ? `${tc("partner")} · ${maki.partnerName}` : (product as unknown as { type?: string }).type === "desktop_program" ? "PC" : "Roblox"

  return (
    <>
      <Navbar />

      <main className="pb-28 lg:pb-0">
        {/* BREADCRUMB */}
        <div className="page-container">
          <div className="py-5 text-xs text-text-dim flex items-center gap-1.5 flex-wrap">
            <Link href="/products" className="text-accent-light">{t("breadcrumb_shop")}</Link>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6" /></svg>
            <span className="text-accent-light">{typeChip}</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6" /></svg>
            <span className="truncate max-w-[180px] sm:max-w-none">{name}</span>
          </div>
        </div>

        {/* PRODUCT LAYOUT */}
        <div className="page-container">
          <div className="grid grid-cols-1 lg:grid-cols-[1.15fr_1fr] gap-8 lg:gap-12 mb-12 items-start">

            {/* ── GALLERY ── */}
            <div className="flex flex-col gap-3">
              {/* carousel ของรูปเกมทั้งหมด — ป้ายส่วนลดกับปุ่มไปดูวิดีโอวางทับมุม ไม่บังรูป */}
              <ImageCarousel images={images.map((im) => getImageUrl(im.url))} alt={name} index={imgIdx} onChange={setImgIdx}>
                {headlineWas != null && (
                  <span className="absolute top-3.5 left-3.5 px-3.5 py-1 bg-hot text-white rounded-lg text-[0.7rem] font-bold z-10">
                    -{pct(headlineWas, headlineNow)}%
                  </span>
                )}
                {ytEmbeds.length > 0 && (
                  <button
                    onClick={() => goSection("about")}
                    className="absolute top-3.5 right-3.5 z-10 px-3 py-1.5 rounded-lg bg-black/45 border border-white/20 text-white text-[0.7rem] font-semibold flex items-center gap-1.5 backdrop-blur-sm hover:bg-black/65 transition"
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3" /></svg>
                    {t("videos_title")}
                  </button>
                )}
              </ImageCarousel>

              {images.length > 1 && (
                <div className="grid grid-cols-6 gap-2">
                  {images.slice(0, 12).map((im, i) => (
                    <button key={i} onClick={() => setImgIdx(i)}
                      className={`h-[60px] rounded-lg border-2 overflow-hidden transition-colors ${i === imgIdx ? "border-accent-light" : "border-border-soft hover:border-accent-light/60"}`}>
                      <img src={getImageUrl(im.url)} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}

              {/* ปุ่ม กดใจ / รายการโปรด / แชร์ */}
              <div className="flex gap-2 mt-1">
                <button onClick={() => toggleFav("liked")} disabled={!fav.signedIn}
                  title={fav.signedIn ? "" : t("login_to_use")}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-[10px] border bg-bg-card text-[0.8rem] font-semibold transition disabled:opacity-50 ${
                    fav.liked ? "text-hot border-hot/30" : "border-border-soft text-text-muted hover:bg-white/[0.03] hover:border-border-light hover:text-text-base"}`}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill={fav.liked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                  </svg>
                  <span>{t("like")}{fav.likes > 0 ? ` ${fav.likes}` : ""}</span>
                </button>

                <button onClick={() => toggleFav("saved")} disabled={!fav.signedIn}
                  title={fav.signedIn ? "" : t("login_to_use")}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-[10px] border bg-bg-card text-[0.8rem] font-semibold transition disabled:opacity-50 ${
                    fav.saved ? "text-gold border-gold/30" : "border-border-soft text-text-muted hover:bg-white/[0.03] hover:border-border-light hover:text-text-base"}`}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill={fav.saved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
                    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                  </svg>
                  <span>{t("favorite")}</span>
                </button>

                <button onClick={copyLink}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-[10px] border border-border-soft bg-bg-card text-text-muted text-[0.8rem] font-semibold hover:bg-white/[0.03] hover:border-border-light hover:text-text-base transition">
                  {copied ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" /></svg>
                  )}
                  <span>{copied ? t("link_copied") : t("share")}</span>
                </button>
              </div>
            </div>

            {/* ── PRODUCT INFO ── */}
            <div className="flex flex-col">
              <h1 className="text-[1.6rem] sm:text-[2rem] font-black tracking-tight mb-4 leading-tight">{name}</h1>

              <div className="flex gap-2 mb-4 flex-wrap">
                <span className="px-4 py-1.5 rounded-lg text-[0.78rem] font-semibold bg-accent/[0.08] border border-accent/[0.12] text-accent-lighter">{typeChip}</span>
                {maki && (
                  <span className="px-4 py-1.5 rounded-lg text-[0.78rem] font-semibold bg-violet-500/10 border border-violet-500/20 text-violet-300">{t("partner_by", { name: maki.partnerName })}</span>
                )}
                {functionCount > 0 && (
                  <span className="px-4 py-1.5 rounded-lg text-[0.78rem] font-semibold bg-accent/[0.08] border border-accent/[0.12] text-accent-lighter">
                    {t("functions_count", { count: functionCount })}
                  </span>
                )}
              </div>

              <button onClick={() => goSection("reviews")} className="flex items-center gap-2 mb-6 text-left">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className="text-gold">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
                {summary.count > 0 ? (
                  <>
                    <span className="text-base font-extrabold">{summary.average.toFixed(1)}</span>
                    <span className="text-text-dim text-sm">({tr("count", { count: summary.count })})</span>
                  </>
                ) : (
                  <span className="text-text-dim text-sm">{tr("no_rating")}</span>
                )}
              </button>

              {/* จุดเด่นคงที่ของทุกเกม (ตามที่เจ้าของร้านกำหนด) */}
              <ul className="list-none flex flex-col gap-3 mb-7">
                {HIGHLIGHTS.map(({ key, icon }) => (
                  <li key={key} className="flex items-start gap-3 text-sm text-text-muted leading-relaxed">
                    <span className="text-accent-light mt-0.5 shrink-0">{icon}</span>
                    {t(`highlight_${key}`)}
                  </li>
                ))}
              </ul>


              {/* เลือกแพ็กเกจ */}
              {displayVariants.length > 0 && (
                <div>
                  <h3 className="text-base font-extrabold mb-3.5">{t("options")}</h3>
                  <div className={`grid rounded-xl overflow-hidden border-2 border-border-soft mb-4 ${displayVariants.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
                    {priced.map(({ v, price, discounted }, i) => {
                      const on = v.id === pkgId
                      return (
                        <button key={v.id} onClick={() => setPkgId(v.id)}
                          className={`flex flex-col items-center py-[18px] px-4 text-center transition-colors ${on ? "bg-accent/[0.08]" : "bg-bg-card hover:bg-white/[0.02]"} ${i === 0 && displayVariants.length > 1 ? "border-r border-border-soft" : ""}`}>
                          <div className="text-[0.88rem] font-bold mb-0.5 flex items-center justify-center gap-2 flex-wrap">
                            {variantLabel(v, locale)}
                            {discounted != null && (
                              <span className="px-2 py-0.5 rounded bg-hot text-white text-[0.58rem] font-bold tracking-wide">-{pct(price, discounted)}%</span>
                            )}
                          </div>
                          <div className="text-[1.3rem] font-black tracking-tight text-accent-lighter">
                            {discounted != null && <span className="text-[0.8rem] text-text-dim line-through mr-1.5 font-semibold">฿{price.toLocaleString()}</span>}
                            <span className="text-sm">฿</span>{(discounted ?? price).toLocaleString()}
                          </div>
                          {pointsPerBaht != null && (
                            <div className="mt-1 text-[0.68rem] font-bold text-gold">+{Math.floor((discounted ?? price) * pointsPerBaht).toLocaleString()} {t("points_unit")}</div>
                          )}
                        </button>
                      )
                    })}
                  </div>

                  {/* AC Points ของแพ็กเกจที่เลือก — คิดจากราคาเกมหลังส่วนลด ไม่รวมค่าธรรมเนียม */}
                  {pointsPerBaht != null && selectedPriced && (
                    <p className="mb-3 text-[0.78rem] text-gold flex flex-wrap items-center gap-x-1.5">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" className="shrink-0"><circle cx="12" cy="12" r="10" /></svg>
                      {t("points_earn", { points: Math.floor((selectedPriced.discounted ?? selectedPriced.price) * pointsPerBaht).toLocaleString() })}
                      <span className="text-text-dim">· {t("points_note")}</span>
                    </p>
                  )}
                  <button onClick={() => setBuyOpen(true)}
                    className="w-full py-4 rounded-xl text-white text-base font-bold flex items-center justify-center gap-2.5 hover:-translate-y-0.5 transition-all shadow-[0_4px_24px_rgba(37,99,235,0.3)] hover:shadow-[0_8px_32px_rgba(37,99,235,0.45)] mt-1 bg-gradient-to-r from-accent to-accent-light">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" />
                      <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
                    </svg>
                    {tc("buy_now")}
                    {selectedPriced && <span className="opacity-80 font-semibold">· {baht(selectedPriced.discounted ?? selectedPriced.price)}</span>}
                  </button>
                  {maki && (
                    <div className="mt-3 text-[0.75rem] text-text-dim leading-relaxed space-y-1">
                      <p>{t("partner_delivery_note")}</p>
                      {maki.hasPreset && <p>✦ {t("partner_preset_note")}</p>}
                      <p>{t("partner_no_refund")}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── TABS ── */}
        <div className="page-container">
          <div className="border-t border-border-soft mb-12">
            <div className="flex border-b border-border-soft overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {([
                { k: "about", label: tr("tab_detail") },
                { k: "reviews", label: `${tr("tab_reviews")}${summary.count ? ` (${summary.count})` : ""}` },
                { k: "faq", label: tr("tab_faq") },
              ] as const).map((x) => (
                <button key={x.k} onClick={() => goSection(x.k)}
                  className={`px-5 sm:px-7 py-[18px] text-[0.88rem] font-semibold whitespace-nowrap relative transition-colors ${tab === x.k ? "text-accent-light" : "text-text-dim hover:text-text-muted"}`}>
                  {x.label}
                  {tab === x.k && <span className="absolute left-0 right-0 -bottom-px h-[2px] bg-accent rounded-full" />}
                </button>
              ))}
            </div>

            {/* เนื้อหา + sidebar */}
            <div className="grid grid-cols-1 md:grid-cols-[1fr_320px] gap-9 py-9">
              <div className="flex flex-col gap-9 min-w-0">
                {/* รายละเอียด */}
                <div id="about" className="scroll-mt-24">
                  <h3 className="text-lg font-extrabold mb-4">{t("description_title")}</h3>
                  {desc ? (
                    <div className="prose-product max-w-none text-[0.88rem] text-text-muted leading-[1.85] mb-6 [&_img]:rounded-xl [&_a]:text-accent-light [&_h1]:text-text-base [&_h2]:text-text-base [&_h3]:text-text-base [&_strong]:text-text-base"
                         dangerouslySetInnerHTML={{ __html: desc }} />
                  ) : <p className="text-[0.88rem] text-text-dim mb-6">—</p>}

                  {featureList.length > 0 && (
                    <ul className="list-none grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {featureList.map((f, i) => (
                        <li key={i} className="flex items-center gap-2 text-[0.82rem] text-text-muted">
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-accent-light shrink-0"><polyline points="20 6 9 17 4 12" /></svg>
                          {f}
                        </li>
                      ))}
                    </ul>
                  )}

                  {ytEmbeds.length > 0 && (
                    <div className="grid sm:grid-cols-2 gap-4 mt-6">
                      {ytEmbeds.map((src, i) => (
                        <div key={i} className="aspect-video rounded-2xl overflow-hidden border border-border-soft">
                          <iframe src={src} title={`YouTube ${i + 1}`} className="w-full h-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* รีวิว */}
                <div id="reviews" className="scroll-mt-24">
                  <h3 className="text-lg font-extrabold mb-4">
                    {tr("tab_reviews")}{" "}
                    {summary.count ? <span className="text-[0.78rem] text-text-dim font-medium">({tr("count", { count: summary.count })})</span> : null}
                  </h3>
                  <ProductReviews slug={product.slug} onSummary={setSummary} />
                </div>

                {/* คำถามที่พบบ่อย */}
                <div id="faq" className="scroll-mt-24">
                  <h3 className="text-lg font-extrabold mb-4">{tr("tab_faq")}</h3>
                  {(tFaq.raw("sections") as { title: string; items: { q: string; a: string }[] }[])
                    .flatMap((sec) => sec.items).slice(0, 6)
                    .map((it, i) => (
                      <details key={i} className="border-b border-border-soft py-4 group">
                        <summary className="cursor-pointer list-none flex items-center justify-between gap-4 text-[0.92rem] font-medium">
                          {it.q}
                          <span className="text-text-muted group-open:text-accent-light transition-colors text-lg leading-none">+</span>
                        </summary>
                        <p className="mt-3 text-[0.86rem] text-text-muted leading-[1.85]">{it.a}</p>
                      </details>
                    ))}
                </div>
              </div>

              {/* SIDEBAR: สินค้าอื่นที่น่าสนใจ */}
              {related.length > 0 && (
                <aside>
                  <h3 className="text-base font-extrabold mb-3.5">{t("related_title")}</h3>
                  <div className="flex flex-col gap-2.5">
                    {related.map((r) => (
                      <Link key={r.slug} href={`/products/${r.slug}`}
                        className="flex gap-3 p-3 bg-bg-card border border-border-soft rounded-xl hover:border-accent/30 hover:-translate-y-0.5 transition-all">
                        <div className="w-[72px] h-[72px] rounded-lg overflow-hidden shrink-0" style={{ background: "var(--gradient-thumb)" }}>
                          <img src={getImageUrl(r.image || "/placeholder.png")} alt="" className="w-full h-full object-cover" />
                        </div>
                        <div className="flex-1 flex flex-col justify-center min-w-0">
                          <h4 className="text-[0.82rem] font-bold mb-0.5 truncate">{isTH ? r.name_th : r.name_en}</h4>
                          <div className="text-[0.68rem] text-text-dim mb-1">{t("from")}</div>
                          <div className="text-sm font-extrabold text-accent-lighter">{baht(r.min_price)}</div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </aside>
              )}
            </div>
          </div>
        </div>
      </main>

      <Footer />

      {/* แถบซื้อติดล่างจอ (มือถือ) */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-bg-surface/95 backdrop-blur border-t border-border-soft px-4 py-3 flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-[11px] text-text-dim">{t("from")}</p>
          <p className="text-[17px] font-bold text-accent-light leading-none">{baht(headlineNow)}</p>
        </div>
        <button onClick={() => setBuyOpen(true)}
          className="flex-1 py-3 rounded-xl text-white font-bold text-[15px] active:scale-[0.98] transition-all bg-gradient-to-r from-accent to-accent-light">
          {tc("buy_now")}
        </button>
      </div>

      {/* ขั้นตอนซื้อใช้ modal เดิม ไม่ทำ checkout ซ้ำ */}
      <AnimatePresence>
        {buyOpen && (maki ? (
          <MakiBuyModal
            product={{ id: product.id, name_th: product.name_th, name_en: product.name_en, image: product.product_images[0]?.url ?? null }}
            plan={maki.plans.find((p) => p.key === pkgId) ?? maki.plans[0]}
            pointsPerBaht={pointsPerBaht}
            hasPreset={maki.hasPreset}
            onClose={() => setBuyOpen(false)}
          />
        ) : (
          <ProductModal product={product} initialVariantId={pkgId ?? undefined} onClose={() => setBuyOpen(false)} />
        ))}
      </AnimatePresence>
    </>
  )
}
