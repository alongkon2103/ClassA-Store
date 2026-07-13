"use client"

// Program-wide affiliate overview — the secondary tab on /admin/affiliates.
// Read-only rollup of every affiliate: totals, monthly commission chart, and a
// leaderboard (each row links to that affiliate's full analytics page).

import { useEffect, useState } from "react"
import { useTranslations, useLocale } from "next-intl"
import { Link } from "@/i18n/routing"
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts"

type Data = {
  totals: {
    affiliate_count: number; active_count: number; total_orders: number; total_sales: number
    total_commission: number; pending: number; requested: number; paid_out: number
    open_requests: { count: number; amount: number }
  }
  leaderboard: { user_id: string; name: string; avatar: string | null; is_active: boolean; orders: number; sales: number; commission: number; pending: number; paid: number }[]
  timeseries: { month: string; commission: number }[]
}

const baht = (n: number) => `฿${n.toLocaleString(undefined, { minimumFractionDigits: 2 })}`
const int = (n: number) => n.toLocaleString()

export default function AffiliatesOverview() {
  const t = useTranslations("AdminAffiliates")
  const locale = useLocale()
  const [d, setD] = useState<Data | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState(false)

  useEffect(() => {
    fetch("/api/admin/affiliates/overview")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => { setD(data); setLoading(false) })
      .catch(() => { setErr(true); setLoading(false) })
  }, [])

  const monthLabel = (ym: string) => {
    const [y, m] = ym.split("-")
    return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString(locale === "th" ? "th-TH" : "en-US", { month: "short" })
  }

  if (loading) return <p className="text-text-muted py-16 text-center">{t("loading")}</p>
  if (err || !d) return <p className="text-text-muted py-16 text-center">{t("error_load")}</p>

  const { totals: s } = d

  return (
    <div className="space-y-6">
      {/* ── Program totals ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Tile label={t("ov_affiliates")} value={`${int(s.active_count)}/${int(s.affiliate_count)}`} sub={t("ov_active_total")} tone="accent" />
        <Tile label={t("stat_orders")} value={int(s.total_orders)} tone="blue" />
        <Tile label={t("stat_sales")} value={baht(s.total_sales)} tone="green" />
        <Tile label={t("stat_commission")} value={baht(s.total_commission)} tone="amber" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Tile label={t("status_pending")} value={baht(s.pending)} tone="amber" />
        <Tile label={t("status_requested")} value={baht(s.requested)} tone="blue" />
        <Tile label={t("ov_paid_out")} value={baht(s.paid_out)} tone="green" />
        <Tile label={t("ov_open_requests")} value={baht(s.open_requests.amount)} sub={t("items", { n: s.open_requests.count })} tone="accent" />
      </div>

      {/* ── Monthly commission chart ── */}
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

      {/* ── Leaderboard ── */}
      <section className="bg-bg-card border border-accent/10 rounded-2xl overflow-hidden">
        <h2 className="text-[14px] font-semibold px-5 pt-5 pb-3">{t("leaderboard")}</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-[12.5px] min-w-[720px]">
            <thead>
              <tr className="text-left text-[11px] text-text-muted border-y border-white/5 bg-white/[0.015]">
                <th className="px-5 py-2.5 font-medium">#</th>
                <th className="px-4 py-2.5 font-medium">{t("col_affiliate")}</th>
                <th className="px-4 py-2.5 font-medium text-right">{t("col_orders")}</th>
                <th className="px-4 py-2.5 font-medium text-right">{t("stat_sales")}</th>
                <th className="px-4 py-2.5 font-medium text-right">{t("col_commission")}</th>
                <th className="px-4 py-2.5 font-medium text-right">{t("status_pending")}</th>
                <th className="px-4 py-2.5 font-medium text-right">{t("status_paid")}</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {d.leaderboard.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-12 text-text-muted">{t("empty")}</td></tr>
              ) : d.leaderboard.map((r, i) => (
                <tr key={r.user_id} className="hover:bg-accent/[0.04] transition-colors">
                  <td className="px-5 py-2.5 text-text-muted font-mono">{i + 1}</td>
                  <td className="px-4 py-2.5">
                    <span className="flex items-center gap-2">
                      {r.avatar
                        ? <img src={r.avatar} alt={r.name} className="w-6 h-6 rounded-full" />
                        : <span className="w-6 h-6 rounded-full bg-accent/15 text-accent-light flex items-center justify-center text-[11px] font-bold">{r.name.charAt(0).toUpperCase()}</span>}
                      <span className="font-medium truncate max-w-[160px]">{r.name}</span>
                      {!r.is_active && <span className="text-[10px] text-text-muted">· {t("inactive")}</span>}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-text-muted">{int(r.orders)}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-text-muted">{baht(r.sales)}</td>
                  <td className="px-4 py-2.5 text-right font-mono font-semibold">{baht(r.commission)}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-amber-400/90">{baht(r.pending)}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-green-400/90">{baht(r.paid)}</td>
                  <td className="px-4 py-2.5 text-right">
                    <Link href={`/admin/affiliates/${r.user_id}`} className="text-[12px] text-accent-light hover:underline">{t("stats")}</Link>
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

const TONES = { accent: "text-accent-light", blue: "text-blue-400", amber: "text-amber-400", green: "text-green-400" } as const
function Tile({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone: keyof typeof TONES }) {
  return (
    <div className="bg-bg-card border border-accent/10 rounded-2xl p-5 transition-all duration-200 hover:border-accent/25">
      <p className="text-[11px] tracking-widest text-text-muted uppercase mb-2">{label}</p>
      <p className={`text-[24px] font-bold leading-none ${TONES[tone]}`}>{value}</p>
      {sub && <p className="text-[11px] text-text-muted mt-1.5">{sub}</p>}
    </div>
  )
}
