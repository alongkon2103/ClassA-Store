"use client"

import { useCallback, useEffect, useState } from "react"
import { useTranslations, useLocale } from "next-intl"
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts"

// ── Types (mirror /api/admin/stripe) ─────────────────────────────────────────
type Report = {
  currency: string
  gross: number; fee: number; net: number
  refunds: number; refundCount: number; count: number
  adjustments: number; otherFees: number
  daily: { day: string; gross: number; fee: number; net: number; refunds: number; count: number }[]
}
type Balance = { available: { amount: number; currency: string }[]; pending: { amount: number; currency: string }[] }
type Payout = { id: string; amount: number; currency: string; status: string; method: string | null; created: string; arrival_date: string }
type Data = {
  today: Report; period: Report; balance: Balance; payouts: Payout[]
  meta: { month: string | null; period_from: string; period_to: string; generated_at: string }
}

function last12Months(locale: string) {
  const out: { value: string; label: string }[] = []
  const now = new Date()
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    out.push({
      value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: d.toLocaleString(locale === "th" ? "th-TH" : "en-US", { month: "long", year: "numeric" }),
    })
  }
  return out
}

export default function StripeDashboardPage() {
  const t = useTranslations("AdminStripe")
  const locale = useLocale()
  const months = last12Months(locale)
  const [month, setMonth] = useState("") // "" = current month
  const [d, setD] = useState<Data | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const load = useCallback(async (fresh = false) => {
    if (fresh) setRefreshing(true); else setLoading(true)
    setErr(null)
    try {
      const qs = new URLSearchParams()
      if (month) qs.set("month", month)
      if (fresh) qs.set("fresh", "1")
      const res = await fetch(`/api/admin/stripe?${qs.toString()}`)
      if (!res.ok) { setErr((await res.json().catch(() => ({}))).error || t("load_error")); setD(null) }
      else setD(await res.json())
    } catch {
      setErr(t("load_error"))
    } finally {
      setLoading(false); setRefreshing(false)
    }
  }, [month, t])

  useEffect(() => { load() }, [load])

  const cur = d?.period.currency ?? "thb"
  const money = (n: number, c: string = cur) => {
    const v = n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    return c.toLowerCase() === "thb" ? `฿${v}` : `${v} ${c.toUpperCase()}`
  }
  const marginPct = (r?: Report) => (r && r.gross > 0 ? (r.net / r.gross) * 100 : 0)
  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString(locale === "th" ? "th-TH" : "en-GB", { day: "numeric", month: "short", year: "numeric" })
  const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString(locale === "th" ? "th-TH" : "en-GB", { hour: "2-digit", minute: "2-digit" })
  const dayNum = (day: string) => day.slice(8, 10)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[24px] font-bold flex items-center gap-2">
            <StripeGlyph /> {t("title")}
          </h1>
          <p className="text-text-muted text-[13px] mt-0.5">{t("subtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="bg-bg-card border border-accent/10 rounded-xl px-4 py-2 text-[13px] text-text-base"
          >
            <option value="">{t("current_month")}</option>
            {months.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
          <button
            onClick={() => load(true)}
            disabled={loading || refreshing}
            className="flex items-center gap-1.5 bg-bg-card border border-accent/15 rounded-xl px-3.5 py-2 text-[13px] hover:border-accent/30 transition disabled:opacity-50"
          >
            <RefreshIcon spinning={refreshing} /> {t("refresh")}
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-text-muted py-20 text-center">{t("loading")}</p>
      ) : err ? (
        <div className="bg-red-500/[0.06] border border-red-500/25 rounded-2xl p-6 text-center">
          <p className="text-red-300 text-[14px] font-medium">{err}</p>
          <p className="text-text-muted text-[12px] mt-1">{t("load_error_hint")}</p>
        </div>
      ) : !d ? null : (
        <>
          {/* Live-data banner */}
          <div className="flex items-center gap-2 text-[11px] text-text-muted">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            {t("live_note", { time: fmtTime(d.meta.generated_at) })}
          </div>

          {/* ── TODAY ── */}
          <section>
            <p className="text-[11px] tracking-widest text-text-muted uppercase mb-2.5">{t("today")}</p>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Kpi label={t("gross")} value={money(d.today.gross)} sub={t("n_orders", { n: d.today.count })} tone="base" />
              <Kpi label={t("fee")} value={`−${money(d.today.fee)}`} sub={t("actual_fee")} tone="orange" />
              <Kpi label={t("net")} value={money(d.today.net)} sub={t("margin", { pct: marginPct(d.today).toFixed(1) })} tone="green" />
              <Kpi label={t("refunds")} value={d.today.refunds > 0 ? `−${money(d.today.refunds)}` : money(0)} sub={t("n_refunds", { n: d.today.refundCount })} tone="red" />
            </div>
          </section>

          {/* ── BALANCE ── */}
          <section className="bg-bg-card border border-accent/10 rounded-2xl p-5">
            <p className="text-[11px] tracking-widest text-text-muted uppercase mb-3">{t("balance")}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="text-[11px] text-text-muted mb-1">{t("balance_available")}</p>
                {d.balance.available.length === 0 ? <p className="text-[20px] font-bold">{money(0)}</p> :
                  d.balance.available.map((b, i) => <p key={i} className="text-[22px] font-bold text-green-400 leading-tight">{money(b.amount, b.currency)}</p>)}
              </div>
              <div>
                <p className="text-[11px] text-text-muted mb-1">{t("balance_pending")}</p>
                {d.balance.pending.length === 0 ? <p className="text-[20px] font-bold">{money(0)}</p> :
                  d.balance.pending.map((b, i) => <p key={i} className="text-[22px] font-bold text-blue-300 leading-tight">{money(b.amount, b.currency)}</p>)}
              </div>
            </div>
            <p className="text-[10px] text-text-muted mt-2.5">{t("balance_hint")}</p>
          </section>

          {/* ── PERIOD (month) ── */}
          <section>
            <p className="text-[11px] tracking-widest text-text-muted uppercase mb-2.5">
              {d.meta.month ? months.find((m) => m.value === d.meta.month)?.label ?? t("this_month") : t("this_month")}
            </p>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Kpi label={t("gross")} value={money(d.period.gross)} sub={t("n_orders", { n: d.period.count })} tone="base" />
              <Kpi label={t("fee")} value={`−${money(d.period.fee)}`} sub={t("actual_fee")} tone="orange" />
              <Kpi label={t("net")} value={money(d.period.net)} sub={t("margin", { pct: marginPct(d.period).toFixed(1) })} tone="green" />
              <Kpi label={t("refunds")} value={d.period.refunds > 0 ? `−${money(d.period.refunds)}` : money(0)} sub={t("n_refunds", { n: d.period.refundCount })} tone="red" />
            </div>

            {/* Waterfall recap */}
            <div className="bg-bg-card border border-accent/10 rounded-2xl p-5 mt-4">
              <div className="space-y-1.5 text-[13px] max-w-md">
                <Row label={t("gross")} value={money(d.period.gross)} />
                <Row label={t("fee")} value={`−${money(d.period.fee)}`} tone="text-orange-400" />
                <Row label={t("refunds")} value={d.period.refunds > 0 ? `−${money(d.period.refunds)}` : money(0)} tone="text-red-400" />
                <div className="flex items-center justify-between gap-4 pt-2.5 mt-1 border-t border-white/10">
                  <span className="font-bold">{t("net")}</span>
                  <span className="font-mono font-bold text-green-400 text-[15px]">{money(d.period.net)}</span>
                </div>
              </div>
            </div>

            {/* Daily chart */}
            <div className="bg-bg-card border border-accent/10 rounded-2xl p-5 mt-4">
              <p className="text-[11px] tracking-widest text-text-muted uppercase mb-4">{t("daily_chart")}</p>
              {d.period.daily.every((x) => x.gross === 0 && x.refunds === 0) ? (
                <p className="text-text-muted text-[13px] py-10 text-center">{t("no_data")}</p>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={d.period.daily} margin={{ top: 4, right: 12, left: 4, bottom: 4 }}>
                    <defs>
                      <linearGradient id="stripeNet" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#34d399" /><stop offset="100%" stopColor="#059669" />
                      </linearGradient>
                      <linearGradient id="stripeFee" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#fb923c" /><stop offset="100%" stopColor="#ea7317" />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.05)" vertical={false} />
                    <XAxis dataKey="day" tickFormatter={dayNum} tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                    <YAxis tickFormatter={(v) => `฿${(Number(v) / 1000).toFixed(0)}k`} tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} width={44} />
                    <Tooltip
                      cursor={{ fill: "rgba(148,163,184,0.08)" }}
                      contentStyle={{ background: "#161622", border: "1px solid rgba(148,163,184,.25)", borderRadius: 12, fontSize: 12, color: "#e2e8f0" }}
                      content={<ChartTooltip money={money} t={t} fmtDay={(day: string) => fmtDate(`${day}T00:00:00+07:00`)} />}
                    />
                    <Bar dataKey="net" name={t("net")} stackId="a" fill="url(#stripeNet)" radius={[0, 0, 0, 0]} maxBarSize={26} />
                    <Bar dataKey="fee" name={t("fee")} stackId="a" fill="url(#stripeFee)" radius={[4, 4, 0, 0]} maxBarSize={26} />
                  </BarChart>
                </ResponsiveContainer>
              )}
              <div className="flex items-center gap-4 mt-3 text-[11px] text-text-muted">
                <Legend swatch="#059669" label={t("net")} />
                <Legend swatch="#ea7317" label={t("fee")} />
                <span className="ml-auto">{t("stack_note")}</span>
              </div>
            </div>
          </section>

          {/* ── PAYOUTS ── */}
          <section className="bg-bg-card border border-accent/10 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-white/5">
              <p className="text-[13px] font-semibold">{t("payouts")}</p>
              <p className="text-[11px] text-text-muted mt-0.5">{t("payouts_sub")}</p>
            </div>
            {d.payouts.length === 0 ? (
              <p className="text-text-muted text-[13px] py-10 text-center">{t("no_payouts")}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-[13px] min-w-[560px]">
                  <thead>
                    <tr className="text-left text-[11px] text-text-muted border-b border-white/5 bg-white/[0.02]">
                      <th className="px-5 py-3 font-medium">{t("payout_created")}</th>
                      <th className="px-4 py-3 font-medium">{t("payout_arrival")}</th>
                      <th className="px-4 py-3 font-medium text-right">{t("payout_amount")}</th>
                      <th className="px-4 py-3 font-medium">{t("payout_method")}</th>
                      <th className="px-4 py-3 font-medium text-right">{t("payout_status")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {d.payouts.map((p) => (
                      <tr key={p.id} className="hover:bg-white/[0.02] transition">
                        <td className="px-5 py-3 text-text-muted">{fmtDate(p.created)}</td>
                        <td className="px-4 py-3">{fmtDate(p.arrival_date)}</td>
                        <td className="px-4 py-3 text-right font-mono font-bold">{money(p.amount, p.currency)}</td>
                        <td className="px-4 py-3 text-text-muted">{p.method ? pickLabel(PAYOUT_METHOD_LABEL, p.method, locale) : "—"}</td>
                        <td className="px-4 py-3 text-right"><PayoutStatus status={p.status} locale={locale} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}

// ── Small components ──────────────────────────────────────────────────────────
const TONE = {
  base: "text-text-base",
  orange: "text-orange-400",
  green: "text-green-400",
  red: "text-red-400",
} as const

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone: keyof typeof TONE }) {
  return (
    <div className="bg-bg-card border border-accent/10 rounded-2xl p-5">
      <p className="text-[11px] tracking-widest text-text-muted uppercase mb-2">{label}</p>
      <p className={`text-[22px] font-bold leading-none tabular-nums ${TONE[tone]}`}>{value}</p>
      {sub && <p className="text-[11px] text-text-muted mt-1.5">{sub}</p>}
    </div>
  )
}

function Row({ label, value, tone = "text-text-base" }: { label: string; value: string; tone?: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-1">
      <span className="text-text-muted">{label}</span>
      <span className={`font-mono ${tone}`}>{value}</span>
    </div>
  )
}

function Legend({ swatch, label }: { swatch: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="w-2.5 h-2.5 rounded-sm" style={{ background: swatch }} />
      {label}
    </span>
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ChartTooltip({ active, payload, money, t, fmtDay }: any) {
  if (!active || !payload?.length) return null
  const row = payload[0]?.payload as Report["daily"][number]
  return (
    <div style={{ background: "#161622", border: "1px solid rgba(148,163,184,.25)", borderRadius: 12, padding: "10px 12px", fontSize: 12, color: "#e2e8f0" }}>
      <p style={{ fontWeight: 600, marginBottom: 6 }}>{fmtDay(row.day)}</p>
      <Line c="#e2e8f0" k={t("gross")} v={money(row.gross)} />
      <Line c="#fb923c" k={t("fee")} v={`−${money(row.fee)}`} />
      <Line c="#34d399" k={t("net")} v={money(row.net)} />
      {row.refunds > 0 && <Line c="#f87171" k={t("refunds")} v={`−${money(row.refunds)}`} />}
      <Line c="#94a3b8" k={t("orders")} v={String(row.count)} />
    </div>
  )
}
function Line({ c, k, v }: { c: string; k: string; v: string }) {
  return (
    <p style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
      <span style={{ color: c }}>{k}</span><span style={{ fontVariantNumeric: "tabular-nums" }}>{v}</span>
    </p>
  )
}

// Technical enums from Stripe — localized via inline maps (not i18n) so an
// unexpected value from Stripe renders raw instead of throwing on a missing key.
const PAYOUT_STATUS_LABEL: Record<string, { en: string; th: string }> = {
  paid: { en: "Paid", th: "จ่ายแล้ว" },
  in_transit: { en: "In transit", th: "กำลังโอน" },
  pending: { en: "Pending", th: "รอดำเนินการ" },
  canceled: { en: "Canceled", th: "ยกเลิก" },
  failed: { en: "Failed", th: "ล้มเหลว" },
}
const PAYOUT_METHOD_LABEL: Record<string, { en: string; th: string }> = {
  standard: { en: "Standard", th: "ปกติ" },
  instant: { en: "Instant", th: "ทันที" },
}
function pickLabel(map: Record<string, { en: string; th: string }>, key: string, locale: string): string {
  return map[key]?.[locale === "th" ? "th" : "en"] ?? key
}

function PayoutStatus({ status, locale }: { status: string; locale: string }) {
  const tone: Record<string, string> = {
    paid: "bg-green-500/15 text-green-400",
    in_transit: "bg-blue-500/15 text-blue-300",
    pending: "bg-amber-500/15 text-amber-400",
    canceled: "bg-white/10 text-text-muted",
    failed: "bg-red-500/15 text-red-400",
  }
  return <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${tone[status] ?? "bg-white/10 text-text-muted"}`}>{pickLabel(PAYOUT_STATUS_LABEL, status, locale)}</span>
}

function StripeGlyph() {
  return <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-[#635bff] text-white text-[12px] font-bold">S</span>
}

function RefreshIcon({ spinning }: { spinning: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={spinning ? "animate-spin" : ""}>
      <path d="M21 12a9 9 0 1 1-2.64-6.36" /><polyline points="21 3 21 9 15 9" />
    </svg>
  )
}
