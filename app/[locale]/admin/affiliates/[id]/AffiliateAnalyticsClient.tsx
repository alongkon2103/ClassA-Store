"use client"

import { useEffect, useState } from "react"
import { useTranslations, useLocale } from "next-intl"
import { Link } from "@/i18n/routing"
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts"

type StatusAgg = { count: number; amount: number }
type Data = {
  profile: { user_id: string; username: string; email: string | null; avatar: string | null; display_name: string | null; default_commission_pct: number; is_active: boolean }
  summary: {
    total_orders: number; total_sales: number; total_commission: number; avg_sale: number; avg_commission: number
    pending: StatusAgg; requested: StatusAgg; paid: StatusAgg; reversed: StatusAgg; clawback_count: number
  }
  per_code: { code: string; orders: number; sales: number; commission: number }[]
  per_product: { product: string; orders: number; sales: number; commission: number }[]
  timeseries: { month: string; orders: number; sales: number; commission: number }[]
  orders: {
    id: string; date: string; buyer: string | null; buyer_email: string | null; ign: string | null
    product: string | null; payment_method: string | null; sale_amount: number; discount: number
    commission: number; commission_pct: number; status: string; attribution: string; code: string | null
  }[]
}

const baht = (n: number) => `฿${n.toLocaleString(undefined, { minimumFractionDigits: 2 })}`
const int = (n: number) => n.toLocaleString()

export default function AffiliateAnalyticsClient({ id }: { id: string }) {
  const t = useTranslations("AdminAffiliates")
  const locale = useLocale()
  const [d, setD] = useState<Data | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState(false)

  useEffect(() => {
    fetch(`/api/admin/affiliates/${id}/analytics`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => { setD(data); setLoading(false) })
      .catch(() => { setErr(true); setLoading(false) })
  }, [id])

  const monthLabel = (ym: string) => {
    const [y, m] = ym.split("-")
    const dt = new Date(Number(y), Number(m) - 1, 1)
    return dt.toLocaleDateString(locale === "th" ? "th-TH" : "en-US", { month: "short" })
  }
  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString(locale === "th" ? "th-TH" : "en-GB", { day: "numeric", month: "short", year: "2-digit" })

  if (loading) return <p className="text-text-muted py-20 text-center">{t("loading")}</p>
  if (err || !d) return <p className="text-text-muted py-20 text-center">{t("error_load")}</p>

  const s = d.summary
  const name = d.profile.display_name || d.profile.username

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div>
        <Link href="/admin/affiliates" className="text-[12px] text-text-muted hover:text-accent-light transition-colors">← {t("back_to_list")}</Link>
        <div className="flex flex-wrap items-center justify-between gap-3 mt-2">
          <div className="flex items-center gap-3">
            {d.profile.avatar
              ? <img src={d.profile.avatar} alt={name} className="w-11 h-11 rounded-full" />
              : <span className="w-11 h-11 rounded-full bg-accent/15 text-accent-light flex items-center justify-center font-bold">{name.charAt(0).toUpperCase()}</span>}
            <div>
              <h1 className="text-[20px] sm:text-[24px] font-bold leading-tight">{name}</h1>
              <p className="text-[12px] text-text-muted">{d.profile.email} · {t("comm")} {d.profile.default_commission_pct}%
                <span className={`ml-2 text-[11px] px-2 py-0.5 rounded-full ${d.profile.is_active ? "bg-green-500/15 text-green-400" : "bg-white/10 text-text-muted"}`}>
                  {d.profile.is_active ? t("active") : t("inactive")}
                </span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Summary tiles ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Tile label={t("stat_orders")} value={int(s.total_orders)} tone="accent" />
        <Tile label={t("stat_sales")} value={baht(s.total_sales)} tone="blue" />
        <Tile label={t("stat_commission")} value={baht(s.total_commission)} tone="amber" />
        <Tile label={t("stat_avg_comm")} value={baht(s.avg_commission)} tone="green" />
      </div>

      {/* ── Commission by status ── */}
      <section className="bg-bg-card border border-accent/10 rounded-2xl p-5">
        <h2 className="text-[14px] font-semibold mb-4">{t("by_status")}</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatusPill label={t("status_pending")} agg={s.pending} color="text-amber-400" />
          <StatusPill label={t("status_requested")} agg={s.requested} color="text-blue-300" />
          <StatusPill label={t("status_paid")} agg={s.paid} color="text-green-400" />
          <StatusPill label={t("status_reversed")} agg={s.reversed} color="text-text-muted" />
        </div>
        {s.clawback_count > 0 && (
          <p className="text-[12px] text-red-400 mt-3">⚠ {t("clawback_note", { n: s.clawback_count })}</p>
        )}
      </section>

      {/* ── Time series chart ── */}
      <section className="bg-bg-card border border-accent/10 rounded-2xl p-5">
        <h2 className="text-[14px] font-semibold mb-4">{t("commission_over_time")}</h2>
        <div className="h-[240px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={d.timeseries} margin={{ top: 6, right: 6, left: -12, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis dataKey="month" tickFormatter={monthLabel} tick={{ fontSize: 11, fill: "var(--color-text-muted)" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "var(--color-text-muted)" }} axisLine={false} tickLine={false} width={48} />
              <Tooltip
                cursor={{ fill: "rgba(255,255,255,0.04)" }}
                contentStyle={{ background: "var(--color-bg-card)", border: "1px solid var(--color-border-soft)", borderRadius: 12, fontSize: 12 }}
                labelFormatter={(l) => monthLabel(String(l))}
                formatter={(value) => [baht(Number(value)), t("stat_commission")]}
              />
              <Bar dataKey="commission" fill="var(--color-accent)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* ── Per-code + Per-product breakdowns ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Breakdown title={t("by_code")} rows={d.per_code.map((r) => ({ label: r.code, orders: r.orders, sales: r.sales, commission: r.commission }))} t={t} />
        <Breakdown title={t("by_product")} rows={d.per_product.map((r) => ({ label: r.product, orders: r.orders, sales: r.sales, commission: r.commission }))} t={t} />
      </div>

      {/* ── Detailed order log ── */}
      <section className="bg-bg-card border border-accent/10 rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <h2 className="text-[14px] font-semibold">{t("order_log")}</h2>
          <span className="text-[12px] text-text-muted">{t("items", { n: d.orders.length })}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[12.5px] min-w-[860px]">
            <thead>
              <tr className="text-left text-[11px] text-text-muted border-y border-white/5 bg-white/[0.015]">
                <th className="px-5 py-2.5 font-medium">{t("col_date")}</th>
                <th className="px-4 py-2.5 font-medium">{t("col_buyer")}</th>
                <th className="px-4 py-2.5 font-medium">{t("col_product")}</th>
                <th className="px-4 py-2.5 font-medium">{t("col_method")}</th>
                <th className="px-4 py-2.5 font-medium">{t("col_source")}</th>
                <th className="px-4 py-2.5 font-medium text-right">{t("col_sale")}</th>
                <th className="px-4 py-2.5 font-medium text-right">{t("col_commission")}</th>
                <th className="px-4 py-2.5 font-medium">{t("col_status")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {d.orders.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-12 text-text-muted">{t("no_sales")}</td></tr>
              ) : d.orders.map((o) => (
                <tr key={o.id} className="hover:bg-accent/[0.04] transition-colors">
                  <td className="px-5 py-2.5 text-text-muted whitespace-nowrap">{fmtDate(o.date)}</td>
                  <td className="px-4 py-2.5">
                    <p className="truncate max-w-[160px]">{o.buyer ?? "—"}</p>
                    {o.ign && <p className="text-[11px] text-text-muted truncate max-w-[160px]">IGN: {o.ign}</p>}
                  </td>
                  <td className="px-4 py-2.5">{o.product ?? "—"}</td>
                  <td className="px-4 py-2.5 text-text-muted">{o.payment_method ?? "—"}</td>
                  <td className="px-4 py-2.5">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${o.attribution === "referral" ? "bg-blue-500/15 text-blue-300" : o.attribution === "code" ? "bg-accent/15 text-accent-light" : "bg-white/10 text-text-muted"}`}>
                      {o.attribution === "referral" ? t("src_referral") : o.attribution === "code" ? t("src_code") : "—"}
                    </span>
                    {o.code && <span className="text-[11px] text-text-muted ml-1.5 font-mono">{o.code}</span>}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-text-muted">{baht(o.sale_amount)}</td>
                  <td className="px-4 py-2.5 text-right font-mono font-semibold">{baht(o.commission)}</td>
                  <td className="px-4 py-2.5">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                      o.status === "paid" ? "bg-green-500/15 text-green-400"
                      : o.status === "requested" ? "bg-blue-500/15 text-blue-300"
                      : o.status === "reversed" ? "bg-white/10 text-text-muted"
                      : "bg-amber-500/15 text-amber-400"}`}>
                      {t(`status_${o.status}`)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

const TILE_TONES = {
  accent: "text-accent-light", blue: "text-blue-400", amber: "text-amber-400", green: "text-green-400",
} as const
function Tile({ label, value, tone }: { label: string; value: string; tone: keyof typeof TILE_TONES }) {
  return (
    <div className="bg-bg-card border border-accent/10 rounded-2xl p-5 transition-all duration-200 hover:border-accent/25">
      <p className="text-[11px] tracking-widest text-text-muted uppercase mb-2">{label}</p>
      <p className={`text-[24px] font-bold leading-none ${TILE_TONES[tone]}`}>{value}</p>
    </div>
  )
}

function StatusPill({ label, agg, color }: { label: string; agg: StatusAgg; color: string }) {
  return (
    <div className="bg-bg-base border border-white/5 rounded-xl px-4 py-3">
      <p className="text-[11px] text-text-muted uppercase tracking-wider">{label}</p>
      <p className={`text-[18px] font-bold mt-1 ${color}`}>{baht(agg.amount)}</p>
      <p className="text-[11px] text-text-muted">{int(agg.count)}</p>
    </div>
  )
}

function Breakdown({ title, rows, t }: {
  title: string
  rows: { label: string; orders: number; sales: number; commission: number }[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  t: any
}) {
  return (
    <section className="bg-bg-card border border-accent/10 rounded-2xl overflow-hidden">
      <h2 className="text-[14px] font-semibold px-5 pt-5 pb-3">{title}</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-[12.5px] min-w-[380px]">
          <thead>
            <tr className="text-left text-[11px] text-text-muted border-y border-white/5 bg-white/[0.015]">
              <th className="px-5 py-2.5 font-medium">{title}</th>
              <th className="px-4 py-2.5 font-medium text-right">{t("col_orders")}</th>
              <th className="px-4 py-2.5 font-medium text-right">{t("col_sale")}</th>
              <th className="px-4 py-2.5 font-medium text-right">{t("col_commission")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {rows.length === 0 ? (
              <tr><td colSpan={4} className="text-center py-8 text-text-muted">{t("no_sales")}</td></tr>
            ) : rows.map((r) => (
              <tr key={r.label} className="hover:bg-accent/[0.04] transition-colors">
                <td className="px-5 py-2.5 font-medium truncate max-w-[180px]">{r.label}</td>
                <td className="px-4 py-2.5 text-right font-mono text-text-muted">{int(r.orders)}</td>
                <td className="px-4 py-2.5 text-right font-mono text-text-muted">{baht(r.sales)}</td>
                <td className="px-4 py-2.5 text-right font-mono font-semibold">{baht(r.commission)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
