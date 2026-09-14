"use client"

// หน้าแลกของรางวัล: การ์ดของรางวัล → กดแลก → หน้าต่างยืนยัน (เกม Roblox กรอก IGN + ตรวจชื่อ) → หน้าต่างผลลัพธ์ (โค้ด/วันหมดอายุ) + ประวัติ
import { useState } from "react"
import { useLocale, useTranslations } from "next-intl"
import { useRouter } from "@/i18n/routing"
import { localeTag } from "@/lib/i18n/locale"
import { getImageUrl } from "@/lib/getImageUrl"
import type { RedemptionView, RewardView } from "@/lib/pointsRedeem"

type Props = { active: boolean; balance: number; rewards: RewardView[]; history: RedemptionView[]; ignHints: Record<string, string | null> }
type IgnCheck = { state: "idle" | "checking" | "ok" | "bad"; name?: string }

const btn = "px-4 py-2 rounded-xl text-[0.82rem] font-bold transition disabled:opacity-50"
const gold = `${btn} text-[#1a1200] bg-gold hover:brightness-110 active:scale-[0.98]`
const ghost = `${btn} border border-border-soft text-text-muted hover:text-text-base`

export default function RedeemClient({ active, balance, rewards, history, ignHints }: Props) {
  const t = useTranslations("Account")
  const locale = useLocale()
  const isTH = locale === "th"
  const router = useRouter()
  const [sel, setSel] = useState<RewardView | null>(null)
  const [ign, setIgn] = useState("")
  const [check, setCheck] = useState<IgnCheck>({ state: "idle" })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [done, setDone] = useState<RedemptionView | null>(null)
  const [copied, setCopied] = useState(false)

  const name = (x: { title_th: string; title_en: string }) => (isTH ? x.title_th : x.title_en) || x.title_th
  const gameName = (p: { name_th: string; name_en: string } | null) => (p ? (isTH ? p.name_th : p.name_en) : "")
  const fmtDate = (s: string) => new Date(s).toLocaleString(localeTag(locale), { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
  const needIgn = (r: RewardView) => r.kind === "game_days" && r.product?.type !== "desktop_program"
  const meta = (r: RewardView) => {
    if (r.kind === "discount_code" && r.discount) {
      const off = r.discount.type === "percent" ? t("redeem_discount_percent", { value: r.discount.value }) : t("redeem_discount_fixed", { value: r.discount.value.toLocaleString() })
      return `${off} · ${r.product ? t("redeem_for_game", { game: gameName(r.product) }) : t("redeem_all_games")} · ${t("redeem_valid_days", { days: r.discount.valid_days })}`
    }
    if (r.kind === "game_days") return t("redeem_days", { days: r.days ?? 0, game: gameName(r.product) })
    return t("redeem_kind_external_code")
  }
  const blocked = (r: RewardView): string | null => {
    if (!active) return t("coins_disabled")
    if (r.available != null && r.available <= 0) return t("redeem_sold_out")
    if (r.per_user_limit != null && r.mine >= r.per_user_limit) return t("redeem_limit_reached")
    if (balance < r.cost) return t("redeem_not_enough")
    return null
  }

  const open = (r: RewardView) => {
    setSel(r); setErr(null); setCheck({ state: "idle" })
    setIgn(needIgn(r) ? ignHints[r.product!.id] ?? "" : "")
  }
  const verifyIgn = async () => {
    if (!ign.trim()) return
    setCheck({ state: "checking" })
    try {
      const d = await fetch(`/api/roblox/verify?username=${encodeURIComponent(ign.trim())}`).then((r) => r.json())
      setCheck(d.ok ? { state: "ok", name: d.user?.displayName || d.user?.username } : { state: "bad" })
    } catch { setCheck({ state: "idle" }) }
  }
  const redeem = async () => {
    if (!sel || busy) return
    setBusy(true); setErr(null)
    try {
      const r = await fetch("/api/points/redeem", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reward_id: sel.id, ign: needIgn(sel) ? ign.trim() : null }) })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) { setErr(t(`redeem_err_${["insufficient", "limit_reached", "out_of_stock", "already_permanent", "ign_required", "ign_invalid", "ign_not_found"].includes(d.error) ? d.error : "generic"}`)); return }
      setSel(null); setDone(d.redemption); setCopied(false)
      router.refresh() // ยอดแต้ม/ประวัติ/สต็อกมาจาก server
    } catch { setErr(t("redeem_err_generic")) } finally { setBusy(false) }
  }
  const copy = async (code: string) => { try { await navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 2000) } catch { /* ไม่รองรับ */ } }

  const result = (x: RedemptionView) => {
    const r = x.result as { code?: string; expires_at?: string; ign?: string | null }
    if (x.kind === "game_days") return `${gameName(x.product)}${r.ign ? ` · ${r.ign}` : ""}${r.expires_at ? ` · ${t("redeem_code_expires", { date: fmtDate(r.expires_at) })}` : ""}`
    return `${r.code ?? ""}${r.expires_at ? ` · ${t("redeem_code_expires", { date: fmtDate(r.expires_at) })}` : ""}`
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-[1.4rem] md:text-[1.7rem] font-black tracking-[-0.02em]">{t("redeem_title")}</h1>
          <p className="text-text-muted text-[0.85rem] mt-1">{t("redeem_sub")}</p>
        </div>
        <div className="rounded-xl border border-gold/25 bg-gold/[0.06] px-4 py-2.5 text-right shrink-0">
          <p className="text-[0.68rem] uppercase tracking-[0.15em] text-gold font-bold">{t("redeem_balance")}</p>
          <p className="text-[1.4rem] font-black text-gold leading-tight">{balance.toLocaleString()} <span className="text-[0.75rem] font-semibold">AC Points</span></p>
        </div>
      </div>

      {rewards.length === 0 ? (
        <div className="bg-bg-card border border-border-soft rounded-[14px] p-10 text-center text-text-muted text-sm">{t("redeem_empty")}</div>
      ) : (
        <div className="grid grid-cols-1 min-[480px]:grid-cols-2 xl:grid-cols-3 gap-4">
          {rewards.map((r) => {
            const why = blocked(r)
            return (
              <div key={r.id} className="bg-bg-card border border-border-soft rounded-[14px] overflow-hidden flex flex-col">
                <div className="aspect-video bg-bg-base relative" style={{ background: "var(--gradient-thumb)" }}>
                  {r.image_url && <img src={getImageUrl(r.image_url)} alt="" className="absolute inset-0 w-full h-full object-cover" />}
                  <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md text-[0.62rem] font-bold bg-black/55 text-white">{t(`redeem_kind_${r.kind}`)}</span>
                  {r.available != null && <span className="absolute top-2 right-2 px-2 py-0.5 rounded-md text-[0.62rem] font-bold bg-black/55 text-white">{t("redeem_left", { n: r.available })}</span>}
                </div>
                <div className="p-4 flex-1 flex flex-col gap-1.5">
                  <p className="text-[0.95rem] font-bold leading-snug">{name(r)}</p>
                  <p className="text-[0.75rem] text-accent-light">{meta(r)}</p>
                  {(isTH ? r.description_th : r.description_en) && <p className="text-[0.75rem] text-text-dim leading-[1.5] line-clamp-3">{isTH ? r.description_th : r.description_en}</p>}
                  {r.per_user_limit != null && <p className="text-[0.7rem] text-text-dim">{t("redeem_limit", { n: r.per_user_limit })}</p>}
                </div>
                <div className="px-4 py-3 border-t border-white/[0.06] flex items-center justify-between gap-3">
                  <span className="text-[1rem] font-black text-gold">{t("redeem_cost", { points: r.cost.toLocaleString() })}</span>
                  <button onClick={() => open(r)} disabled={!!why} title={why ?? undefined} className={gold}>{why ?? t("redeem_btn")}</button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ประวัติ */}
      <div className="bg-bg-card border border-border-soft rounded-[14px] overflow-hidden">
        <div className="px-5 py-4 border-b border-border-soft"><h2 className="text-[0.95rem] font-bold">{t("redeem_history")}</h2></div>
        {history.length === 0 ? (
          <p className="px-5 py-8 text-center text-[0.82rem] text-text-muted">{t("redeem_history_empty")}</p>
        ) : (
          <ul className="divide-y divide-border-soft">
            {history.map((x) => {
              const code = "code" in x.result ? x.result.code : null
              return (
                <li key={x.id} className="px-5 py-3.5 flex items-center gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-[0.85rem] font-semibold truncate">{name(x)}</p>
                    <p className="text-[0.72rem] text-text-dim truncate">{fmtDate(x.created_at)} · {result(x)}</p>
                  </div>
                  {code && <button onClick={() => copy(code)} className={`${ghost} !px-3 !py-1.5 !text-[0.72rem] font-mono`}>{code}</button>}
                  <span className="text-[0.9rem] font-black text-hot shrink-0">-{x.cost.toLocaleString()}</span>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {/* ยืนยันก่อนแลก */}
      {sel && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => !busy && setSel(null)}>
          <div role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()} className="w-full max-w-[440px] rounded-2xl border border-gold/25 bg-bg-card p-6 shadow-[0_24px_60px_rgba(0,0,0,0.55)]">
            <p className="text-[1.1rem] font-black">{t("redeem_confirm_title")}</p>
            <p className="text-[0.85rem] text-text-muted mt-2 leading-[1.6]">{t("redeem_confirm_body", { points: sel.cost.toLocaleString(), title: name(sel), after: (balance - sel.cost).toLocaleString() })}</p>
            <p className="text-[0.75rem] text-hot mt-1">{t("redeem_confirm_note")}</p>
            {needIgn(sel) && (
              <div className="mt-4">
                <label className="text-[0.75rem] font-semibold text-text-muted">{t("redeem_ign_label")}</label>
                <div className="flex gap-2 mt-1">
                  <input value={ign} onChange={(e) => { setIgn(e.target.value); setCheck({ state: "idle" }) }} maxLength={20} spellCheck={false}
                         className="flex-1 min-w-0 bg-bg-base border border-white/10 rounded-xl px-4 py-2.5 text-[0.9rem] outline-none focus:border-accent/50" />
                  <button onClick={verifyIgn} disabled={!ign.trim() || check.state === "checking"} className={ghost}>{check.state === "checking" ? "..." : t("redeem_ign_check")}</button>
                </div>
                <p className={`text-[0.72rem] mt-1 ${check.state === "ok" ? "text-success" : check.state === "bad" ? "text-hot" : "text-text-dim"}`}>
                  {check.state === "ok" ? t("redeem_ign_ok", { name: check.name ?? ign }) : check.state === "bad" ? t("redeem_ign_bad") : t("redeem_ign_hint")}
                </p>
              </div>
            )}
            {err && <p className="mt-3 text-[0.8rem] text-hot">{err}</p>}
            <div className="mt-5 flex gap-2">
              <button onClick={() => setSel(null)} disabled={busy} className={`${ghost} flex-1 !py-3`}>{t("daily_popup_later")}</button>
              <button onClick={redeem} disabled={busy || (needIgn(sel) && !ign.trim())} className={`${gold} flex-[2] !py-3`}>{busy ? "..." : t("redeem_confirm_btn")}</button>
            </div>
          </div>
        </div>
      )}

      {/* ผลลัพธ์ */}
      {done && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setDone(null)}>
          <div role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()} className="w-full max-w-[440px] rounded-2xl border border-success/30 bg-bg-card p-6 text-center shadow-[0_24px_60px_rgba(0,0,0,0.55)]">
            <p className="text-[1.1rem] font-black text-success">✓ {t("redeem_success_title")}</p>
            <p className="text-[0.85rem] text-text-muted mt-1">{name(done)}</p>
            {"code" in done.result && done.result.code ? (
              <>
                <p className="text-[0.72rem] text-text-dim mt-4">{t("redeem_success_code")}</p>
                <button onClick={() => copy((done.result as { code: string }).code)}
                        className="mt-1 w-full py-3 rounded-xl border border-gold/40 bg-gold/10 text-gold font-mono text-[1.15rem] font-black tracking-wider hover:bg-gold/20 transition">
                  {(done.result as { code: string }).code}
                </button>
                <p className="text-[0.72rem] text-text-dim mt-1">{copied ? t("redeem_copied") : t("redeem_copy")}{"expires_at" in done.result && done.result.expires_at ? ` · ${t("redeem_code_expires", { date: fmtDate(done.result.expires_at) })}` : ""}</p>
              </>
            ) : (
              <p className="text-[0.85rem] mt-4">{t("redeem_success_days", { date: fmtDate((done.result as { expires_at: string }).expires_at) })}</p>
            )}
            <button onClick={() => setDone(null)} className={`${ghost} mt-5 w-full !py-3`}>{t("daily_popup_close")}</button>
          </div>
        </div>
      )}
    </div>
  )
}
