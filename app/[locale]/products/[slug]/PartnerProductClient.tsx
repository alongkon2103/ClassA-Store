"use client"
import { variantLabel } from "@/lib/i18n/locale"

// หน้าสินค้าของเกมพาร์ทเนอร์แบบขายในเว็บเรา (Maki) — โครงเดียวกับหน้าสินค้าเรา
// เฟส 2: กดซื้อ → POST /api/maki/checkout → redirect ไป Stripe ของ Maki → กลับมาที่ /orders/maki/<id>
// สิทธิ์ส่งเข้าบัญชี Discord/Google ที่ล็อกอินอยู่ จึงต้องโชว์ให้ชัดก่อนจ่ายว่าปลดล็อกให้บัญชีไหน (ส่งผิด = Maki ไม่คืนเงิน)
import { useCallback, useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useAutoDiscounts } from "@/lib/useAutoDiscounts"
import { useLocale, useTranslations } from "next-intl"
import { Link, useRouter } from "@/i18n/routing"
import { getImageUrl } from "@/lib/getImageUrl"
import ImageCarousel from "@/components/products/ImageCarousel"

export type PartnerPlan = { key: string; plan: "1m" | "perma"; label_th: string; label_en: string; duration_days: number; is_lifetime: boolean; sell_price_thb: number | null; available: boolean; has_preset: boolean }
export type PartnerProductData = {
  id: string; slug: string; name_th: string; name_en: string; partner_name: string
  description_th: string | null; description_en: string | null
  images: string[]; plans: PartnerPlan[]
  videos: { embed_url: string; youtube_url?: string | null }[] // จาก Maki preview_url
}
type Related = { slug: string; name_th: string; name_en: string; image: string | null; min_price: number }

const hlSvg = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const }
const HIGHLIGHTS: { key: string; icon: React.ReactNode }[] = [
  { key: "auto_update", icon: <svg {...hlSvg}><polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" /></svg> },
  { key: "new_content", icon: <svg {...hlSvg}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg> },
  { key: "presets", icon: <svg {...hlSvg}><rect x="2" y="3" width="20" height="14" rx="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" /></svg> },
  { key: "tikfinity", icon: <svg {...hlSvg}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg> },
]
const ERR_KEYS: Record<string, string> = { onboarding: "partner_err_onboarding", below_min: "partner_err_below_min", no_identity: "partner_err_no_identity", unavailable: "partner_err_unavailable", not_found: "partner_err_unavailable" }
const btnBase = "w-full py-4 rounded-xl text-white text-base font-bold flex items-center justify-center gap-2 bg-gradient-to-r from-accent to-accent-light shadow-[0_4px_24px_rgba(37,99,235,0.3)] transition-all"

export default function PartnerProductClient({ product, related, usdRate, pointsPerBaht = null }: { product: PartnerProductData; related: Related[]; usdRate: number | null; pointsPerBaht?: number | null }) {
  const t = useTranslations("ProductPage")
  const tc = useTranslations("Common")
  const tm = useTranslations("ProductModal") // ข้อความโค้ดส่วนลดชุดเดียวกับ modal สินค้าเรา
  const locale = useLocale()
  const router = useRouter()
  const { data: session, status: authStatus } = useSession()
  const { bestAutoCode } = useAutoDiscounts()
  const isTH = locale === "th"
  const name = isTH ? product.name_th : product.name_en
  const desc = isTH ? (product.description_th || product.description_en) : (product.description_en || product.description_th)
  const images = product.images.length ? product.images : ["/placeholder.png"]
  const [imgIdx, setImgIdx] = useState(0)
  const sellable = product.plans.filter((p) => p.available)
  const [pkgKey, setPkgKey] = useState<string | null>(sellable.length ? sellable[sellable.length - 1].key : null)
  const cur = product.plans.find((p) => p.key === pkgKey) ?? null
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const baht = (n: number) => `฿${n.toLocaleString()}`
  const usd = (n: number) => (usdRate ? ` / $${(n * usdRate).toFixed(2)}` : "")
  const pts = (n: number) => Math.floor(n * (pointsPerBaht ?? 0)).toLocaleString()
  const providerLabel = session?.user?.provider === "google" ? "Google" : session?.user?.provider === "discord" ? "Discord" : "Discord / Google"

  // ── โค้ดส่วนลดร้านเรา (ใช้กับเกมพาร์ทเนอร์ได้ ยกเว้นโค้ดนายหน้า) — server เป็นคนคิดและตัดไม่ให้ต่ำกว่าขั้นต่ำ Maki ──
  type Applied = { code: string; amountOff: number; finalAmount: number; capped: boolean; source: "typed" | "auto" }
  const [codeInput, setCodeInput] = useState("")
  const [applied, setApplied] = useState<Applied | null>(null)
  const [codeErr, setCodeErr] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)
  const discountErr = (code: string) => { const k = `discount_error_${code}`; return tm.has(k) ? tm(k) : tm("discount_error_SERVER_ERROR") }
  const validate = useCallback(async (code: string, planKey: string, source: Applied["source"]) => {
    setChecking(true); setCodeErr(null)
    try {
      const r = await fetch("/api/discount-codes/validate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code, partnerProductId: product.id, planKey }) })
      const d = await r.json().catch(() => ({}))
      if (d.valid) { setApplied({ code: d.code, amountOff: Number(d.amountOff), finalAmount: Number(d.finalAmount), capped: !!d.capped, source }); return true }
      setApplied(null)
      if (source === "typed") setCodeErr(discountErr(String(d.errorCode ?? "SERVER_ERROR")))
      return false
    } catch { if (source === "typed") setCodeErr(tm("discount_error_NETWORK")); return false } finally { setChecking(false) }
  }, [product.id]) // eslint-disable-line react-hooks/exhaustive-deps
  // เปลี่ยนแพลน/ล็อกอิน → ตรวจโค้ดที่พิมพ์ไว้ใหม่ หรือใส่โค้ด auto ที่ลดได้มากสุดให้เอง (เหมือน modal สินค้าเรา)
  useEffect(() => {
    if (!session?.user?.id || !cur?.sell_price_thb) { setApplied(null); return }
    if (applied?.source === "typed") { validate(applied.code, cur.key, "typed"); return }
    const auto = bestAutoCode(product.id, cur.sell_price_thb)
    if (auto) validate(auto.code, cur.key, "auto"); else setApplied(null)
  }, [cur?.key, session?.user?.id, bestAutoCode]) // eslint-disable-line react-hooks/exhaustive-deps
  const finalPrice = cur?.sell_price_thb != null ? (applied ? applied.finalAmount : cur.sell_price_thb) : null

  const buy = async () => {
    if (!cur) return
    setBusy(true); setErr(null)
    try {
      const r = await fetch("/api/maki/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ product_id: product.id, plan_key: cur.key, locale, discount_code: applied?.code ?? null }) })
      const d = await r.json().catch(() => ({}))
      if (!r.ok || !d.payment_url) {
        setErr(d.error === "discount" ? discountErr(String(d.errorCode ?? "SERVER_ERROR")) : t(ERR_KEYS[d.error] ?? "partner_err_generic"))
        if (d.error === "discount") setApplied(null)
        setBusy(false); return
      }
      window.location.assign(d.payment_url) // ไปหน้าจ่ายของ Stripe (Maki) — จ่ายเสร็จเด้งกลับมา /orders/maki/<id>
    } catch { setErr(t("partner_err_generic")); setBusy(false) }
  }

  return (
    <div className="min-h-screen">
      <div className="page-container pt-5">
        <nav className="flex items-center gap-2 text-[0.72rem] text-text-dim mb-5">
          <Link href="/products" className="hover:text-text-base">{t("breadcrumb_shop")}</Link>
          <span>›</span>
          <span className="text-accent-light">{tc("partner")}</span>
          <span>›</span>
          <span className="text-text-muted truncate">{name}</span>
        </nav>
      </div>

      <div className="page-container">
        <div className="grid grid-cols-1 lg:grid-cols-[1.15fr_1fr] gap-8 lg:gap-12 mb-12 items-start">
          {/* แกลเลอรี */}
          <div className="flex flex-col gap-3">
            <ImageCarousel images={images.map((u) => getImageUrl(u))} alt={name} index={imgIdx} onChange={setImgIdx}>
              <span className="absolute top-3.5 left-3.5 px-3 py-1 bg-violet-500 text-white rounded-lg text-[0.65rem] font-bold uppercase tracking-[0.05em] z-10">{tc("partner")} · {product.partner_name}</span>
            </ImageCarousel>
            {images.length > 1 && (
              <div className="grid grid-cols-6 gap-2">
                {images.slice(0, 12).map((u, i) => (
                  <button key={i} onClick={() => setImgIdx(i)}
                    className={`h-[60px] rounded-lg border-2 overflow-hidden transition-colors ${i === imgIdx ? "border-accent-light" : "border-border-soft hover:border-accent-light/60"}`}>
                    <img src={getImageUrl(u)} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ข้อมูล */}
          <div>
            <h1 className="text-[1.6rem] sm:text-[2rem] font-black tracking-[-0.02em] leading-tight mb-3">{name}</h1>
            <div className="flex flex-wrap gap-2 mb-4">
              <span className="px-3 py-1 rounded-lg text-[0.72rem] font-bold bg-violet-500/15 text-violet-300 border border-violet-500/25">{product.partner_name}</span>
              <span className="px-3 py-1 rounded-lg text-[0.72rem] font-bold bg-accent/10 text-accent-light border border-accent/20">{t("partner_by", { name: product.partner_name })}</span>
            </div>

            <ul className="list-none flex flex-col gap-3 mb-7">
              {HIGHLIGHTS.map(({ key, icon }) => (
                <li key={key} className="flex items-start gap-3 text-sm text-text-muted leading-relaxed">
                  <span className="text-accent-light mt-0.5 shrink-0">{icon}</span>
                  {t(`highlight_${key}`)}
                </li>
              ))}
            </ul>

            {/* แพ็กเกจ */}
            <h3 className="text-[0.95rem] font-bold mb-3">{t("options")}</h3>
            <div className="grid grid-cols-2 gap-3 mb-4">
              {product.plans.map((p) => (
                <button key={p.key} disabled={!p.available} onClick={() => setPkgKey(p.key)}
                  className={`text-left rounded-xl border p-4 transition ${pkgKey === p.key ? "border-accent bg-accent/[0.08]" : "border-border-soft bg-bg-card hover:border-border-light"} disabled:opacity-50 disabled:cursor-not-allowed`}>
                  <div className="text-[0.82rem] font-bold mb-1">{variantLabel(p, locale)}</div>
                  {p.available ? (
                    <>
                      <div className="text-[1.15rem] font-extrabold text-accent-lighter">{baht(p.sell_price_thb as number)}<span className="text-[0.68rem] text-text-dim font-medium">{usd(p.sell_price_thb as number)}</span></div>
                      {pointsPerBaht != null && <div className="mt-1 text-[0.68rem] font-bold text-gold">+{pts(p.sell_price_thb as number)} {t("points_unit")}</div>}
                    </>
                  ) : (
                    <div className="text-[0.75rem] text-text-dim">{t("plan_unavailable")}</div>
                  )}
                </button>
              ))}
            </div>

            {/* โค้ดส่วนลด (ต้องล็อกอินถึงตรวจได้ — เหมือน modal) */}
            {session && cur?.sell_price_thb != null && (
              <div className="mb-4">
                <label className="block text-[0.68rem] text-text-dim uppercase tracking-[0.08em] mb-1.5">{tm("discount_label")}</label>
                {applied ? (
                  <div className="flex items-center justify-between bg-success/10 border border-success/30 rounded-xl px-3 py-2.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-success font-mono font-semibold text-[0.82rem]">{applied.code}</span>
                      <span className="text-[0.75rem] text-text-muted">−{baht(applied.amountOff)}</span>
                      {applied.source === "auto" && <span className="text-[0.65rem] text-text-dim truncate">· {t("partner_discount_auto")}</span>}
                    </div>
                    <button type="button" onClick={() => { setApplied(null); setCodeInput("") }} className="text-[0.75rem] text-text-muted hover:text-hot transition shrink-0">{tm("discount_remove")}</button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <input value={codeInput} onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (codeInput.trim()) validate(codeInput.trim(), cur.key, "typed") } }}
                      placeholder={tm("discount_placeholder")}
                      className="flex-1 bg-bg-base border border-border-soft rounded-xl px-3 py-2.5 text-[0.85rem] uppercase placeholder:text-text-dim focus:border-accent/40 outline-none transition" />
                    <button type="button" onClick={() => validate(codeInput.trim(), cur.key, "typed")} disabled={checking || !codeInput.trim()}
                      className="px-4 py-2.5 rounded-xl bg-accent/15 text-accent-light text-[0.8rem] font-semibold hover:bg-accent/25 disabled:opacity-40 transition">
                      {checking ? "..." : tm("discount_apply")}
                    </button>
                  </div>
                )}
                {codeErr && <p className="text-[0.75rem] text-hot mt-1.5">{codeErr}</p>}
                {applied?.capped && <p className="text-[0.72rem] text-text-dim mt-1.5">{t("partner_discount_capped", { amount: applied.amountOff.toLocaleString() })}</p>}
              </div>
            )}

            {pointsPerBaht != null && finalPrice != null && (
              <p className="mb-3 text-[0.78rem] text-gold flex flex-wrap items-center gap-x-1.5">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" className="shrink-0"><circle cx="12" cy="12" r="10" /></svg>
                {t("points_earn", { points: pts(finalPrice) })}
                <span className="text-text-dim">· {t("points_note")}</span>
              </p>
            )}

            {/* ซื้อ: ต้องล็อกอิน (Discord/Google) เพราะสิทธิ์ส่งเข้าบัญชีนั้นตรงๆ */}
            {authStatus === "loading" ? (
              <button disabled className={`${btnBase} opacity-60`}>{tc("buy_now")}</button>
            ) : !session ? (
              <button onClick={() => router.push(`/login?callbackUrl=${encodeURIComponent(window.location.pathname)}`)} className={btnBase}>
                {t("partner_login_to_buy")}
              </button>
            ) : (
              <>
                <div className="rounded-xl border border-accent/25 bg-accent/[0.06] px-4 py-3 mb-3">
                  <p className="text-[0.82rem] font-bold">{t("partner_unlock_for", { provider: providerLabel, name: session.user?.name ?? "" })}</p>
                  <p className="text-[0.72rem] text-text-dim mt-0.5 leading-relaxed">{t("partner_unlock_hint")}</p>
                </div>
                <button onClick={buy} disabled={!cur || busy} className={`${btnBase} hover:-translate-y-0.5 disabled:opacity-60 disabled:cursor-not-allowed disabled:translate-y-0`}>
                  {busy ? t("partner_redirecting") : (
                    <>
                      {tc("buy_now")}
                      {finalPrice != null && <span> · {baht(finalPrice)}</span>}
                      {applied && cur?.sell_price_thb != null && <span className="text-[0.8rem] font-medium line-through opacity-70">{baht(cur.sell_price_thb)}</span>}
                    </>
                  )}
                </button>
                {err && <p className="text-[0.78rem] text-hot mt-2">{err}</p>}
              </>
            )}
            <p className="text-[0.75rem] text-text-dim leading-relaxed mt-3">{t("partner_delivery_note")}</p>
            {product.plans.some((p) => p.has_preset) && <p className="text-[0.75rem] text-text-dim mt-1">✦ {t("partner_preset_note")}</p>}
            <p className="text-[0.72rem] text-text-dim mt-1">{t("partner_no_refund")}</p>
          </div>
        </div>

        {/* รายละเอียด + สินค้าอื่น */}
        <div className="grid grid-cols-1 md:grid-cols-[1fr_320px] gap-9 pb-12">
          <div className="min-w-0">
            {product.videos.length > 0 && (
              <div className="mb-8">
                <h3 className="text-lg font-extrabold mb-4">{t("partner_video_title")}</h3>
                <div className={`grid gap-4 ${product.videos.length > 1 ? "sm:grid-cols-2" : ""}`}>
                  {product.videos.map((v) => (
                    <div key={v.embed_url} className="aspect-video rounded-xl overflow-hidden border border-border-soft bg-black">
                      <iframe src={`${v.embed_url}?rel=0&modestbranding=1`} title={t("partner_video_title")} className="w-full h-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen />
                    </div>
                  ))}
                </div>
              </div>
            )}
            <h3 className="text-lg font-extrabold mb-4">{t("description_title")}</h3>
            {desc ? (
              <div className="prose-product max-w-none text-[0.88rem] text-text-muted leading-[1.85] whitespace-pre-line [&_img]:rounded-xl [&_a]:text-accent-light [&_h1]:text-text-base [&_h2]:text-text-base [&_h3]:text-text-base [&_strong]:text-text-base"
                   dangerouslySetInnerHTML={{ __html: desc }} />
            ) : <p className="text-[0.88rem] text-text-dim">—</p>}
          </div>
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
  )
}
