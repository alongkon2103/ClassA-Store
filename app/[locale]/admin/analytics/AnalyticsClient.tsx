"use client"

import { useMemo, useState } from "react"
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, PieChart, Pie, Cell,
} from "recharts"
import { format, parseISO, eachDayOfInterval, subDays } from "date-fns"
import { useTranslations, useLocale } from "next-intl"
import { th, enUS } from "date-fns/locale"

function fmt(n: number) {
  return `฿${Number(n ?? 0).toLocaleString()}`
}

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-bg-card border border-accent/20 rounded-xl px-4 py-2.5 text-[13px] space-y-1">
      <p className="text-text-muted text-[11px]">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }} className="font-semibold">
          {p.name === "total" || p.name === "revenue" ? fmt(p.value) : p.value}
        </p>
      ))}
    </div>
  )
}

function StatCard({ label, value, sub, color = "text-text-base" }: any) {
  return (
    <div className="bg-bg-card border border-accent/10 rounded-2xl p-5">
      <p className="text-[11px] tracking-widest text-text-muted uppercase mb-2">{label}</p>
      <p className={`text-[24px] font-bold leading-none ${color}`}>{value}</p>
      {sub && <p className="text-[11px] text-text-muted mt-1.5">{sub}</p>}
    </div>
  )
}

function SectionTitle({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="px-5 py-4 border-b border-white/5">
      <p className="text-[13px] font-semibold">{title}</p>
      {sub && <p className="text-[11px] text-text-muted mt-0.5">{sub}</p>}
    </div>
  )
}

const COLORS = ["#427ab5", "#5b93cc", "#3ecf8e", "#f0c060", "#e0904a", "#a78bfa"]

const statusColors: Record<string, string> = {
  paid:      "#3ecf8e",
  pending:   "#f0c060",
  expired:   "#e0904a",
  cancelled: "#f87171",
}

const methodColors: Record<string, string> = {
  stripe:    "#6772e5",
  promptpay: "#1ba7e1",
  card:      "#6772e5",
}

export default function AnalyticsClient({ data }: { data: any }) {
  const t = useTranslations("Analytics")
  const locale = useLocale()
  const dateLocale = locale === "th" ? th : enUS
  const [revenueView, setRevenueView] = useState<"30d" | "6m">("30d")

  const daily30 = useMemo(() => {
    const days = eachDayOfInterval({ start: subDays(new Date(), 29), end: new Date() })
    return days.map((d) => {
      const key   = format(d, "yyyy-MM-dd")
      const found = data.dailyRevenue30.find((r: any) =>
        format(parseISO(r.day), "yyyy-MM-dd") === key
      )
      return {
        day:   format(d, "dd MMM", { locale: dateLocale }),
        total: found?.total ?? 0,
        count: found?.count ?? 0,
      }
    })
  }, [data.dailyRevenue30, dateLocale])

  const monthly6 = useMemo(() => {
    return data.monthlyRevenue.map((m: any) => ({
      month: format(parseISO(m.month), "MMM yyyy", { locale: dateLocale }),
      total: m.total,
      count: m.count,
    }))
  }, [data.monthlyRevenue, dateLocale])

  const chartData = revenueView === "30d" ? daily30 : monthly6
  const xKey      = revenueView === "30d" ? "day" : "month"

  const totalPaid    = data.ordersByStatus?.find((s: any) => s.status === "paid")?.count ?? 0
  const totalPending = data.ordersByStatus?.find((s: any) => s.status === "pending")?.count ?? 0
  const totalExpired = data.ordersByStatus?.find((s: any) => s.status === "expired")?.count ?? 0
  const conversionRate = data.totalStats?.total_orders
    ? ((totalPaid / data.totalStats.total_orders) * 100).toFixed(1)
    : "0"

  const stripeRevenue    = data.ordersByPayment?.find((p: any) => p.payment_method === "stripe")?.total ?? 0
  const promptpayRevenue = data.ordersByPayment?.find((p: any) => p.payment_method === "promptpay")?.total ?? 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[24px] font-bold">{t("title")}</h1>
          <p className="text-text-muted text-[13px] mt-0.5">
            {format(new Date(), "EEEE, d MMMM yyyy", { locale: dateLocale })}
          </p>
        </div>
      </div>

      {/* ── Row 1: Core Stats ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label={t("total_revenue")}
          value={fmt(data.totalStats?.total_revenue)}
          sub={t("orders_count", { count: data.totalStats?.total_orders ?? 0 })}
          color="text-accent-light"
        />
        <StatCard
          label={t("avg_order_value")}
          value={fmt(data.totalStats?.avg_order)}
          color="text-purple-400"
        />
        <StatCard
          label={t("unique_customers")}
          value={Number(data.totalStats?.unique_customers ?? 0).toLocaleString()}
          color="text-green-400"
        />
        <StatCard
          label={t("conversion_rate")}
          value={`${conversionRate}%`}
          sub={`${totalPaid} / ${data.totalStats?.total_orders ?? 0}`}
          color="text-yellow-400"
        />
      </div>

      {/* ── Row 2: Net Revenue (Consignment) ── */}
      {data.netRevenue && (
        <div className="grid grid-cols-3 gap-3">
          <StatCard
            label={t("gross_revenue")}
            value={fmt(data.netRevenue.total_gross)}
            sub={t("before_commission")}
            color="text-text-base"
          />
          <StatCard
            label={t("net_revenue")}
            value={fmt(data.netRevenue.total_net)}
            sub={t("after_commission")}
            color="text-green-400"
          />
          <StatCard
            label={t("owner_payout_due")}
            value={fmt(data.netRevenue.total_payout)}
            sub={t("consignment_owners")}
            color="text-orange-400"
          />
        </div>
      )}

      {/* ── Row 3: Order Status Summary ── */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-bg-card border border-green-500/20 rounded-2xl p-4 text-center">
          <p className="text-[11px] text-text-muted uppercase tracking-widest mb-1">Paid</p>
          <p className="text-[28px] font-bold text-green-400">{totalPaid}</p>
        </div>
        <div className="bg-bg-card border border-orange-500/20 rounded-2xl p-4 text-center">
          <p className="text-[11px] text-text-muted uppercase tracking-widest mb-1">Pending</p>
          <p className="text-[28px] font-bold text-orange-400">{totalPending}</p>
        </div>
        <div className="bg-bg-card border border-red-500/20 rounded-2xl p-4 text-center">
          <p className="text-[11px] text-text-muted uppercase tracking-widest mb-1">Expired</p>
          <p className="text-[28px] font-bold text-red-400">{totalExpired}</p>
        </div>
      </div>

      {/* ── Row 4: Revenue Chart ── */}
      <div className="bg-bg-card border border-accent/10 rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
          <div>
            <p className="text-[13px] font-semibold">{t("revenue_over_time")}</p>
            <p className="text-[11px] text-text-muted mt-0.5">{t("paid_orders_only")}</p>
          </div>
          <div className="flex gap-1 bg-bg-base border border-accent/10 rounded-xl p-1">
            {(["30d", "6m"] as const).map((v) => (
              <button key={v} onClick={() => setRevenueView(v)}
                className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition ${
                  revenueView === v ? "bg-accent/20 text-accent-light" : "text-text-muted hover:text-text-base"
                }`}>
                {t(`view_${v}`)}
              </button>
            ))}
          </div>
        </div>
        <div className="p-5">
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#427ab5" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#427ab5" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.05)" />
              <XAxis dataKey={xKey} tick={{ fontSize: 11, fill: "#7a9bb8" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#7a9bb8" }} axisLine={false} tickLine={false}
                tickFormatter={(v) => `฿${(v / 1000).toFixed(0)}k`} />
              <Tooltip content={<ChartTooltip />} />
              <Area type="monotone" dataKey="total" name="total" stroke="#427ab5" strokeWidth={2} fill="url(#grad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Row 5: Payment Methods ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Payment Method Cards */}
        <div className="bg-bg-card border border-accent/10 rounded-2xl overflow-hidden">
          <SectionTitle title={t("payment_methods")} sub={t("revenue_by_channel")} />
          <div className="p-5 space-y-4">
            {/* Stripe */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[13px]">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#6772e5]" />
                  <span className="font-medium">{t("card_stripe")}</span>
                </div>
                <span className="font-semibold text-accent-light">{fmt(stripeRevenue)}</span>
              </div>
              <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                <div className="h-full rounded-full bg-[#6772e5]"
                  style={{ width: `${stripeRevenue + promptpayRevenue ? (stripeRevenue / (stripeRevenue + promptpayRevenue)) * 100 : 0}%` }} />
              </div>
              <p className="text-[11px] text-text-muted">
                {t("orders_count", { count: data.ordersByPayment?.find((p: any) => p.payment_method === "stripe")?.count ?? 0 })}
              </p>
            </div>

            {/* PromptPay */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[13px]">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#1ba7e1]" />
                  <span className="font-medium">{t("promptpay")}</span>
                </div>
                <span className="font-semibold text-accent-light">{fmt(promptpayRevenue)}</span>
              </div>
              <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                <div className="h-full rounded-full bg-[#1ba7e1]"
                  style={{ width: `${stripeRevenue + promptpayRevenue ? (stripeRevenue / (stripeRevenue + promptpayRevenue)) * 100 : 0}%` }} />
              </div>
              <p className="text-[11px] text-text-muted">
                {t("orders_count", { count: data.ordersByPayment?.find((p: any) => p.payment_method === "promptpay")?.count ?? 0 })}
              </p>
            </div>

            <div className="h-px bg-white/5" />

            {/* Pie */}
            <ResponsiveContainer width="100%" height={140}>
              <PieChart>
                <Pie
                  data={[
                    { name: t("card_stripe"), value: stripeRevenue },
                    { name: t("promptpay"), value: promptpayRevenue },
                  ]}
                  dataKey="value"
                  nameKey="name"
                  cx="50%" cy="50%"
                  innerRadius={35} outerRadius={55}
                  paddingAngle={4}
                >
                  <Cell fill="#6772e5" />
                  <Cell fill="#1ba7e1" />
                </Pie>
                <Tooltip formatter={(v: any) => fmt(v)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Products */}
        <div className="lg:col-span-2 bg-bg-card border border-accent/10 rounded-2xl overflow-hidden">
          <SectionTitle title={t("top_products")} sub={t("all_time")} />
          <div className="p-5 space-y-3">
            {data.topProducts.map((p: any, i: number) => {
              const maxTotal = data.topProducts[0]?.total ?? 1
              const pct = (p.total / maxTotal) * 100
              return (
                <div key={p.product_id}>
                  <div className="flex items-center justify-between text-[13px] mb-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[11px] text-text-muted w-4 flex-shrink-0">{i + 1}</span>
                      <span className="font-medium truncate">{locale === "th" ? p.name_th : p.name_en}</span>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                      <span className="text-[11px] text-text-muted">{t("orders_count", { count: p.count })}</span>
                      <span className="font-semibold text-accent-light">{fmt(p.total)}</span>
                    </div>
                  </div>
                  <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all"
                      style={{
                        width: `${pct}%`,
                        background: `hsl(${210 + i * 15}, 60%, ${55 - i * 3}%)`,
                      }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* ── Row 6: Variants + Order Status ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top Variants */}
        <div className="bg-bg-card border border-accent/10 rounded-2xl overflow-hidden">
          <SectionTitle title={t("top_variants")} sub={t("by_orders")} />
          <div className="p-5">
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={data.topVariants} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.05)" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: "#7a9bb8" }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey={locale === "th" ? "label_th" : "label_en"} tick={{ fontSize: 11, fill: "#7a9bb8" }}
                  axisLine={false} tickLine={false} width={70} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="count" fill="#427ab5" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Order Status Donut */}
        <div className="bg-bg-card border border-accent/10 rounded-2xl overflow-hidden">
          <SectionTitle title={t("order_status_distribution")} sub={t("all_time")} />
          <div className="p-5 flex gap-6 items-center">
            <ResponsiveContainer width={160} height={160}>
              <PieChart>
                <Pie
                  data={data.ordersByStatus}
                  dataKey="count"
                  nameKey="status"
                  cx="50%" cy="50%"
                  innerRadius={45} outerRadius={70}
                  paddingAngle={3}
                >
                  {data.ordersByStatus.map((entry: any) => (
                    <Cell key={entry.status} fill={statusColors[entry.status] ?? "#7a9bb8"} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: any, name: any) => [v, name]} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex-1 space-y-2">
              {data.ordersByStatus.map((s: any) => (
                <div key={s.status} className="flex items-center justify-between text-[13px]">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ background: statusColors[s.status] ?? "#7a9bb8" }} />
                    <span className="text-text-muted capitalize">{s.status}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{s.count}</span>
                    <span className="text-[11px] text-text-muted">
                      ({data.totalStats?.total_orders
                        ? ((s.count / data.totalStats.total_orders) * 100).toFixed(0)
                        : 0}%)
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Row 7: Recent Orders Table ── */}
      <div className="bg-bg-card border border-accent/10 rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
          <div>
            <p className="text-[13px] font-semibold">{t("recent_orders")}</p>
            <p className="text-[11px] text-text-muted">{t("orders_count", { count: data.recentOrders.length })}</p>
          </div>
          <a href="/admin/orders" className="text-[12px] text-accent-light hover:underline">
            {t("view_all")} →
          </a>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left text-[11px] text-text-muted border-b border-white/5 bg-white/[0.02]">
                <th className="px-5 py-3 font-medium">User</th>
                <th className="px-4 py-3 font-medium">Product</th>
                <th className="px-4 py-3 font-medium">Variant</th>
                <th className="px-4 py-3 font-medium">Amount</th>
                <th className="px-4 py-3 font-medium">Method</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {data.recentOrders.map((o: any) => (
                <tr key={o.id} className="hover:bg-white/[0.02] transition">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      {o.users?.avatar ? (
                        <img src={o.users.avatar} className="w-6 h-6 rounded-full object-cover" />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-accent/20 flex items-center justify-center text-[10px]">
                          {o.users?.username?.[0]?.toUpperCase()}
                        </div>
                      )}
                      <span>{o.users?.username ?? "—"}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-text-muted max-w-[130px] truncate">
                    {locale === "th" ? o.products?.name_th : o.products?.name_en ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-text-muted">
                    {locale === "th" ? o.product_variants?.label_th : o.product_variants?.label_en ?? "—"}
                  </td>
                  <td className="px-4 py-3 font-semibold text-accent-light">
                    {fmt(o.amount)}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-[11px] px-2 py-0.5 rounded-full font-medium capitalize"
                      style={{
                        background: `${methodColors[o.payment_method ?? "stripe"]}20`,
                        color: methodColors[o.payment_method ?? "stripe"],
                      }}>
                      {o.payment_method === "promptpay" ? t("promptpay") : t("card_stripe")}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
                      o.status === "paid"    ? "bg-green-500/15 text-green-400"   :
                      o.status === "pending" ? "bg-orange-500/15 text-orange-400" :
                      o.status === "expired" ? "bg-red-500/15 text-red-400"       :
                      "bg-white/5 text-text-muted"
                    }`}>
                      {o.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-text-muted whitespace-nowrap text-[12px]">
                    {o.created_at ? format(new Date(o.created_at), "dd MMM HH:mm", { locale: dateLocale }) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
