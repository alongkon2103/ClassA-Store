// app/admin/DashboardClient.tsx
"use client"

import { useMemo } from "react"
import {
    AreaChart, Area, XAxis, YAxis,
    Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts"
import { format, parseISO, eachDayOfInterval, subDays } from "date-fns"

// ── Stat Card ──────────────────────────────────────────
function StatCard({
    label, value, sub, color = "accent",
}: {
    label: string
    value: string
    sub?: string
    color?: "accent" | "green" | "orange" | "purple"
}) {
    const colors = {
        accent: "from-accent/20 to-accent/5   border-accent/20  text-accent-light",
        green: "from-green-500/15 to-green-500/5 border-green-500/20 text-green-400",
        orange: "from-orange-500/15 to-orange-500/5 border-orange-500/20 text-orange-400",
        purple: "from-purple-500/15 to-purple-500/5 border-purple-500/20 text-purple-400",
    }

    return (
        <div className={`rounded-2xl border bg-gradient-to-br p-5 ${colors[color]}`}>
            <p className="text-[11px] tracking-widest text-text-muted uppercase mb-3">{label}</p>
            <p className={`text-[28px] font-bold leading-none ${colors[color].split(" ").pop()}`}>
                {value}
            </p>
            {sub && <p className="text-[12px] text-text-muted mt-2">{sub}</p>}
        </div>
    )
}

// ── Custom Tooltip ────────────────────────────────────
function ChartTooltip({ active, payload, label }: any) {
    if (!active || !payload?.length) return null
    return (
        <div className="bg-bg-card border border-accent/20 rounded-xl px-4 py-2.5 text-[13px]">
            <p className="text-text-muted mb-1">{label}</p>
            <p className="font-bold text-accent-light">
                ฿{Number(payload[0].value).toLocaleString()}
            </p>
        </div>
    )
}

// ── Status Badge ──────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
    const map: Record<string, string> = {
        paid: "bg-green-500/15 text-green-400",
        pending: "bg-orange-500/15 text-orange-400",
        fulfilled: "bg-accent/15 text-accent-light",
        cancelled: "bg-red-500/15 text-red-400",
    }
    return (
        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${map[status] ?? "bg-white/10 text-text-muted"}`}>
            {status}
        </span>
    )
}

// ── Main ──────────────────────────────────────────────
export default function DashboardClient({ data }: { data: any }) {
    // เติมวันที่ไม่มียอดให้ครบ 7 วัน
    const chartData = useMemo(() => {
        const days = eachDayOfInterval({ start: subDays(new Date(), 6), end: new Date() })
        return days.map((d) => {
            const key = format(d, "yyyy-MM-dd")
            const found = data.dailyRevenue.find((r: any) =>
                format(parseISO(r.day), "yyyy-MM-dd") === key
            )
            return { day: format(d, "dd MMM"), total: found?.total ?? 0 }
        })
    }, [data.dailyRevenue])

    return (
        <div className="space-y-8">
            {/* Header */}
            <div>
                <h1 className="text-[26px] font-bold">Dashboard</h1>
                <p className="text-text-muted text-[13px] mt-1">
                    {format(new Date(), "EEEE, d MMMM yyyy")}
                </p>
            </div>

            {/* Stat Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    label="Today's Revenue"
                    value={`฿${data.todayRevenue.toLocaleString()}`}
                    color="accent"
                />
                <StatCard
                    label="Monthly Revenue"
                    value={`฿${data.monthRevenue.toLocaleString()}`}
                    sub="This month"
                    color="purple"
                />
                <StatCard
                    label="Pending Orders"
                    value={String(data.pendingOrders)}
                    sub="Awaiting fulfillment"
                    color="orange"
                />
                <StatCard
                    label="Active Products"
                    value={String(data.totalProducts)}
                    color="green"
                />
            </div>

            {/* Chart + Low Stock */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Area Chart */}
                <div className="lg:col-span-2 bg-bg-card border border-accent/10 rounded-2xl p-5">
                    <p className="text-[13px] font-semibold mb-1">Revenue — Last 7 Days</p>
                    <p className="text-[11px] text-text-muted mb-5">Daily sales (paid orders)</p>
                    <ResponsiveContainer width="100%" height={200}>
                        <AreaChart data={chartData}>
                            <defs>
                                <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#427ab5" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#427ab5" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.05)" />
                            <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#7a9bb8" }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fontSize: 11, fill: "#7a9bb8" }} axisLine={false} tickLine={false}
                                tickFormatter={(v) => `฿${v.toLocaleString()}`} />
                            <Tooltip content={<ChartTooltip />} />
                            <Area type="monotone" dataKey="total" stroke="#427ab5"
                                strokeWidth={2} fill="url(#grad)" />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>

                {/* Low Stock */}
                <div className="bg-bg-card border border-accent/10 rounded-2xl p-5">
                    <p className="text-[13px] font-semibold mb-1">Low Stock</p>
                    <p className="text-[11px] text-text-muted mb-4">Products flagged as low</p>
                    {data.lowStockProducts.length === 0 ? (
                        <p className="text-[13px] text-text-muted text-center py-8">All good ✓</p>
                    ) : (
                        <div className="space-y-2">
                            {data.lowStockProducts.map((p: any) => (
                                <div key={p.id}
                                    className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-orange-500/5 border border-orange-500/15">
                                    <p className="text-[13px] line-clamp-1 flex-1">{p.name_en}</p>
                                    <span className="text-[10px] text-orange-400 font-medium ml-2 whitespace-nowrap">Low</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Recent Orders */}
            <div className="bg-bg-card border border-accent/10 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-5">
                    <div>
                        <p className="text-[13px] font-semibold">Recent Orders</p>
                        <p className="text-[11px] text-text-muted">Latest {data.recentOrders.length} transactions</p>
                    </div>
                    <a href="/admin/orders"
                        className="text-[12px] text-accent-light hover:underline">
                        View all →
                    </a>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-[13px]">
                        <thead>
                            <tr className="text-left text-[11px] text-text-muted border-b border-white/5">
                                <th className="pb-3 font-medium">User</th>
                                <th className="pb-3 font-medium">Product</th>
                                <th className="pb-3 font-medium">Amount</th>
                                <th className="pb-3 font-medium">Status</th>
                                <th className="pb-3 font-medium">Date</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {data.recentOrders.map((o: any) => (
                                <tr key={o.id} className="hover:bg-white/[0.02] transition">
                                    <td className="py-3">
                                        <div className="flex items-center gap-2">
                                            {o.users?.avatar ? (
                                                <img src={o.users.avatar} className="w-6 h-6 rounded-full object-cover" />
                                            ) : (
                                                <div className="w-6 h-6 rounded-full bg-accent/20 flex items-center justify-center text-[10px]">
                                                    {o.users?.username?.[0]?.toUpperCase()}
                                                </div>
                                            )}
                                            <span className="text-text-base">{o.users?.username ?? "—"}</span>
                                        </div>
                                    </td>
                                    <td className="py-3 text-text-muted line-clamp-1 max-w-[160px]">
                                        {o.products?.name_en ?? "—"}
                                    </td>
                                    <td className="py-3 font-semibold text-accent-light">
                                        ฿{o.amount.toLocaleString()}
                                    </td>
                                    <td className="py-3">
                                        <StatusBadge status={o.status} />
                                    </td>
                                    <td className="py-3 text-text-muted whitespace-nowrap">
                                        {format(new Date(o.created_at), "dd MMM HH:mm")}
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