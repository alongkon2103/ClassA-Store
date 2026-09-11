"use client"

// popup ยืนยันการซื้อเกม Maki — หน้าตาเดียวกับ ProductModal ของเกมเรา แต่ขั้นตอนจ่ายเป็นของ Maki:
// ไม่ต้องกรอกชื่อในเกม/เลือกช่องทางจ่าย (Stripe ของ Maki จัดการ) · สิทธิ์เข้าบัญชี Discord/Google ที่ล็อกอินอยู่ตรง ๆ
// โค้ดส่วนลด: การ์ดโค้ดสาธารณะ + ใส่เอง + ใส่โค้ด auto ที่ลดมากสุดให้ — server ตัดไม่ให้ต่ำกว่าขั้นต่ำ Maki
import { useCallback, useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { motion } from "framer-motion"
import { useSession } from "next-auth/react"
import { useLocale, useTranslations } from "next-intl"
import { Link, usePathname, useRouter } from "@/i18n/routing"
import { getImageUrl } from "@/lib/getImageUrl"
import { variantLabel } from "@/lib/i18n/locale"
import { pickBestAutoCode } from "@/lib/discountCodes"

export type MakiBuyPlan = { key: string; label_th: string; label_en: string; price: number; min: number; duration_days: number; is_lifetime: boolean }
type PublicCode = { code: string; type: string; value: number; min_amount: number | null; remaining: number | null; already_used: boolean; is_auto_select: boolean }
type Applied = { code: string; amountOff: number; finalAmount: number; capped: boolean; source: "auto" | "card" | "typed" }

const ERR_KEYS: Record<string, string> = { onboarding: "partner_err_onboarding", below_min: "partner_err_below_min", no_identity: "partner_err_no_identity", unavailable: "partner_err_unavailable", not_found: "partner_err_unavailable" }
const baht = (n: number) => `฿${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`

export default function MakiBuyModal({ product, plan, pointsPerBaht, hasPreset, onClose }: {
  product: { id: string; name_th: string; name_en: string; image: string | null }
  plan: MakiBuyPlan
  pointsPerBaht: number | null
  hasPreset: boolean
  onClose: () => void
}) {
  const t = useTranslations("ProductModal")
  const tp = useTranslations("ProductPage")
  const locale = useLocale()
  const router = useRouter()
  const pathname = usePathname()
  const { data: session, status } = useSession()

  const [codes, setCodes] = useState<PublicCode[]>([])
  const [showAll, setShowAll] = useState(false)
  const [input, setInput] = useState("")
  const [applied, setApplied] = useState<Applied | null>(null)
  const [codeErr, setCodeErr] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)
  const [paying, setPaying] = useState(false)
  const [payErr, setPayErr] = useState<string | null>(null)

  const final = applied ? applied.finalAmount : plan.price
  const name = locale === "th" ? product.name_th : product.name_en
  const provider = session?.user?.provider === "google" ? "Google" : session?.user?.provider === "discord" ? "Discord" : "Discord / Google"
  const discountErr = useCallback((code: string) => { const k = `discount_error_${code}`; return t.has(k) ? t(k) : t("discount_error_SERVER_ERROR") }, [t])

  const validate = useCallback(async (code: string, source: Applied["source"]) => {
    setChecking(true); setCodeErr(null)
    try {
      const r = await fetch("/api/discount-codes/validate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code, partnerProductId: product.id, planKey: plan.key }) })
      const d = await r.json().catch(() => ({}))
      if (d.valid) { setApplied({ code: d.code, amountOff: Number(d.amountOff), finalAmount: Number(d.finalAmount), capped: !!d.capped, source }); return true }
      if (source !== "auto") setCodeErr(discountErr(String(d.errorCode ?? "SERVER_ERROR")))
      return false
    } catch { if (source !== "auto") setCodeErr(t("discount_error_NETWORK")); return false } finally { setChecking(false) }
  }, [product.id, plan.key, discountErr, t])

  // การ์ดโค้ดสาธารณะของเกมนี้ + ใส่โค้ด auto ที่ลดมากสุดให้เอง (ต้องล็อกอินถึงตรวจสิทธิ์ได้)
  useEffect(() => {
    let alive = true
    fetch(`/api/discount-codes/public?partnerProductId=${encodeURIComponent(product.id)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!alive || !d?.codes) return
        const list: PublicCode[] = d.codes
        setCodes(list)
        if (!session?.user?.id) return
        const best = pickBestAutoCode(list.map((c) => ({ code: c.code, type: c.type, value: c.value, minAmount: c.min_amount, isAutoSelect: c.is_auto_select, soldOut: c.remaining === 0, alreadyUsed: c.already_used })), plan.price)
        if (best) validate(best.code, "auto")
      })
      .catch(() => {})
    return () => { alive = false }
  }, [product.id, plan.price, session?.user?.id, validate])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose()
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  const pay = async () => {
    if (!session) { router.push(`/login?callbackUrl=${encodeURIComponent(pathname)}`); return }
    setPaying(true); setPayErr(null)
    try {
      const r = await fetch("/api/maki/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ product_id: product.id, plan_key: plan.key, locale, discount_code: applied?.code ?? null }) })
      const d = await r.json().catch(() => ({}))
      if (!r.ok || !d.payment_url) {
        if (d.error === "discount") { setApplied(null); setPayErr(discountErr(String(d.errorCode ?? "SERVER_ERROR"))) }
        else setPayErr(tp(ERR_KEYS[d.error] ?? "partner_err_generic"))
        setPaying(false); return
      }
      window.location.assign(d.payment_url) // หน้าจ่ายของ Stripe (Maki) — จ่ายเสร็จเด้งกลับ /orders/maki/<id>
    } catch { setPayErr(tp("partner_err_generic")); setPaying(false) }
  }

  const disabledCard = (c: PublicCode) => c.remaining === 0 || c.already_used || plan.price < (c.min_amount ?? 0)
  const sorted = [...codes].sort((a, b) => Number(disabledCard(a)) - Number(disabledCard(b)))
  const visible = showAll ? sorted : sorted.slice(0, 3)

  return createPortal(
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center sm:p-5"
      style={{ background: "var(--color-overlay)", backdropFilter: "blur(8px)" }} onClick={onClose}>
      <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
        className="w-full bg-bg-card border border-border-soft rounded-t-2xl sm:rounded-[18px] max-h-[92vh] sm:max-w-[480px] overflow-y-auto custom-scrollbar"
        onClick={(e) => e.stopPropagation()}>
        {/* หัวเรื่อง + ปุ่มปิด */}
        <div className="flex items-center justify-between px-6 sm:px-7 pt-6">
          <h2 className="text-lg font-extrabold">{t("confirm_title")}</h2>
          <button onClick={onClose} aria-label={t("close")}
            className="w-9 h-9 rounded-[10px] border border-border-soft text-text-muted flex items-center justify-center hover:bg-white/[0.05] hover:text-text-base transition">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>

        {/* สรุปสินค้า */}
        <div className="px-6 sm:px-7 pt-6">
          <div className="flex items-center gap-3.5 p-4 bg-bg-surface rounded-xl">
            <img src={getImageUrl(product.image || "/placeholder.png")} alt="" className="w-14 h-14 rounded-[10px] object-cover shrink-0" />
            <div className="min-w-0">
              <h3 className="text-[0.88rem] font-bold mb-0.5 truncate">{name}</h3>
              <p className="text-xs text-text-dim truncate">{variantLabel(plan, locale)}</p>
            </div>
            <div className="ml-auto text-right shrink-0">
              {applied && <div className="text-[0.72rem] text-text-dim line-through">{baht(plan.price)}</div>}
              <div className="text-lg font-extrabold">{baht(final)}</div>
            </div>
          </div>
          {pointsPerBaht != null && final > 0 && (
            <p className="mt-2 px-1 text-[0.72rem] text-gold flex flex-wrap items-center gap-x-1.5">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" className="shrink-0"><circle cx="12" cy="12" r="10" /></svg>
              {t("points_preview", { points: Math.floor(final * pointsPerBaht).toLocaleString() })}
              <span className="text-text-dim">· {t("points_preview_note")}</span>
            </p>
          )}
        </div>

        <div className="px-6 sm:px-7 py-6 space-y-5">
          {/* บัญชีที่รับสิทธิ์ (หรือชวนล็อกอิน) */}
          {status === "loading" ? null : session ? (
            <div className="rounded-xl border border-accent/25 bg-accent/[0.06] px-4 py-3">
              <p className="text-[0.82rem] font-bold">{tp("partner_unlock_for", { provider, name: session.user?.name ?? "" })}</p>
              <p className="text-[0.72rem] text-text-dim mt-0.5 leading-relaxed">{tp("partner_unlock_hint")}</p>
            </div>
          ) : (
            <div className="rounded-xl border border-border-soft bg-bg-base/50 px-4 py-3">
              <p className="text-[0.85rem] font-bold">{t("login_required")}</p>
              <p className="text-[0.75rem] text-text-muted mt-0.5">{t("login_required_desc")}</p>
            </div>
          )}

          {/* โค้ดส่วนลด */}
          {session && (
            <div className="pt-4 border-t border-white/10">
              <label className="block text-[11px] text-text-muted mb-1.5 uppercase tracking-wider">{t("discount_label")}</label>
              {applied ? (
                <div className="flex items-center justify-between bg-green-500/10 border border-green-500/30 rounded-xl px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-green-400 font-mono font-semibold text-[13px]">{applied.code}</span>
                    <span className="text-[12px] text-text-muted">−{baht(applied.amountOff)}</span>
                  </div>
                  <button type="button" onClick={() => { setApplied(null); setInput("") }} className="text-[12px] text-text-muted hover:text-red-400 transition">{t("discount_remove")}</button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input value={input} onChange={(e) => setInput(e.target.value.toUpperCase())}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (input.trim()) validate(input.trim(), "typed") } }}
                    placeholder={t("discount_placeholder")}
                    className="flex-1 bg-bg-base border border-white/10 rounded-xl px-3 py-2.5 text-[14px] uppercase placeholder:text-text-muted/50 focus:border-accent/40 outline-none transition" />
                  <button type="button" onClick={() => validate(input.trim(), "typed")} disabled={checking || !input.trim()}
                    className="px-4 py-2.5 rounded-xl bg-accent/15 text-accent-light text-[13px] font-medium hover:bg-accent/25 disabled:opacity-40 transition">
                    {checking ? "..." : t("discount_apply")}
                  </button>
                </div>
              )}
              {codeErr && <p className="text-[12px] text-red-400 mt-1.5">{codeErr}</p>}
              {applied?.capped && <p className="text-[11px] text-text-dim mt-1.5">{tp("partner_discount_capped", { amount: applied.amountOff.toLocaleString() })}</p>}

              {/* การ์ดโค้ดสาธารณะ (แบบเดียวกับ popup เกมเรา) */}
              {sorted.length > 0 && (
                <div className="mt-2.5 space-y-2">
                  {visible.map((c) => {
                    const soldOut = c.remaining === 0
                    const belowMin = plan.price < (c.min_amount ?? 0)
                    const disabled = soldOut || c.already_used || belowMin
                    const active = applied?.code === c.code
                    const chip = active ? t("public_code_using") : c.already_used ? t("public_code_used") : soldOut ? t("public_code_sold_out") : belowMin ? t("public_code_below_min") : t("public_code_use")
                    return (
                      <button key={c.code} type="button" disabled={disabled || checking} onClick={() => validate(c.code, "card")}
                        className={`w-full flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition ${
                          active ? "border-green-500/50 bg-green-500/[0.10] ring-1 ring-green-500/30"
                            : disabled ? "border-white/5 bg-white/[0.02] opacity-45 cursor-not-allowed"
                              : "border-amber-500/30 bg-amber-500/[0.06] hover:bg-amber-500/[0.12] active:scale-[0.99]"}`}>
                        <div className="shrink-0 min-w-[56px] text-center">
                          <p className={`text-[16px] font-bold leading-none ${active ? "text-green-400" : disabled ? "text-text-muted" : "text-amber-400"}`}>{c.type === "fixed" ? baht(c.value) : `${c.value}%`}</p>
                          <p className="text-[9px] uppercase tracking-widest text-text-muted mt-1">{t("public_code_off")}</p>
                        </div>
                        <div className="self-stretch border-l border-dashed border-white/15" />
                        <div className="flex-1 min-w-0">
                          <p className="font-mono font-semibold text-[13px] text-text-base truncate">{c.code}</p>
                          <p className="text-[11px] text-text-muted mt-0.5 truncate">
                            {[c.min_amount ? t("public_code_min", { min: baht(c.min_amount) }) : null, c.remaining !== null ? t("public_code_left", { n: c.remaining }) : null].filter(Boolean).join(" · ")}
                          </p>
                        </div>
                        <span className={`shrink-0 text-[11px] px-2.5 py-1 rounded-lg font-medium ${active ? "bg-green-500/20 text-green-400" : disabled ? "bg-white/5 text-text-muted" : "bg-amber-500/15 text-amber-400"}`}>
                          {checking ? "..." : chip}
                        </span>
                      </button>
                    )
                  })}
                  {sorted.length > 3 && (
                    <button type="button" onClick={() => setShowAll((v) => !v)}
                      className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-[12px] text-text-muted hover:text-text-base hover:bg-white/[0.04] transition">
                      {showAll ? t("public_code_show_less") : t("public_code_show_more", { n: sorted.length - 3 })}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          <button disabled={paying || status === "loading"} onClick={pay}
            className={`w-full py-4 rounded-xl font-bold text-base transition-all flex items-center justify-center gap-2.5 shadow-[0_4px_24px_rgba(37,99,235,0.3)] hover:shadow-[0_8px_32px_rgba(37,99,235,0.45)] hover:-translate-y-0.5 ${
              paying ? "opacity-60 cursor-not-allowed bg-accent text-white" : "bg-gradient-to-r from-accent to-accent-light text-white"}`}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><polyline points="9 12 11 14 15 10" /></svg>
            {paying ? tp("partner_redirecting") : session ? `${t("confirm_pay")} · ${baht(final)}` : t("login_button")}
          </button>
          {payErr && <p className="text-[12px] text-red-400 text-center -mt-2">{payErr}</p>}

          <div className="text-[11px] text-text-muted text-center leading-relaxed space-y-1">
            <p>{tp("partner_delivery_note")}</p>
            {hasPreset && <p>✦ {tp("partner_preset_note")}</p>}
            <p>{tp("partner_no_refund")}</p>
            <p>{t.rich("accept_rules", { link: (chunks) => <Link href="/rules" target="_blank" rel="noopener noreferrer" className="text-accent-light hover:underline underline-offset-2">{chunks}</Link> })}</p>
          </div>
        </div>
      </motion.div>
    </motion.div>,
    document.body,
  )
}
