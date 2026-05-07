"use client"

import { useMemo, useState } from "react"
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, PieChart, Pie, Cell, Legend,
} from "recharts"
import { format, parseISO, eachDayOfInterval, subDays } from "date-fns"

// ── helpers ──────────────────────────────────────────
function fmt(n: number) {
  return `฿${Number(n ?? 0).toLocaleString()}`
}

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-bg-card border border-accent/20 rounded-xl px-4 py-2.5 text-[13px] space-y-1">
      <p className="text-text-muted">{label}</p>
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
      <p className={`text-[26px] font-bold leading-none ${color}`}>{value}</p>
      {sub && <p className="text-[12px] text-text-muted mt-1.5">{sub}</p>}
    </div>
  )
}

const COLORS = ["#427ab5", "#5b93cc", "#3ecf8e", "#f0c060", "#e0904a", "#a78bfa"]

// ── main ─────────────────────────────────────────────
export default function AnalyticsClient({ data }: { data: any }) {
  const [revenueView, setRevenueView] = useState<"30d" | "6m">("30d")

  // เติมวันที่ขาดให้ครบ 30 วัน
  const daily30 = useMemo(() => {
    const days = eachDayOfInterval({ start: subDays(new Date(), 29), end: new Date() })
    return days.map((d) => {
      const key = format(d, "yyyy-MM-dd")
      const found = data.dailyRevenue30.find((r: any) =>
        format(parseISO(r.day), "yyyy-MM-dd") === key
      )
      return { day: format(d, "dd MMM"), total: found?.total ?? 0, count: found?.count ?? 0 }
    })
  }, [data.dailyRevenue30])

  // เติมเดือนที่ขาดให้ครบ 6 เดือน
  const monthly6 = useMemo(() => {
    return data.monthlyRevenue.map((m: any) => ({
      month: format(parseISO(m.month), "MMM yyyy"),
      total: m.total,
      count: m.count,
    }))
  }, [data.monthlyRevenue])

  const chartData = revenueView === "30d" ? daily30 : monthly6
  const xKey = revenueView === "30d" ? "day" : "month"

  const statusColors: Record<string, string> = {
    paid: "#3ecf8e",
    pending: "#f0c060",
    expired: "#e0904a",
    cancelled: "#f87171",
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-[24px] font-bold">Analytics</h1>
        <p className="text-text-muted text-[13px] mt-0.5">Sales performance & insights</p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Revenue"
          value={fmt(data.totalStats?.total_revenue)}
          color="text-accent-light"
        />
        <StatCard
          label="Total Orders"
          value={Number(data.totalStats?.total_orders ?? 0).toLocaleString()}
          color="text-text-base"
        />
        <StatCard
          label="Avg. Order Value"
          value={fmt(data.totalStats?.avg_order)}
          color="text-purple-400"
        />
        <StatCard
          label="Unique Customers"
          value={Number(data.totalStats?.unique_customers ?? 0).toLocaleString()}
          color="text-green-400"
        />
      </div>

      {data.netRevenue && (
        <div className="grid grid-cols-3 gap-4">
          <StatCard
            label="Gross Revenue"
            value={fmt(data.netRevenue.total_gross)}
            sub="Before commission"
            color="text-text-base"
          />
          <StatCard
            label="Net Revenue (Ours)"
            value={fmt(data.netRevenue.total_net)}
            sub="After commission deduction"
            color="text-green-400"
          />
          <StatCard
            label="Owner Payout Due"
            value={fmt(data.netRevenue.total_payout)}
            sub="To pay consignment owners"
            color="text-orange-400"
          />
        </div>
      )}

      {/* Revenue Chart */}
      <div className="bg-bg-card border border-accent/10 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="text-[13px] font-semibold">Revenue Over Time</p>
            <p className="text-[11px] text-text-muted mt-0.5">Paid orders only</p>
          </div>
          <div className="flex gap-1 bg-bg-base border border-accent/10 rounded-xl p-1">
            {(["30d", "6m"] as const).map((v) => (
              <button key={v} onClick={() => setRevenueView(v)}
                className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition ${revenueView === v ? "bg-accent/20 text-accent-light" : "text-text-muted hover:text-text-base"
                  }`}>
                {v === "30d" ? "30 Days" : "6 Months"}
              </button>
            ))}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#427ab5" stopOpacity={0.3} />
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

      {/* Top Products + Order Status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Top Products */}
        <div className="lg:col-span-2 bg-bg-card border border-accent/10 rounded-2xl p-5">
          <p className="text-[13px] font-semibold mb-1">Top Products by Revenue</p>
          <p className="text-[11px] text-text-muted mb-5">All time</p>
          <div className="space-y-3">
            {data.topProducts.map((p: any, i: number) => {
              const maxTotal = data.topProducts[0]?.total ?? 1
              const pct = (p.total / maxTotal) * 100
              return (
                <div key={p.product_id}>
                  <div className="flex items-center justify-between text-[13px] mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-text-muted w-4">{i + 1}</span>
                      <span className="font-medium line-clamp-1">{p.name_en}</span>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className="text-[12px] text-text-muted">{p.count} orders</span>
                      <span className="font-semibold text-accent-light">{fmt(p.total)}</span>
                    </div>
                  </div>
                  <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${pct}%`,
                        background: `hsl(${210 + i * 15}, 60%, ${55 - i * 3}%)`,
                      }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Order Status Pie */}
        <div className="bg-bg-card border border-accent/10 rounded-2xl p-5">
          <p className="text-[13px] font-semibold mb-1">Order Status</p>
          <p className="text-[11px] text-text-muted mb-4">All orders</p>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie
                data={data.ordersByStatus}
                dataKey="count"
                nameKey="status"
                cx="50%"
                cy="50%"
                innerRadius={45}
                outerRadius={70}
                paddingAngle={3}
              >
                {data.ordersByStatus.map((entry: any) => (
                  <Cell key={entry.status} fill={statusColors[entry.status] ?? "#7a9bb8"} />
                ))}
              </Pie>
              <Tooltip formatter={(v: any, name: any) => [v, name]} />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-1.5 mt-2">
            {data.ordersByStatus.map((s: any) => (
              <div key={s.status} className="flex items-center justify-between text-[12px]">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ background: statusColors[s.status] ?? "#7a9bb8" }} />
                  <span className="text-text-muted capitalize">{s.status}</span>
                </div>
                <span className="font-medium">{s.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top Variants + Payment Methods */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Top Variants Bar */}
        <div className="bg-bg-card border border-accent/10 rounded-2xl p-5">
          <p className="text-[13px] font-semibold mb-1">Top Variants</p>
          <p className="text-[11px] text-text-muted mb-5">By number of orders</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={data.topVariants} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.05)" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: "#7a9bb8" }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="label_en" tick={{ fontSize: 11, fill: "#7a9bb8" }} axisLine={false} tickLine={false} width={70} />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="count" fill="#427ab5" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Payment Methods */}
        <div className="bg-bg-card border border-accent/10 rounded-2xl p-5">
          <p className="text-[13px] font-semibold mb-1">Payment Methods</p>
          <p className="text-[11px] text-text-muted mb-5">Revenue by method</p>
          <div className="space-y-3">
            {data.ordersByPayment.map((p: any, i: number) => {
              const maxTotal = Math.max(...data.ordersByPayment.map((x: any) => x.total))
              const pct = maxTotal ? (p.total / maxTotal) * 100 : 0
              return (
                <div key={p.payment_method}>
                  <div className="flex justify-between text-[13px] mb-1.5">
                    <div className="flex items-center gap-2">
                      {/* <span className="text-lg">{p.payment_method === "promptpay" ? "📱" : "💳"}</span> */}
                      <span className="font-medium capitalize">{p.payment_method}</span>
                      <span className="text-[11px] text-text-muted">{p.count} orders</span>
                    </div>
                    <span className="font-semibold text-accent-light">{fmt(p.total)}</span>
                  </div>
                  <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: COLORS[i] }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Recent Orders Table */}
      <div className="bg-bg-card border border-accent/10 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
          <div>
            <p className="text-[13px] font-semibold">Recent Orders</p>
            <p className="text-[11px] text-text-muted">Latest {data.recentOrders.length} transactions</p>
          </div>
          <a href="/admin/orders" className="text-[12px] text-accent-light hover:underline">
            View all →
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
                  <td className="px-4 py-3 text-text-muted max-w-[140px] truncate">{o.products?.name_en ?? "—"}</td>
                  <td className="px-4 py-3 text-text-muted">{o.product_variants?.label_en ?? "—"}</td>
                  <td className="px-4 py-3 font-semibold text-accent-light">{fmt(o.amount)}</td>
                  <td className="px-4 py-3">
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-accent/10 text-accent-light capitalize">
                      {o.payment_method ?? "stripe"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${o.status === "paid" ? "bg-green-500/15 text-green-400" :
                        o.status === "pending" ? "bg-orange-500/15 text-orange-400" :
                          o.status === "expired" ? "bg-red-500/15 text-red-400" :
                            "bg-white/5 text-text-muted"
                      }`}>
                      {o.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-text-muted whitespace-nowrap text-[12px]">
                    {o.created_at ? format(new Date(o.created_at), "dd MMM HH:mm") : "—"}
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