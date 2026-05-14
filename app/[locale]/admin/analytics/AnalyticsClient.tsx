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
function fmtShort(n: number) {
  if (n >= 1_000_000) return `฿${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `฿${(n / 1_000).toFixed(1)}k`
  return `฿${n}`
}

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-bg-card border border-accent/20 rounded-xl px-4 py-2.5 text-[13px] space-y-1">
      <p className="text-text-muted text-[11px]">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }} className="font-semibold">
          {["total", "revenue", "commission", "payout"].includes(p.name) ? fmt(p.value) : p.value}
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

// ── Top Products Table ──────────────────────────────────────────────────────
type SortKey = "total_revenue" | "net_revenue" | "order_count" | "unique_customers" | "avg_order"

function TopProductsTable({ products, locale, t }: { products: any[]; locale: string; t: any }) {
  const [sort, setSort] = useState<SortKey>("total_revenue")
  const [dir,  setDir]  = useState<"desc" | "asc">("desc")

  const sorted = useMemo(() =>
    [...products].sort((a, b) => {
      const va = a[sort] ?? 0
      const vb = b[sort] ?? 0
      return dir === "desc" ? vb - va : va - vb
    }), [products, sort, dir])

  const maxRevenue = sorted[0]?.total_revenue ?? 1

  function toggleSort(key: SortKey) {
    if (sort === key) setDir(d => d === "desc" ? "asc" : "desc")
    else { setSort(key); setDir("desc") }
  }

  function SortTh({ label, k }: { label: string; k: SortKey }) {
    const active = sort === k
    return (
      <th
        onClick={() => toggleSort(k)}
        className={`px-4 py-3 font-medium text-right cursor-pointer select-none whitespace-nowrap transition ${
          active ? "text-accent-light" : "text-text-muted hover:text-text-base"
        }`}
      >
        {label} {active ? (dir === "desc" ? "↓" : "↑") : ""}
      </th>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="text-left text-[11px] border-b border-white/5 bg-white/[0.02]">
            <th className="px-5 py-3 font-medium text-text-muted w-6">#</th>
            <th className="px-4 py-3 font-medium text-text-muted">{t("product")}</th>
            <SortTh label={t("revenue")}    k="total_revenue"    />
            <SortTh label={t("net_profit")} k="net_revenue"      />
            <SortTh label={t("orders")}     k="order_count"      />
            <SortTh label={t("customers")}  k="unique_customers" />
            <SortTh label={t("avg_order")}  k="avg_order"        />
            <th className="px-4 py-3 font-medium text-text-muted text-right">{t("last_sale")}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {sorted.map((p, i) => {
            const name = locale === "th" ? p.name_th : p.name_en
            const revPct = (p.total_revenue / maxRevenue) * 100
            const profitPct = p.total_revenue > 0
              ? (p.net_revenue / p.total_revenue) * 100
              : 0

            return (
              <tr key={p.product_id} className="hover:bg-white/[0.02] transition group">
                {/* # */}
                <td className="px-5 py-3 text-text-muted text-[11px]">{i + 1}</td>

                {/* Product name + consignment badge + bar */}
                <td className="px-4 py-3 min-w-[180px]">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium truncate max-w-[160px]">{name}</span>
                    {p.is_consignment && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-orange-500/15 text-orange-400 flex-shrink-0">
                        Consign {p.commission_pct}%
                      </span>
                    )}
                  </div>
                  {/* Revenue bar */}
                  <div className="h-1 bg-white/5 rounded-full overflow-hidden w-full">
                    <div
                      className="h-full rounded-full bg-accent/60 transition-all"
                      style={{ width: `${revPct}%` }}
                    />
                  </div>
                </td>

                {/* Total Revenue */}
                <td className="px-4 py-3 text-right">
                  <p className="font-semibold text-accent-light">{fmtShort(p.total_revenue)}</p>
                </td>

                {/* Net Revenue + profit % */}
                <td className="px-4 py-3 text-right">
                  <p className="font-semibold text-green-400">{fmtShort(p.net_revenue)}</p>
                  <p className="text-[10px] text-text-muted">{profitPct.toFixed(0)}% {t("margin")}</p>
                </td>

                {/* Orders */}
                <td className="px-4 py-3 text-right font-medium">
                  {p.order_count.toLocaleString()}
                </td>

                {/* Unique Customers */}
                <td className="px-4 py-3 text-right text-text-muted">
                  {p.unique_customers.toLocaleString()}
                </td>

                {/* Avg Order */}
                <td className="px-4 py-3 text-right text-text-muted">
                  {fmtShort(p.avg_order)}
                </td>

                {/* Last Sale */}
                <td className="px-4 py-3 text-right text-text-muted whitespace-nowrap text-[12px]">
                  {p.last_sale
                    ? format(new Date(p.last_sale), "dd MMM yy")
                    : "—"}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ───────────────────────────────────────────────────────────────────────────
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

  const totalPaid    = data.ordersByStatus?.find((s: any) => s.status === "paid")?.count    ?? 0
  const totalPending = data.ordersByStatus?.find((s: any) => s.status === "pending")?.count ?? 0
  const totalExpired = data.ordersByStatus?.find((s: any) => s.status === "expired")?.count ?? 0
  const conversionRate = data.totalStats?.total_orders
    ? ((totalPaid / data.totalStats.total_orders) * 100).toFixed(1)
    : "0"

  const stripeRevenue    = data.ordersByPayment?.find((p: any) => p.payment_method === "stripe")?.total    ?? 0
  const promptpayRevenue = data.ordersByPayment?.find((p: any) => p.payment_method === "promptpay")?.total ?? 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-[24px] font-bold">{t("title")}</h1>
        <p className="text-text-muted text-[13px] mt-0.5">
          {format(new Date(), "EEEE, d MMMM yyyy", { locale: dateLocale })}
        </p>
      </div>

      {/* ── Row 1: Core Stats ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label={t("total_revenue")}    value={fmt(data.totalStats?.total_revenue)}  sub={t("orders_count", { count: data.totalStats?.total_orders ?? 0 })} color="text-accent-light" />
        <StatCard label={t("avg_order_value")}  value={fmt(data.totalStats?.avg_order)}      color="text-purple-400" />
        <StatCard label={t("unique_customers")} value={Number(data.totalStats?.unique_customers ?? 0).toLocaleString()} color="text-green-400" />
        <StatCard label={t("conversion_rate")}  value={`${conversionRate}%`} sub={`${totalPaid} / ${data.totalStats?.total_orders ?? 0}`} color="text-yellow-400" />
      </div>

      {/* ── Row 2: Net Revenue ── */}
      {data.netRevenue && (
        <div className="grid grid-cols-3 gap-3">
          <StatCard label={t("gross_revenue")}    value={fmt(data.netRevenue.total_gross)}  sub={t("before_commission")} color="text-text-base" />
          <StatCard label={t("net_revenue")}      value={fmt(data.netRevenue.total_net)}    sub={t("after_commission")}  color="text-green-400" />
          <StatCard label={t("owner_payout_due")} value={fmt(data.netRevenue.total_payout)} sub={t("consignment_owners")} color="text-orange-400" />
        </div>
      )}

      {/* ── Row 3: Order Status ── */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-bg-card border border-green-500/20  rounded-2xl p-4 text-center">
          <p className="text-[11px] text-text-muted uppercase tracking-widest mb-1">Paid</p>
          <p className="text-[28px] font-bold text-green-400">{totalPaid}</p>
        </div>
        <div className="bg-bg-card border border-orange-500/20 rounded-2xl p-4 text-center">
          <p className="text-[11px] text-text-muted uppercase tracking-widest mb-1">Pending</p>
          <p className="text-[28px] font-bold text-orange-400">{totalPending}</p>
        </div>
        <div className="bg-bg-card border border-red-500/20    rounded-2xl p-4 text-center">
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
        <div className="bg-bg-card border border-accent/10 rounded-2xl overflow-hidden">
          <SectionTitle title={t("payment_methods")} sub={t("revenue_by_channel")} />
          <div className="p-5 space-y-4">
            {[
              { key: "stripe",    label: t("card_stripe"), color: "#6772e5", revenue: stripeRevenue    },
              { key: "promptpay", label: t("promptpay"),   color: "#1ba7e1", revenue: promptpayRevenue },
            ].map(({ key, label, color, revenue }) => (
              <div key={key} className="space-y-1.5">
                <div className="flex items-center justify-between text-[13px]">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
                    <span className="font-medium">{label}</span>
                  </div>
                  <span className="font-semibold text-accent-light">{fmt(revenue)}</span>
                </div>
                <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all"
                    style={{
                      background: color,
                      width: `${stripeRevenue + promptpayRevenue
                        ? (revenue / (stripeRevenue + promptpayRevenue)) * 100
                        : 0}%`,
                    }} />
                </div>
                <p className="text-[11px] text-text-muted">
                  {t("orders_count", { count: data.ordersByPayment?.find((p: any) => p.payment_method === key)?.count ?? 0 })}
                </p>
              </div>
            ))}

            <div className="h-px bg-white/5" />

            <ResponsiveContainer width="100%" height={140}>
              <PieChart>
                <Pie
                  data={[
                    { name: t("card_stripe"), value: stripeRevenue    },
                    { name: t("promptpay"),   value: promptpayRevenue },
                  ]}
                  dataKey="value" nameKey="name"
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

        {/* ── Top Products (full table) ── */}
        <div className="lg:col-span-2 bg-bg-card border border-accent/10 rounded-2xl overflow-hidden">
          <SectionTitle title={t("top_products")} sub={t("top_products_sub")} />
          <TopProductsTable products={data.topProducts} locale={locale} t={t} />
        </div>
      </div>

      {/* ── Row 6: Variants + Order Status ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-bg-card border border-accent/10 rounded-2xl overflow-hidden">
          <SectionTitle title={t("top_variants")} sub={t("by_orders")} />
          <div className="p-5">
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={data.topVariants} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.05)" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: "#7a9bb8" }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey={locale === "th" ? "label_th" : "label_en"}
                  tick={{ fontSize: 11, fill: "#7a9bb8" }} axisLine={false} tickLine={false} width={70} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="count" fill="#427ab5" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-bg-card border border-accent/10 rounded-2xl overflow-hidden">
          <SectionTitle title={t("order_status_distribution")} sub={t("all_time")} />
          <div className="p-5 flex gap-6 items-center">
            <ResponsiveContainer width={160} height={160}>
              <PieChart>
                <Pie data={data.ordersByStatus} dataKey="count" nameKey="status"
                  cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3}>
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

      {/* ── Row 7: Recent Orders ── */}
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
                <th className="px-5 py-3 font-medium">{t("user")}</th>
                <th className="px-4 py-3 font-medium">{t("product")}</th>
                <th className="px-4 py-3 font-medium">{t("variant")}</th>
                <th className="px-4 py-3 font-medium">{t("amount")}</th>
                <th className="px-4 py-3 font-medium">{t("method")}</th>
                <th className="px-4 py-3 font-medium">{t("status")}</th>
                <th className="px-4 py-3 font-medium">{t("date")}</th>
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
                  <td className="px-4 py-3 font-semibold text-accent-light">{fmt(o.amount)}</td>
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

// "use client"

// import { useMemo, useState } from "react"
// import {
//   AreaChart, Area, BarChart, Bar,
//   XAxis, YAxis, Tooltip, ResponsiveContainer,
//   CartesianGrid, PieChart, Pie, Cell,
// } from "recharts"
// import { format, parseISO, eachDayOfInterval, subDays } from "date-fns"
// import { useTranslations, useLocale } from "next-intl"
// import { th, enUS } from "date-fns/locale"
// import { 
//   TrendingUp, Users, ShoppingCart, DollarSign, 
//   ArrowUpRight, CreditCard, Wallet, Package 
// } from "lucide-react"

// // --- Interfaces สำหรับกำหนด Type ---
// interface ChartDataPoint {
//   label: string;
//   total: number;
//   count: number;
// }

// interface AnalyticsData {
//   monthlyRevenue: any[];
//   topProducts: any[];
//   recentOrders: any[];
//   ordersByStatus: { status: string; count: number }[];
//   ordersByPayment: { payment_method: string; total: number; count?: number }[];
//   dailyRevenue30: any[];
//   totalStats: {
//     total_revenue: number;
//     total_orders: number;
//     unique_customers: number;
//     avg_order: number;
//   };
//   netRevenue: {
//     total_gross: number;
//     total_net: number;
//     total_payout: number;
//   };
// }

// // Formatting Utilities
// const fmt = (n: number) => `฿${Number(n ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
// const fmtShort = (n: number) => {
//   if (n >= 1_000_000) return `฿${(n / 1_000_000).toFixed(1)}M`
//   if (n >= 1_000) return `฿${(n / 1_000).toFixed(1)}k`
//   return `฿${Math.floor(n)}`
// }

// function ChartTooltip({ active, payload, label }: any) {
//   if (!active || !payload?.length) return null
//   return (
//     <div className="bg-[#1a1f2e] border border-white/10 rounded-lg p-3 shadow-xl backdrop-blur-md">
//       <p className="text-gray-400 text-[11px] mb-2 font-medium uppercase">{label}</p>
//       {payload.map((p: any) => (
//         <div key={p.name} className="flex items-center gap-3 justify-between">
//           <div className="flex items-center gap-1.5">
//             <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
//             <span className="text-white/70 text-[13px]">{p.name === 'total' ? 'Revenue' : p.name}</span>
//           </div>
//           <span className="text-white font-bold text-[13px]">
//             {typeof p.value === 'number' && p.value > 100 ? fmt(p.value) : p.value}
//           </span>
//         </div>
//       ))}
//     </div>
//   )
// }

// function StatCard({ label, value, sub, icon: Icon, colorClass, trend }: any) {
//   return (
//     <div className="bg-bg-card border border-white/5 rounded-2xl p-5 hover:border-accent/20 transition-all group">
//       <div className="flex justify-between items-start mb-4">
//         <div className={`p-2.5 rounded-xl bg-white/5 group-hover:scale-110 transition-transform ${colorClass}`}>
//           <Icon size={20} />
//         </div>
//         {trend && (
//           <span className="text-[11px] font-medium text-green-400 bg-green-400/10 px-2 py-0.5 rounded-full flex items-center gap-1">
//             <ArrowUpRight size={12} /> {trend}
//           </span>
//         )}
//       </div>
//       <p className="text-[12px] font-medium text-text-muted uppercase tracking-wider">{label}</p>
//       <div className="flex items-baseline gap-2 mt-1">
//         <h3 className="text-2xl font-bold text-text-base tracking-tight">{value}</h3>
//       </div>
//       {sub && <p className="text-[12px] text-text-muted mt-2 flex items-center gap-1.5">{sub}</p>}
//     </div>
//   )
// }

// const STATUS_COLORS: Record<string, string> = {
//   paid: "#10b981", 
//   pending: "#f59e0b", 
//   expired: "#ef4444", 
//   cancelled: "#6b7280", 
// }

// export default function AnalyticsClient({ data }: { data: AnalyticsData }) {
//   const t = useTranslations("Analytics")
//   const locale = useLocale()
//   const dateLocale = locale === "th" ? th : enUS
//   const [revenueView, setRevenueView] = useState<"30d" | "6m">("30d")

//   // ระบุ Type ให้กับ d ใน map เพื่อแก้ Error
//   const chartData = useMemo<ChartDataPoint[]>(() => {
//     if (revenueView === "30d") {
//       const days = eachDayOfInterval({ start: subDays(new Date(), 29), end: new Date() })
//       return days.map((d: Date) => {
//         const key = format(d, "yyyy-MM-dd")
//         const found = data.dailyRevenue30.find((r: any) => format(parseISO(r.day), "yyyy-MM-dd") === key)
//         return { 
//           label: format(d, "dd MMM", { locale: dateLocale }), 
//           total: found?.total ?? 0, 
//           count: found?.count ?? 0 
//         }
//       })
//     }
//     return data.monthlyRevenue.map((m: any) => ({
//       label: format(parseISO(m.month), "MMM yyyy", { locale: dateLocale }),
//       total: m.total,
//       count: m.count,
//     }))
//   }, [revenueView, data, dateLocale])

//   const totalPaid = data.ordersByStatus?.find((s: any) => s.status === "paid")?.count ?? 0
//   const convRate = data.totalStats?.total_orders ? ((totalPaid / data.totalStats.total_orders) * 100).toFixed(1) : "0"

//   // แก้จุดที่ Error โดยระบุ Type ให้ d: ChartDataPoint
//   const maxVal = useMemo(() => {
//     if (chartData.length === 0) return 0;
//     return Math.max(...chartData.map((d: ChartDataPoint) => d.total));
//   }, [chartData]);

//   return (
//     <div className="max-w-[1600px] mx-auto space-y-8 p-2">
//       {/* Header */}
//       <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
//         <div>
//           <h1 className="text-[26px] font-bold">{t("title")}</h1>
          
//           <p className="text-text-muted flex items-center gap-2 mt-1">
//             <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
//             {format(new Date(), "EEEE, d MMMM yyyy", { locale: dateLocale })}
//           </p>
//         </div>
//         <div className="flex p-1 bg-white/5 rounded-xl border border-white/10">
//           {(["30d", "6m"] as const).map((v) => (
//             <button key={v} onClick={() => setRevenueView(v)}
//               className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
//                 revenueView === v ? "bg-accent text-white shadow-lg" : "text-text-muted hover:text-white"
//               }`}>
//               {t(`view_${v}`)}
//             </button>
//           ))}
//         </div>
//       </div>

//       {/* Stats Grid */}
//       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
//         <StatCard 
//           label={t("total_revenue")} 
//           value={fmt(data.totalStats?.total_revenue)} 
//           sub={`${data.totalStats?.total_orders} Orders total`}
//           icon={DollarSign}
//           colorClass="text-blue-400"
//         />
//         <StatCard 
//           label={t("net_profit")} 
//           value={fmt(data.netRevenue?.total_net)} 
//           sub={`Margin: ${((data.netRevenue?.total_net / data.netRevenue?.total_gross) * 100 || 0).toFixed(1)}%`}
//           icon={TrendingUp}
//           colorClass="text-emerald-400"
//         />
//         <StatCard 
//           label={t("unique_customers")} 
//           value={Number(data.totalStats?.unique_customers).toLocaleString()} 
//           sub="Loyal users base"
//           icon={Users}
//           colorClass="text-purple-400"
//         />
//         <StatCard 
//           label={t("conversion_rate")} 
//           value={`${convRate}%`} 
//           sub={`${totalPaid} Successful payments`}
//           icon={ShoppingCart}
//           colorClass="text-amber-400"
//         />
//       </div>

//       <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
//         {/* Main Revenue Chart */}
//         <div className="lg:col-span-2 bg-bg-card border border-white/5 rounded-2xl overflow-hidden shadow-sm">
//           <div className="px-6 py-5 border-b border-white/5 flex justify-between items-center">
//             <div>
//               <h3 className="text-sm font-bold text-white uppercase tracking-wider">{t("revenue_over_time")}</h3>
//               <p className="text-[11px] text-text-muted">Net sales performance monitoring</p>
//             </div>
//             <div className="text-right">
//               <p className="text-xs text-text-muted italic">Peak: {fmtShort(maxVal)}</p>
//             </div>
//           </div>
//           <div className="p-6">
//             <ResponsiveContainer width="100%" height={300}>
//               <AreaChart data={chartData}>
//                 <defs>
//                   <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
//                     <stop offset="5%" stopColor="#427ab5" stopOpacity={0.3}/>
//                     <stop offset="95%" stopColor="#427ab5" stopOpacity={0}/>
//                   </linearGradient>
//                 </defs>
//                 <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
//                 <XAxis dataKey="label" tick={{fontSize: 10, fill: '#64748b'}} axisLine={false} tickLine={false} minTickGap={20} />
//                 <YAxis tick={{fontSize: 10, fill: '#64748b'}} axisLine={false} tickLine={false} tickFormatter={fmtShort} />
//                 <Tooltip content={<ChartTooltip />} cursor={{stroke: '#427ab5', strokeWidth: 1}} />
//                 <Area type="monotone" dataKey="total" name="total" stroke="#427ab5" strokeWidth={3} fillOpacity={1} fill="url(#colorRev)" animationDuration={1500} />
//               </AreaChart>
//             </ResponsiveContainer>
//           </div>
//         </div>

//         {/* Payment & Payouts */}
//         <div className="bg-bg-card border border-white/5 rounded-2xl p-6 space-y-6">
//           <div>
//             <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4">{t("payment_methods")}</h3>
//             <div className="space-y-4">
//               {data.ordersByPayment.map((p: any) => {
//                 const method = p.payment_method?.toLowerCase() || 'stripe'
//                 const color = method === 'promptpay' ? '#1ba7e1' : '#6772e5'
//                 const percentage = (p.total / (data.totalStats.total_revenue || 1) * 100).toFixed(1)
//                 return (
//                   <div key={method} className="space-y-2">
//                     <div className="flex justify-between text-xs">
//                       <span className="text-text-muted flex items-center gap-2">
//                         <CreditCard size={14} className={method === 'promptpay' ? 'text-sky-400' : 'text-indigo-400'} />
//                         {method.toUpperCase()}
//                       </span>
//                       <span className="font-bold text-white">{percentage}%</span>
//                     </div>
//                     <div className="h-2 bg-white/5 rounded-full overflow-hidden">
//                       <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${percentage}%`, backgroundColor: color }} />
//                     </div>
//                   </div>
//                 )
//               })}
//             </div>
//           </div>

//           <div className="pt-6 border-t border-white/5">
//             <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4">Payout Analysis</h3>
//             <div className="bg-white/5 rounded-xl p-4 space-y-3">
//               <div className="flex justify-between items-center">
//                 <span className="text-xs text-text-muted">Total Payout Due</span>
//                 <span className="text-sm font-bold text-orange-400">{fmt(data.netRevenue?.total_payout)}</span>
//               </div>
//               <div className="flex justify-between items-center">
//                 <span className="text-xs text-text-muted">Consignment Fee</span>
//                 <span className="text-sm font-bold text-emerald-400">{fmt(data.netRevenue?.total_gross - data.netRevenue?.total_net - data.netRevenue?.total_payout)}</span>
//               </div>
//             </div>
//           </div>
//         </div>
//       </div>

//       {/* Top Products Table */}
//       <div className="bg-bg-card border border-white/5 rounded-2xl overflow-hidden shadow-sm">
//         <div className="px-6 py-5 border-b border-white/5 flex justify-between items-center">
//           <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
//             <Package size={18} className="text-accent" /> {t("top_products")}
//           </h3>
//           <span className="text-xs text-text-muted">Sorted by Gross Revenue</span>
//         </div>
//         <div className="overflow-x-auto">
//           <table className="w-full text-left">
//             <thead>
//               <tr className="bg-white/[0.01]">
//                 <th className="px-6 py-4 text-[11px] font-bold text-text-muted uppercase tracking-widest">{t("product")}</th>
//                 <th className="px-6 py-4 text-[11px] font-bold text-text-muted uppercase tracking-widest text-center">{t("orders")}</th>
//                 <th className="px-6 py-4 text-[11px] font-bold text-text-muted uppercase tracking-widest text-right">{t("revenue")}</th>
//                 <th className="px-6 py-4 text-[11px] font-bold text-text-muted uppercase tracking-widest text-right">{t("net_profit")}</th>
//                 <th className="px-6 py-4 text-[11px] font-bold text-text-muted uppercase tracking-widest text-right">Avg. Ticket</th>
//               </tr>
//             </thead>
//             <tbody className="divide-y divide-white/5">
//               {data.topProducts.map((p: any) => (
//                 <tr key={p.product_id} className="hover:bg-white/[0.02] transition-colors group">
//                   <td className="px-6 py-4">
//                     <div className="flex flex-col">
//                       <span className="font-semibold text-white group-hover:text-accent transition-colors">
//                         {locale === "th" ? p.name_th : p.name_en}
//                       </span>
//                       {p.is_consignment && (
//                         <span className="text-[10px] text-orange-400 flex items-center gap-1 mt-0.5">
//                           <Wallet size={10} /> Consignment ({p.commission_pct}%)
//                         </span>
//                       )}
//                     </div>
//                   </td>
//                   <td className="px-6 py-4 text-center">
//                     <span className="text-sm font-medium text-text-base">{p.order_count}</span>
//                   </td>
//                   <td className="px-6 py-4 text-right">
//                     <span className="text-sm font-bold text-white">{fmtShort(p.total_revenue)}</span>
//                   </td>
//                   <td className="px-6 py-4 text-right">
//                     <span className="text-sm font-bold text-emerald-400">{fmtShort(p.net_revenue)}</span>
//                   </td>
//                   <td className="px-6 py-4 text-right text-text-muted text-xs">
//                     {fmt(p.avg_order)}
//                   </td>
//                 </tr>
//               ))}
//             </tbody>
//           </table>
//         </div>
//       </div>

//       <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
//          {/* Order Status Distribution */}
//          <div className="bg-bg-card border border-white/5 rounded-2xl p-6">
//             <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-6">{t("order_status_distribution")}</h3>
//             <div className="flex flex-col md:flex-row items-center justify-around gap-8">
//               <div className="relative w-48 h-48">
//                 <ResponsiveContainer width="100%" height="100%">
//                   <PieChart>
//                     <Pie data={data.ordersByStatus} dataKey="count" nameKey="status" innerRadius={60} outerRadius={80} paddingAngle={5}>
//                       {data.ordersByStatus.map((entry: any) => (
//                         <Cell key={entry.status} fill={STATUS_COLORS[entry.status] || "#333"} stroke="none" />
//                       ))}
//                     </Pie>
//                   </PieChart>
//                 </ResponsiveContainer>
//                 <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
//                   <span className="text-2xl font-bold text-white">{data.totalStats.total_orders}</span>
//                   <span className="text-[10px] text-text-muted uppercase">Total</span>
//                 </div>
//               </div>
//               <div className="flex-1 space-y-3 w-full">
//                 {data.ordersByStatus.map((s: any) => (
//                   <div key={s.status} className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/5">
//                     <div className="flex items-center gap-3">
//                       <div className="w-3 h-3 rounded-full" style={{ backgroundColor: STATUS_COLORS[s.status] }} />
//                       <span className="text-xs font-medium text-white capitalize">{s.status}</span>
//                     </div>
//                     <span className="text-xs font-bold text-white">{s.count}</span>
//                   </div>
//                 ))}
//               </div>
//             </div>
//          </div>

//          {/* Recent Orders List */}
//          <div className="bg-bg-card border border-white/5 rounded-2xl overflow-hidden">
//             <div className="px-6 py-5 border-b border-white/5 flex justify-between items-center">
//               <h3 className="text-sm font-bold text-white uppercase tracking-wider">{t("recent_orders")}</h3>
//               <a href="/admin/orders" className="text-xs text-accent hover:underline font-medium">View all orders</a>
//             </div>
//             <div className="p-2 space-y-1">
//               {data.recentOrders.slice(0, 6).map((o: any) => (
//                 <div key={o.id} className="flex items-center justify-between p-3 rounded-xl hover:bg-white/[0.02] transition-colors border border-transparent hover:border-white/5">
//                   <div className="flex items-center gap-3">
//                     <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-xs font-bold text-accent">
//                       {o.users?.username?.[0]?.toUpperCase() || '?'}
//                     </div>
//                     <div className="flex flex-col">
//                       <span className="text-xs font-bold text-white">{o.users?.username}</span>
//                       <span className="text-[10px] text-text-muted truncate max-w-[120px]">
//                         {locale === 'th' ? o.products?.name_th : o.products?.name_en}
//                       </span>
//                     </div>
//                   </div>
//                   <div className="text-right">
//                     <p className="text-xs font-bold text-white">{fmt(o.amount)}</p>
//                     <p className="text-[10px] text-text-muted">{o.created_at ? format(new Date(o.created_at), "HH:mm, dd MMM") : '—'}</p>
//                   </div>
//                 </div>
//               ))}
//             </div>
//          </div>
//       </div>
//     </div>
//   )
// }