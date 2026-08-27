// app/admin/DashboardClient.tsx
"use client"

import { useMemo } from "react"
import {
    AreaChart, Area, XAxis, YAxis,
    Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts"
import { format, parseISO } from "date-fns"
import { useTranslations, useLocale } from "next-intl"
import { th, enUS } from "date-fns/locale"
import { Link } from "@/i18n/routing"

type DailyRevenue = { day: string; total: number }
type TopProduct = {
    id: string
    name_th: string | null
    name_en: string | null
    salesCount: number
}
type RecentOrder = {
    id: string
    amount: number
    status: string
    created_at: string | Date
    paid_at: string | Date | null
    users?: { avatar: string | null; username: string | null } | null
    products?: { name_th: string | null; name_en: string | null } | null
    affiliate?: { code: string; name: string | null; via: string } | null
}

// ── Stat Card ──────────────────────────────────────────
// Waterfall: gross → −Stripe fee → −affiliate commission → net.
// Each deduction shows its own breakdown so the number is auditable.
function AffiliateNet({ label, gross, fees, aff, net, t }: {
    label: string
    gross: number
    fees: { fee: number; gross: number; orders: number; unknownCountry: number; byMethod: { method: string; orders: number; gross: number; fee: number }[] }
    aff: { total: number; committed: number; paid: number }
    net: number
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    t: any
}) {
    const baht = (n: number) => `฿${n.toLocaleString(undefined, { minimumFractionDigits: 2 })}`
    return (
        <div className="bg-bg-base/40 border border-white/5 rounded-xl p-4">
            <p className="text-[11px] uppercase tracking-wider text-text-muted mb-2.5">{label}</p>
            <div className="space-y-1.5 text-[13px]">
                <div className="flex justify-between">
                    <span className="text-text-muted">{t("gross_revenue")}</span>
                    <span className="font-mono">{baht(gross)}</span>
                </div>

                {/* Stripe processing fee */}
                <div className="flex justify-between">
                    <span className="text-text-muted">{t("stripe_fee")}</span>
                    <span className="font-mono text-orange-400">−{baht(fees.fee)}</span>
                </div>
                {fees.byMethod.length > 0 && (
                    <div className="text-[11px] text-text-muted/80 text-right space-y-0.5">
                        {fees.byMethod.map((m) => (
                            <p key={m.method}>
                                {m.method} · {t("orders_n", { n: m.orders })} · {baht(m.gross)} → −{baht(m.fee)}
                            </p>
                        ))}
                        {fees.unknownCountry > 0 && (
                            <p className="text-amber-500/80">{t("unknown_country_note", { n: fees.unknownCountry })}</p>
                        )}
                    </div>
                )}

                {/* Affiliate commission */}
                <div className="flex justify-between">
                    <span className="text-text-muted">{t("affiliate_commission")}</span>
                    <span className="font-mono text-red-400">−{baht(aff.total)}</span>
                </div>
                {aff.total > 0 && (
                    <p className="text-[11px] text-text-muted/80 text-right">
                        {t("committed")} {baht(aff.committed)} · {t("paid_out")} {baht(aff.paid)}
                    </p>
                )}

                <div className="border-t border-white/5 !my-2" />
                <div className="flex justify-between items-center">
                    <span className="font-semibold">{t("net_revenue")}</span>
                    <span className="font-mono font-bold text-green-400 text-[15px]">{baht(net)}</span>
                </div>
            </div>
        </div>
    )
}

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
function ChartTooltip({ active, payload, label }: {
    active?: boolean
    payload?: Array<{ value: number | string }>
    label?: string
}) {
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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function DashboardClient({ data }: { data: any }) {
    const t = useTranslations("Admin")
    const locale = useLocale()
    const dateLocale = locale === "th" ? th : enUS

    // Server already sends 7 zero-filled rows keyed by Bangkok calendar day
    // ("YYYY-MM-DD"). parseISO on a date-only string is timezone-free, so the
    // label can't shift no matter what timezone the viewer's browser is in.
    const chartData = useMemo(() => {
        return data.dailyRevenue.map((r: DailyRevenue) => ({
            day: format(parseISO(r.day), "dd MMM", { locale: dateLocale }),
            total: r.total,
        }))
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
                    sub={data.todayManualRevenue > 0
                      ? t("includes_manual", {
                          amount: data.todayManualRevenue.toLocaleString(undefined, { minimumFractionDigits: 0 }),
                          count: data.todayManualCount,
                        })
                      : undefined}
                    color="accent"
                />
                <StatCard
                    label={t("monthly_revenue")}
                    value={`฿${data.monthRevenue.toLocaleString()}`}
                    sub={data.monthManualRevenue > 0
                      ? t("includes_manual", {
                          amount: data.monthManualRevenue.toLocaleString(undefined, { minimumFractionDigits: 0 }),
                          count: data.monthManualCount,
                        })
                      : t("this_month")}
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

            {/* Net revenue after affiliate commission (accrual) */}
            <section className="bg-bg-card border border-accent/10 rounded-2xl p-5">
                <h2 className="text-[14px] font-semibold mb-4">{t("net_after_costs")}</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <AffiliateNet label={t("today")} gross={data.todayRevenue} fees={data.todayFees} aff={data.todayAffiliate} net={data.todayNet} t={t} />
                    <AffiliateNet label={t("this_month")} gross={data.monthRevenue} fees={data.monthFees} aff={data.monthAffiliate} net={data.monthNet} t={t} />
                </div>
            </section>

            {/* Quick Links / Tools */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Link href="/admin/whitelist" className="flex flex-col items-center justify-center p-4 rounded-2xl border border-accent/15 bg-bg-card hover:bg-accent/5 transition-all group">
                    <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-accent-light">
                            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                        </svg>
                    </div>
                    <span className="text-[13px] font-medium">{t("whitelist")}</span>
                </Link>
                <Link href="/admin/users" className="flex flex-col items-center justify-center p-4 rounded-2xl border border-accent/15 bg-bg-card hover:bg-accent/5 transition-all group">
                    <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-purple-400">
                            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
                        </svg>
                    </div>
                    <span className="text-[13px] font-medium">{t("users")}</span>
                </Link>
                <Link href="/admin/products" className="flex flex-col items-center justify-center p-4 rounded-2xl border border-accent/15 bg-bg-card hover:bg-accent/5 transition-all group">
                    <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-green-400">
                            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                        </svg>
                    </div>
                    <span className="text-[13px] font-medium">{t("products")}</span>
                </Link>
                <Link href="/admin/orders" className="flex flex-col items-center justify-center p-4 rounded-2xl border border-accent/15 bg-bg-card hover:bg-accent/5 transition-all group">
                    <div className="w-10 h-10 rounded-full bg-orange-500/10 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-orange-400">
                            <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" /><path d="M3 6h18" /><path d="M16 10a4 4 0 0 1-8 0" />
                        </svg>
                    </div>
                    <span className="text-[13px] font-medium">{t("orders")}</span>
                </Link>
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
                                {data.topSellingProducts.map((p: TopProduct, index: number) => (
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
                    <Link href="/admin/orders"
                        className="text-[12px] text-accent-light hover:underline">
                        {t("view_all")} →
                    </Link>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-[13px] min-w-[740px]">
                        <thead>
                            <tr className="text-left text-[11px] text-text-muted border-b border-white/5">
                                <th className="pb-3 font-medium">{t("user")}</th>
                                <th className="pb-3 font-medium">{t("product")}</th>
                                <th className="pb-3 font-medium">{t("affiliate")}</th>
                                <th className="pb-3 font-medium">{t("amount")}</th>
                                <th className="pb-3 font-medium">{t("status")}</th>
                                <th className="pb-3 font-medium">{t("created_date")}</th>
                                <th className="pb-3 font-medium">{t("paid_date")}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {data.recentOrders.map((o: RecentOrder) => (
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
                                    <td className="py-3">
                                        {o.affiliate ? (
                                            <span className="text-[11px] font-mono text-accent-light bg-accent/10 px-2 py-0.5 rounded whitespace-nowrap">{o.affiliate.code}</span>
                                        ) : (
                                            <span className="text-text-muted">—</span>
                                        )}
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
                                    <td className="py-3 whitespace-nowrap">
                                        {o.paid_at ? (
                                            <span className="text-text-base">
                                                {format(new Date(o.paid_at), "dd MMM HH:mm", { locale: dateLocale })}
                                            </span>
                                        ) : (
                                            <span className="text-text-muted">—</span>
                                        )}
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
