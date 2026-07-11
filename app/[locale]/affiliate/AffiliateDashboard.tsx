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

  return (
    <>
      <Navbar />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div>
          <h1 className="text-[24px] font-bold">{t("title")}</h1>
          <p className="text-text-muted text-[13px] mt-0.5">
            {d?.profile.display_name ? `${d.profile.display_name} · ` : ""}
            {t("subtitle", { pct: d?.profile.default_commission_pct ?? 0 })}
          </p>
        </div>

        {loading ? (
          <p className="text-text-muted py-16 text-center">{t("loading")}</p>
        ) : !d ? (
          <p className="text-text-muted py-16 text-center">{t("error")}</p>
        ) : (
          <>
            {/* Summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <Stat label={t("pending")} value={baht(d.totals.pending)} color="text-amber-400" />
              <Stat label={t("requested")} value={baht(d.totals.requested)} color="text-blue-400" />
              <Stat label={t("paid")} value={baht(d.totals.paid)} color="text-green-400" />
              <Stat label={t("sales")} value={String(d.totals.sales_count)} color="text-text-base" />
            </div>

            {!d.profile.is_active && (
              <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl px-5 py-3 text-[13px] text-amber-500/90">
                {t("paused_notice")}
              </div>
            )}

            {/* Withdraw + payout info */}
            <section className="bg-bg-card border border-accent/10 rounded-2xl p-5 space-y-4">
              <p className="text-[11px] uppercase tracking-widest text-text-muted">{t("withdraw_title")}</p>

              <PayoutForm
                method0={d.profile.payout_method}
                info0={d.profile.payout_info}
                summary={d.profile.payout_detail}
                locale={locale}
                busy={busy}
                onSave={savePayout}
                t={t}
              />

              {d.withdraw.open_request ? (
                <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl px-4 py-3.5 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-[13px] font-medium text-blue-300">
                      {t("request_pending")} · {baht(d.withdraw.open_request.amount)}
                    </p>
                    {d.withdraw.open_request.eta_from && d.withdraw.open_request.eta_to && (
                      <p className="text-[12px] text-text-base mt-1">
                        {t("eta", {
                          from: new Date(d.withdraw.open_request.eta_from).toLocaleDateString(locale === "th" ? "th-TH" : "en-GB", { day: "numeric", month: "short" }),
                          to: new Date(d.withdraw.open_request.eta_to).toLocaleDateString(locale === "th" ? "th-TH" : "en-GB", { day: "numeric", month: "short" }),
                        })}
                      </p>
                    )}
                    <p className="text-[11px] text-text-muted mt-0.5">{t("waiting_transfer")}</p>
                  </div>
                  <button onClick={cancelWithdraw} disabled={busy}
                    className="text-[12px] px-3 py-1.5 rounded-lg text-text-muted hover:text-red-400 hover:bg-white/5 border border-white/10 disabled:opacity-40">
                    {t("cancel_withdraw")}
                  </button>
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-[12px] text-text-muted">
                    {t("withdrawable")}: <span className="font-mono font-semibold text-amber-400">{baht(d.totals.pending)}</span>
                    <span className="text-text-muted/70"> · {t("min_note", { min: baht(d.withdraw.min) })}</span>
                  </p>
                  <button onClick={requestWithdraw} disabled={busy || !d.withdraw.can_request}
                    className="px-5 py-2.5 rounded-xl bg-accent text-white text-[13px] font-semibold shadow-lg shadow-accent/20 hover:bg-accent/90 hover:shadow-accent/30 active:scale-95 transition-all disabled:opacity-40 disabled:shadow-none">
                    {t("request_withdraw")}
                  </button>
                </div>
              )}
              {!d.profile.payout_method || !d.profile.payout_detail ? (
                <p className="text-[11px] text-amber-500/80">{t("fill_payout_first")}</p>
              ) : null}
            </section>

            {/* Codes + links */}
            <section className="bg-bg-card border border-accent/10 rounded-2xl p-5 transition-colors duration-200 hover:border-accent/25">
              <p className="text-[11px] uppercase tracking-widest text-text-muted mb-3">{t("your_codes")}</p>
              {d.codes.length === 0 ? (
                <p className="text-[13px] text-text-muted">{t("no_codes")}</p>
              ) : (
                <div className="space-y-2">
                  {d.codes.map((c) => (
                    <div key={c.code} className="flex flex-wrap items-center justify-between gap-2 bg-bg-base border border-white/5 rounded-xl px-3 py-2.5 transition-all duration-200 hover:border-accent/25">
                      <div className="min-w-0">
                        <span className="font-mono font-semibold text-[14px]">{c.code}</span>
                        <span className="text-[12px] text-text-muted ml-2">
                          {t("gives")} −{c.type === "fixed" ? `฿${c.value}` : `${c.value}%`}
                          {c.product_name ? ` · ${c.product_name}` : ` · ${t("all_products")}`}
                          {!c.is_active ? ` · ${t("inactive")}` : ""}
                        </span>
                      </div>
                      <button
                        onClick={() => copy(c.code)}
                        className="shrink-0 text-[12px] px-3 py-1.5 rounded-lg bg-accent/15 text-accent-light hover:bg-accent/25 transition"
                      >
                        {copied === c.code ? t("copied") : t("copy_link")}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Sales log — no buyer identity */}
            <section className="bg-bg-card border border-accent/10 rounded-2xl overflow-hidden">
              <p className="text-[11px] uppercase tracking-widest text-text-muted px-5 pt-5 pb-2">{t("sales_log")}</p>
              <div className="overflow-x-auto">
                <table className="w-full text-[13px] min-w-[520px]">
                  <thead>
                    <tr className="text-left text-[11px] text-text-muted border-b border-white/5">
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
            </section>

            {/* Payout history */}
            {d.payouts.length > 0 && (
              <section className="bg-bg-card border border-accent/10 rounded-2xl p-5 transition-colors duration-200 hover:border-accent/25">
                <p className="text-[11px] uppercase tracking-widest text-text-muted mb-3">{t("payout_history")}</p>
                <div className="space-y-1.5">
                  {d.payouts.map((p) => {
                    const date = p.paid_at ?? p.requested_at
                    return (
                      <div key={p.id} className="text-[13px]">
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
                          <p className="text-[11px] text-red-400/80 mt-0.5">{t("reject_reason_label")}: {p.reject_reason}</p>
                        )}
                      </div>
                    )
                  })}
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </>
  )
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-bg-card border border-accent/10 rounded-2xl p-5 transition-all duration-200 hover:border-accent/25 hover:-translate-y-0.5">
      <p className="text-[11px] tracking-widest text-text-muted uppercase mb-2">{label}</p>
      <p className={`text-[24px] font-bold ${color}`}>{value}</p>
    </div>
  )
}

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
