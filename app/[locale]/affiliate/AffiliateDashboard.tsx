"use client"

import { useEffect, useState } from "react"
import { useTranslations, useLocale } from "next-intl"
import Navbar from "@/components/Navbar"
import { PAYOUT_CHANNELS, getChannel } from "@/lib/affiliatePayout"

type Data = {
  profile: {
    default_commission_pct: number
    payout_method: string | null
    payout_info: Record<string, string>
    payout_detail: string | null
    display_name: string | null
    is_active: boolean
  }
  totals: { pending: number; requested: number; paid: number; sales_count: number }
  withdraw: {
    min: number
    can_request: boolean
    open_request: { id: string; amount: number; requested_at: string | null; eta_from: string | null; eta_to: string | null } | null
  }
  codes: {
    code: string; type: string; value: number; commission_pct: number | null
    is_active: boolean; used_count: number; max_uses: number | null; product_name: string | null
  }[]
  earnings: {
    id: string; base_amount: number; commission_pct: number; commission_amount: number
    status: string; created_at: string; paid_at: string | null; product_name: string | null
  }[]
  payouts: { id: string; amount: number; method: string | null; status: string; reject_reason: string | null; requested_at: string | null; paid_at: string | null }[]
}

const baht = (n: number) => `฿${n.toLocaleString(undefined, { minimumFractionDigits: 2 })}`

export default function AffiliateDashboard() {
  const t = useTranslations("Affiliate")
  const locale = useLocale()
  const [d, setD] = useState<Data | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = () =>
    fetch("/api/affiliate/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { setD(data); setLoading(false) })
      .catch(() => setLoading(false))
  useEffect(() => { load() }, [])

  const savePayout = async (method: string, info: Record<string, string>) => {
    setBusy(true)
    const res = await fetch("/api/affiliate/me", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payout_method: method, payout_info: info }),
    })
    if (!res.ok) { alert((await res.json().catch(() => ({}))).error || t("error")); setBusy(false); return }
    await load(); setBusy(false)
  }

  const cancelWithdraw = async () => {
    if (!confirm(t("cancel_withdraw_confirm"))) return
    setBusy(true)
    await fetch("/api/affiliate/withdraw", { method: "DELETE" })
    await load(); setBusy(false)
  }

  const requestWithdraw = async () => {
    if (!confirm(t("withdraw_confirm", { amount: baht(d?.totals.pending ?? 0) }))) return
    setBusy(true)
    const res = await fetch("/api/affiliate/withdraw", { method: "POST" })
    setBusy(false)
    if (res.ok) { await load(); return }
    const j = await res.json().catch(() => ({}))
    const map: Record<string, string> = {
      NO_PAYOUT_INFO: t("err_no_payout_info"), BELOW_MIN: t("err_below_min", { min: baht(j.min ?? d?.withdraw.min ?? 0) }),
      ALREADY_REQUESTED: t("err_already_requested"), NO_PENDING: t("err_no_pending"),
    }
    alert(map[j.errorCode] || t("error"))
  }

  const origin = typeof window !== "undefined" ? window.location.origin : ""
  const copy = (code: string) => {
    navigator.clipboard?.writeText(`${origin}/r/${code}`)
    setCopied(code)
    setTimeout(() => setCopied(null), 1500)
  }

  const fmtDay = (iso: string) => new Date(iso).toLocaleDateString(locale === "th" ? "th-TH" : "en-GB", { day: "numeric", month: "short" })
  const payoutSet = !!(d?.profile.payout_method && d?.profile.payout_detail)

  return (
    <>
      <Navbar />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* ── Header ── */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-[24px] sm:text-[26px] font-bold">{t("title")}</h1>
            {d?.profile.display_name && <p className="text-text-muted text-[13px] mt-0.5">{d.profile.display_name}</p>}
          </div>
          {d && (
            <div className="flex items-center gap-2">
              <span className="text-[12px] px-3 py-1.5 rounded-full bg-accent/10 text-accent-light font-medium">
                {t("subtitle", { pct: d.profile.default_commission_pct })}
              </span>
              <span className={`text-[11px] px-2.5 py-1 rounded-full font-medium ${d.profile.is_active ? "bg-green-500/15 text-green-400" : "bg-amber-500/15 text-amber-400"}`}>
                {d.profile.is_active ? t("active_badge") : t("paused_badge")}
              </span>
            </div>
          )}
        </div>

        {loading ? (
          <p className="text-text-muted py-16 text-center">{t("loading")}</p>
        ) : !d ? (
          <p className="text-text-muted py-16 text-center">{t("error")}</p>
        ) : (
          <>
            {/* ── KPIs ── */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Kpi icon={<WalletIcon />} label={t("pending")} value={baht(d.totals.pending)} tone="amber" />
              <Kpi icon={<ClockIcon />} label={t("requested")} value={baht(d.totals.requested)} tone="blue" />
              <Kpi icon={<CheckIcon />} label={t("paid")} value={baht(d.totals.paid)} tone="green" />
            </div>

            {/* ── Money zone: Withdraw | Payout info ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* Withdraw */}
              <SectionCard>
                <SectionHeader icon={<WalletIcon />} title={t("withdraw_action_title")} />
                {d.withdraw.open_request ? (
                  <div className="bg-blue-500/[0.06] border border-blue-500/25 rounded-xl p-4">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-300 font-medium">{t("waiting_transfer")}</span>
                      <button onClick={cancelWithdraw} disabled={busy}
                        className="text-[12px] px-3 py-1.5 rounded-lg text-text-muted hover:text-red-400 hover:bg-white/5 border border-white/10 transition-all disabled:opacity-40">
                        {t("cancel_withdraw")}
                      </button>
                    </div>
                    <p className="text-[28px] font-bold text-blue-300 leading-tight mt-2">{baht(d.withdraw.open_request.amount)}</p>
                    {d.withdraw.open_request.eta_from && d.withdraw.open_request.eta_to && (
                      <p className="text-[13px] text-text-base mt-1">
                        {t("eta", { from: fmtDay(d.withdraw.open_request.eta_from), to: fmtDay(d.withdraw.open_request.eta_to) })}
                      </p>
                    )}
                  </div>
                ) : (
                  <div>
                    <p className="text-[11px] text-text-muted uppercase tracking-wider">{t("withdrawable")}</p>
                    <p className="text-[30px] font-bold text-amber-400 leading-tight mt-0.5">{baht(d.totals.pending)}</p>
                    <p className="text-[11px] text-text-muted mt-1">{t("min_note", { min: baht(d.withdraw.min) })}</p>
                    <button onClick={requestWithdraw} disabled={busy || !d.withdraw.can_request}
                      className="w-full mt-4 px-5 py-3 rounded-xl bg-accent text-white text-[14px] font-semibold shadow-lg shadow-accent/20 hover:bg-accent/90 hover:shadow-accent/30 active:scale-[0.98] transition-all disabled:opacity-40 disabled:shadow-none">
                      {t("request_withdraw")}
                    </button>
                    {!payoutSet && <p className="text-[11px] text-amber-500/80 mt-2 text-center">{t("fill_payout_first")}</p>}
                  </div>
                )}
              </SectionCard>

              {/* Payout info */}
              <SectionCard>
                <SectionHeader icon={<BankIcon />} title={t("payout_info_title")} />
                <PayoutForm
                  method0={d.profile.payout_method}
                  info0={d.profile.payout_info}
                  summary={d.profile.payout_detail}
                  locale={locale}
                  busy={busy}
                  onSave={savePayout}
                  t={t}
                />
              </SectionCard>
            </div>

            {/* ── Codes & links ── */}
            <SectionCard>
              <SectionHeader icon={<TagIcon />} title={t("your_codes")} />
              {d.codes.length === 0 ? (
                <p className="text-[13px] text-text-muted">{t("no_codes")}</p>
              ) : (
                <div className="space-y-2">
                  {d.codes.map((c) => (
                    <div key={c.code} className="flex flex-wrap items-center justify-between gap-2 bg-bg-base border border-white/5 rounded-xl px-3.5 py-3 transition-all duration-200 hover:border-accent/25">
                      <div className="min-w-0">
                        <span className="font-mono font-semibold text-[14px]">{c.code}</span>
                        <span className="text-[12px] text-text-muted ml-2">
                          {t("gives")} −{c.type === "fixed" ? `฿${c.value}` : `${c.value}%`}
                          {c.product_name ? ` · ${c.product_name}` : ` · ${t("all_products")}`}
                          {!c.is_active ? ` · ${t("inactive")}` : ""}
                        </span>
                      </div>
                      <button onClick={() => copy(c.code)}
                        className="shrink-0 text-[12px] px-3 py-1.5 rounded-lg bg-accent/15 text-accent-light hover:bg-accent/25 active:scale-95 transition-all">
                        {copied === c.code ? t("copied") : t("copy_link")}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>

            {/* ── Sales log (no buyer identity) ── */}
            <SectionCard noPad>
              <div className="px-5 pt-5 pb-3">
                <SectionHeader icon={<ListIcon />} title={t("sales_log")}
                  right={<span className="text-[12px] text-text-muted">{t("items", { n: d.totals.sales_count })}</span>} />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-[13px] min-w-[520px]">
                  <thead>
                    <tr className="text-left text-[11px] text-text-muted border-y border-white/5 bg-white/[0.015]">
                      <th className="px-5 py-2.5 font-medium">{t("col_date")}</th>
                      <th className="px-4 py-2.5 font-medium">{t("col_product")}</th>
                      <th className="px-4 py-2.5 font-medium text-right">{t("col_sale")}</th>
                      <th className="px-4 py-2.5 font-medium text-right">{t("col_commission")}</th>
                      <th className="px-4 py-2.5 font-medium">{t("col_status")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {d.earnings.length === 0 ? (
                      <tr><td colSpan={5} className="text-center py-10 text-text-muted">{t("no_sales")}</td></tr>
                    ) : d.earnings.map((e) => (
                      <tr key={e.id} className="hover:bg-accent/[0.04] transition-colors">
                        <td className="px-5 py-2.5 text-text-muted">{new Date(e.created_at).toLocaleDateString()}</td>
                        <td className="px-4 py-2.5">{e.product_name ?? "—"}</td>
                        <td className="px-4 py-2.5 text-right font-mono text-text-muted">{baht(e.base_amount)}</td>
                        <td className="px-4 py-2.5 text-right font-mono font-semibold">{baht(e.commission_amount)}</td>
                        <td className="px-4 py-2.5">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                            e.status === "paid" ? "bg-green-500/15 text-green-400"
                            : e.status === "requested" ? "bg-blue-500/15 text-blue-300"
                            : e.status === "reversed" ? "bg-white/10 text-text-muted"
                            : "bg-amber-500/15 text-amber-400"}`}>
                            {t(`status_${e.status}`)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>

            {/* ── Payout history ── */}
            {d.payouts.length > 0 && (
              <SectionCard>
                <SectionHeader icon={<HistoryIcon />} title={t("payout_history")} />
                <div className="divide-y divide-white/5">
                  {d.payouts.map((p) => {
                    const date = p.paid_at ?? p.requested_at
                    return (
                      <div key={p.id} className="text-[13px] py-2.5 first:pt-0 last:pb-0">
                        <div className="flex items-center justify-between">
                          <span className="text-text-muted">
                            {date ? new Date(date).toLocaleDateString() : "—"}{p.method ? ` · ${p.method}` : ""}
                          </span>
                          <span className="flex items-center gap-2">
                            <span className="font-mono font-semibold text-green-400/90">{baht(p.amount)}</span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                              p.status === "paid" ? "bg-green-500/15 text-green-400"
                              : p.status === "rejected" ? "bg-red-500/15 text-red-400"
                              : p.status === "cancelled" ? "bg-white/10 text-text-muted"
                              : "bg-blue-500/15 text-blue-300"}`}>
                              {t(`payout_status_${p.status}`)}
                            </span>
                          </span>
                        </div>
                        {p.status === "rejected" && p.reject_reason && (
                          <p className="text-[11px] text-red-400/80 mt-1">{t("reject_reason_label")}: {p.reject_reason}</p>
                        )}
                      </div>
                    )
                  })}
                </div>
              </SectionCard>
            )}
          </>
        )}
      </main>
    </>
  )
}

// ── Layout helpers (match the admin design language) ──────────────────────────
function SectionCard({ children, noPad }: { children: React.ReactNode; noPad?: boolean }) {
  return (
    <section className={`bg-bg-card border border-accent/10 rounded-2xl transition-colors duration-200 hover:border-accent/20 ${noPad ? "overflow-hidden" : "p-5"}`}>
      {children}
    </section>
  )
}

function SectionHeader({ icon, title, right }: { icon: React.ReactNode; title: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2.5">
        <span className="w-7 h-7 rounded-lg bg-accent/10 text-accent-light flex items-center justify-center shrink-0">{icon}</span>
        <h2 className="text-[14px] font-semibold text-text-base">{title}</h2>
      </div>
      {right}
    </div>
  )
}

const TONES = {
  amber: { text: "text-amber-400", chip: "bg-amber-500/12 text-amber-400" },
  blue: { text: "text-blue-400", chip: "bg-blue-500/12 text-blue-300" },
  green: { text: "text-green-400", chip: "bg-green-500/12 text-green-400" },
} as const

function Kpi({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone: keyof typeof TONES }) {
  const c = TONES[tone]
  return (
    <div className="bg-bg-card border border-accent/10 rounded-2xl p-5 transition-all duration-200 hover:border-accent/25 hover:-translate-y-0.5">
      <div className="flex items-center gap-2.5 mb-2.5">
        <span className={`w-8 h-8 rounded-lg flex items-center justify-center ${c.chip}`}>{icon}</span>
        <p className="text-[11px] tracking-widest text-text-muted uppercase">{label}</p>
      </div>
      <p className={`text-[26px] font-bold leading-none ${c.text}`}>{value}</p>
    </div>
  )
}

// ── Icons (18px, stroke) ──────────────────────────────────────────────────────
const iconProps = { width: 15, height: 15, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const }
function WalletIcon() { return <svg {...iconProps}><path d="M20 12V8H6a2 2 0 0 1-2-2c0-1.1.9-2 2-2h12v4" /><path d="M4 6v12a2 2 0 0 0 2 2h14v-4" /><path d="M18 12a2 2 0 0 0 0 4h4v-4Z" /></svg> }
function ClockIcon() { return <svg {...iconProps}><circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 15 14" /></svg> }
function CheckIcon() { return <svg {...iconProps}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg> }
function BankIcon() { return <svg {...iconProps}><rect x="3" y="5" width="18" height="14" rx="2" /><line x1="3" y1="10" x2="21" y2="10" /></svg> }
function TagIcon() { return <svg {...iconProps}><path d="M20.59 13.41 13.42 20.58a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82Z" /><line x1="7" y1="7" x2="7.01" y2="7" /></svg> }
function ListIcon() { return <svg {...iconProps}><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" /></svg> }
function HistoryIcon() { return <svg {...iconProps}><path d="M3 3v5h5" /><path d="M3.05 13A9 9 0 1 0 6 5.3L3 8" /><polyline points="12 7 12 12 15 14" /></svg> }

// Structured payout-info form: pick a channel, fill its fields, save once. The
// channel definitions + labels come from lib/affiliatePayout so form and server
// stay in sync. Saved info prefills so the affiliate never re-types it.
function PayoutForm({ method0, info0, summary, locale, busy, onSave, t }: {
  method0: string | null; info0: Record<string, string>; summary: string | null
  locale: string; busy: boolean
  onSave: (method: string, info: Record<string, string>) => void
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  t: any
}) {
  const [method, setMethod] = useState(method0 ?? "")
  const [info, setInfo] = useState<Record<string, string>>(info0 ?? {})
  const channel = getChannel(method)
  const inputCls = "w-full bg-bg-base border border-accent/15 rounded-lg px-3 py-2 text-[14px] outline-none focus:border-accent/40 transition"

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-[11px] text-text-muted mb-1 uppercase tracking-wider">{t("payout_method")}</label>
        <select value={method} onChange={(e) => setMethod(e.target.value)} className={inputCls}>
          <option value="">{t("select_channel")}</option>
          {PAYOUT_CHANNELS.map((c) => (
            <option key={c.value} value={c.value}>{locale === "th" ? c.label_th : c.label_en}</option>
          ))}
        </select>
      </div>

      {channel && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {channel.fields.map((f) => (
            <div key={f.key}>
              <label className="block text-[11px] text-text-muted mb-1 uppercase tracking-wider">
                {locale === "th" ? f.label_th : f.label_en}{f.required ? " *" : ""}
              </label>
              <input
                value={info[f.key] ?? ""}
                onChange={(e) => setInfo((p) => ({ ...p, [f.key]: e.target.value }))}
                className={inputCls}
              />
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] text-text-muted truncate">
          {summary ? `${t("saved_as")}: ${summary}` : ""}
        </p>
        <button onClick={() => onSave(method, info)} disabled={busy || !method}
          className="shrink-0 px-4 py-2 rounded-xl bg-accent/15 text-accent-light text-[13px] font-medium hover:bg-accent/25 active:scale-95 transition-all disabled:opacity-40">
          {t("save_payout")}
        </button>
      </div>
    </div>
  )
}
