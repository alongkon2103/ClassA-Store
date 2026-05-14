// app/admin/DashboardClient.tsx
"use client"

import { useMemo } from "react"
import {
    AreaChart, Area, XAxis, YAxis,
    Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts"
import { format, parseISO, eachDayOfInterval, subDays } from "date-fns"
import { useTranslations, useLocale } from "next-intl"
import { th, enUS } from "date-fns/locale"

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
    const t = useTranslations("Admin")
    const locale = useLocale()
    const dateLocale = locale === "th" ? th : enUS

    // Fill in dates with no sales for the full 7 days
    const chartData = useMemo(() => {
        const days = eachDayOfInterval({ start: subDays(new Date(), 6), end: new Date() })
        return days.map((d) => {
            const key = format(d, "yyyy-MM-dd")
            const found = data.dailyRevenue.find((r: any) =>
                format(parseISO(r.day), "yyyy-MM-dd") === key
            )
            return { day: format(d, "dd MMM", { locale: dateLocale }), total: found?.total ?? 0 }
        })
    }, [data.dailyRevenue, dateLocale])

    return (
        <div className="space-y-8">
            {/* Header */}
            <div>
                <h1 className="text-[26px] font-bold">{t("dashboard")}</h1>
                <p className="text-text-muted text-[13px] mt-1">
                    {format(new Date(), "EEEE, d MMMM yyyy", { locale: dateLocale })}
                </p>
            </div>

            {/* Stat Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    label={t("today_revenue")}
                    value={`฿${data.todayRevenue.toLocaleString()}`}
                    color="accent"
                />
                <StatCard
                    label={t("monthly_revenue")}
                    value={`฿${data.monthRevenue.toLocaleString()}`}
                    sub={t("this_month")}
                    color="purple"
                />
                <StatCard
                    label={t("pending_orders")}
                    value={String(data.pendingOrders)}
                    sub={t("awaiting_fulfillment")}
                    color="orange"
                />
                <StatCard
                    label={t("active_products")}
                    value={String(data.totalProducts)}
                    color="green"
                />
            </div>

            {/* Chart + Low Stock */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Area Chart */}
                <div className="lg:col-span-2 bg-bg-card border border-accent/10 rounded-2xl p-5">
                    <p className="text-[13px] font-semibold mb-1">{t("revenue_7days")}</p>
                    <p className="text-[11px] text-text-muted mb-5">{t("daily_sales")}</p>
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
                {/* <div className="bg-bg-card border border-accent/10 rounded-2xl p-5">
                    <p className="text-[13px] font-semibold mb-1">{t("low_stock")}</p>
                    <p className="text-[11px] text-text-muted mb-4">{t("low_stock_desc")}</p>
                    {data.lowStockProducts.length === 0 ? (
                        <p className="text-[13px] text-text-muted text-center py-8">{t("all_good")} ✓</p>
                    ) : (
                        <div className="space-y-2">
                            {data.lowStockProducts.map((p: any) => (
                                <div key={p.id}
                                    className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-orange-500/5 border border-orange-500/15">
                                    <p className="text-[13px] line-clamp-1 flex-1">
                                        {locale === "th" ? p.name_th : p.name_en}
                                    </p>
                                    <span className="text-[10px] text-orange-400 font-medium ml-2 whitespace-nowrap">
                                        {t("low_stock")}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div> */}
                {/* Chart + Top Selling Products */}
                <div className="grid grid-cols-1 ">
                    {/* Area Chart */}
                    {/* <div className="lg:col-span-2 bg-bg-card border border-accent/10 rounded-2xl p-5">
                        <p className="text-[13px] font-semibold mb-1">{t("revenue_7days")}</p>
                        <p className="text-[11px] text-text-muted mb-5">{t("daily_sales")}</p>

                        <ResponsiveContainer width="100%" height={200}>
                            <AreaChart data={chartData}>
                                <defs>
                                    <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#427ab5" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#427ab5" stopOpacity={0} />
                                    </linearGradient>
                                </defs>

                                <CartesianGrid
                                    strokeDasharray="3 3"
                                    stroke="rgba(255,255,255,.05)"
                                />

                                <XAxis
                                    dataKey="day"
                                    tick={{ fontSize: 11, fill: "#7a9bb8" }}
                                    axisLine={false}
                                    tickLine={false}
                                />

                                <YAxis
                                    tick={{ fontSize: 11, fill: "#7a9bb8" }}
                                    axisLine={false}
                                    tickLine={false}
                                    tickFormatter={(v) => `฿${v.toLocaleString()}`}
                                />

                                <Tooltip content={<ChartTooltip />} />

                                <Area
                                    type="monotone"
                                    dataKey="total"
                                    stroke="#427ab5"
                                    strokeWidth={2}
                                    fill="url(#grad)"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div> */}

                    {/* Top Selling Products */}
                    <div className="bg-bg-card border border-accent/10 rounded-2xl p-5 h-full flex flex-col">
                        <p className="text-[13px] font-semibold mb-1">
                            {t("top_selling_products")}
                        </p>

                        <p className="text-[11px] text-text-muted mb-4">
                            {t("best_sellers_desc")}
                        </p>

                        {data.topSellingProducts.length === 0 ? (
                            <div className="flex-1 flex items-center justify-center">
                                <p className="text-[13px] text-text-muted text-center">
                                    {t("no_sales_yet")}
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-2 flex-1">
                                {data.topSellingProducts.map((p: any, index: number) => (
                                    <div
                                        key={p.id}
                                        className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-accent/5 border border-accent/10"
                                    >
                                        <div className="flex items-center gap-3 flex-1 min-w-0">
                                            <span className="text-[11px] font-bold text-accent-light w-5">
                                                #{index + 1}
                                            </span>

                                            <p className="text-[13px] line-clamp-1">
                                                {locale === "th"
                                                    ? p.name_th ?? p.name_en
                                                    : p.name_en ?? p.name_th}
                                            </p>
                                        </div>

                                        <span className="text-[11px] font-medium text-text-muted whitespace-nowrap ml-2">
                                            {p.salesCount.toLocaleString()} sales
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Recent Orders */}
            <div className="bg-bg-card border border-accent/10 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-5">
                    <div>
                        <p className="text-[13px] font-semibold">{t("recent_orders")}</p>
                        <p className="text-[11px] text-text-muted">
                            {t("latest_transactions", { count: data.recentOrders.length })}
                        </p>
                    </div>
                    <a href="/admin/orders"
                        className="text-[12px] text-accent-light hover:underline">
                        {t("view_all")} →
                    </a>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-[13px]">
                        <thead>
                            <tr className="text-left text-[11px] text-text-muted border-b border-white/5">
                                <th className="pb-3 font-medium">{t("user")}</th>
                                <th className="pb-3 font-medium">{t("product")}</th>
                                <th className="pb-3 font-medium">{t("amount")}</th>
                                <th className="pb-3 font-medium">{t("status")}</th>
                                <th className="pb-3 font-medium">{t("date")}</th>
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
                                        {locale === "th" ? o.products?.name_th : o.products?.name_en ?? "—"}
                                    </td>
                                    <td className="py-3 font-semibold text-accent-light">
                                        ฿{o.amount.toLocaleString()}
                                    </td>
                                    <td className="py-3">
                                        <StatusBadge status={o.status} />
                                    </td>
                                    <td className="py-3 text-text-muted whitespace-nowrap">
                                        {format(new Date(o.created_at), "dd MMM HH:mm", { locale: dateLocale })}
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
