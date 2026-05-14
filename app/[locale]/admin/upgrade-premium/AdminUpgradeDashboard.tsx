"use client"

import { useMemo, useState } from "react"
import { format, subDays, isAfter } from "date-fns"
import { useTranslations, useLocale } from "next-intl"
import { th, enUS } from "date-fns/locale"

type PremiumUpgrade = {
  id: string
  order_id: string
  user_id: string
  product_id: string
  amount: number
  payment_method: string
  stripe_session_id: string | null
  upgraded_at: string
  orders: {
    whitelisted_username: string | null
    tiktok_username: string | null
  }
  users: {
    username: string
    email: string | null
    avatar: string | null
  }
  products: {
    name_th: string
    name_en: string
  }
}

type Props = {
  upgrades: PremiumUpgrade[]
}

// ── Stat Card ─────────────────────────────────────────────────
function StatCard({
  label, value, sub, accent = false,
}: { label: string; value: string | number; sub?: string; accent?: boolean }) {
  return (
    <div className={`relative rounded-2xl p-5 border overflow-hidden ${
      accent
        ? "bg-gradient-to-br from-accent/20 to-accent/5 border-accent/30"
        : "bg-bg-card border-accent/10"
    }`}>
      {/* <div className="absolute top-0 right-0 w-24 h-24 rounded-full bg-accent/5 -translate-y-6 translate-x-6" /> */}
      <p className="text-[11px] text-text-muted uppercase tracking-widest font-medium mb-2">{label}</p>
      <p className={`text-[28px] font-bold leading-none ${accent ? "text-accent-light" : "text-text-base"}`}>
        {value}
      </p>
      {sub && <p className="text-[12px] text-text-muted mt-1.5">{sub}</p>}
    </div>
  )
}

// ── Mini Bar Chart ────────────────────────────────────────────
function MiniBarChart({ data }: { data: { label: string; value: number }[] }) {
  const max = Math.max(...data.map((d) => d.value), 1)
  return (
    <div className="flex items-end gap-1.5 h-16">
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1">
          <div
            className="w-full rounded-t-md bg-accent/40 hover:bg-accent/70 transition-all"
            style={{ height: `${(d.value / max) * 100}%`, minHeight: d.value > 0 ? "4px" : "0" }}
          />
        </div>
      ))}
    </div>
  )
}

export default function AdminUpgradeDashboard({ upgrades }: Props) {
  const t      = useTranslations("AdminUpgrade")
  const locale = useLocale()
  const dateFns = locale === "th" ? th : enUS

  const [search,      setSearch]      = useState("")
  const [methodFilter, setMethodFilter] = useState("all")
  const [range,       setRange]       = useState<7 | 30 | 90>(30)

  // ── Stats ────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const now      = new Date()
    const cutoff   = subDays(now, range)
    const inRange  = upgrades.filter((u) => isAfter(new Date(u.upgraded_at), cutoff))
    const total    = inRange.reduce((s, u) => s + Number(u.amount), 0)
    const count    = inRange.length
    const avgOrder = count > 0 ? total / count : 0

    // by product
    const byProduct: Record<string, { name: string; count: number; revenue: number }> = {}
    for (const u of inRange) {
      const name = locale === "th" ? u.products.name_th : u.products.name_en
      if (!byProduct[u.product_id]) byProduct[u.product_id] = { name, count: 0, revenue: 0 }
      byProduct[u.product_id].count++
      byProduct[u.product_id].revenue += Number(u.amount)
    }

    // daily for chart (last 7 days always)
    const daily = Array.from({ length: 7 }, (_, i) => {
      const day   = subDays(now, 6 - i)
      const dayStr = format(day, "dd")
      const value = upgrades
        .filter((u) => format(new Date(u.upgraded_at), "yyyy-MM-dd") === format(day, "yyyy-MM-dd"))
        .reduce((s, u) => s + Number(u.amount), 0)
      return { label: dayStr, value }
    })

    return { total, count, avgOrder, byProduct, daily, inRange }
  }, [upgrades, range, locale])

  // ── Filtered table ───────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return stats.inRange
      .filter((u) => methodFilter === "all" || u.payment_method === methodFilter)
      .filter((u) =>
        !q ||
        u.users.username.toLowerCase().includes(q) ||
        (u.users.email ?? "").toLowerCase().includes(q) ||
        (locale === "th" ? u.products.name_th : u.products.name_en).toLowerCase().includes(q) ||
        (u.orders.whitelisted_username ?? "").toLowerCase().includes(q)
      )
      .sort((a, b) => new Date(b.upgraded_at).getTime() - new Date(a.upgraded_at).getTime())
  }, [stats.inRange, search, methodFilter, locale])

  const topProducts = Object.values(stats.byProduct)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5)

  return (
    <div className="space-y-6">

      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-[24px] font-bold">{t("title")}</h1>
          <p className="text-text-muted text-[13px] mt-0.5">{t("subtitle")}</p>
        </div>
        {/* Range Picker */}
        <div className="flex gap-1 bg-bg-card border border-accent/15 rounded-xl p-1">
          {([7, 30, 90] as const).map((r) => (
            <button key={r} onClick={() => setRange(r)}
              className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition ${
                range === r ? "bg-accent/20 text-accent-light" : "text-text-muted hover:text-text-base"
              }`}>
              {t("days", { count: r })}
            </button>
          ))}
        </div>
      </div>

      {/* ── Stat Cards ─────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label={t("total_revenue")}
          value={`฿${stats.total.toLocaleString()}`}
          sub={t("in_period", { days: range })}
          accent
        />
        <StatCard
          label={t("total_upgrades")}
          value={stats.count}
          sub={t("transactions")}
        />
        <StatCard
          label={t("avg_order")}
          value={`฿${Math.round(stats.avgOrder).toLocaleString()}`}
          sub={t("per_upgrade")}
        />
        <StatCard
          label={t("all_time")}
          value={upgrades.length}
          sub={t("total_upgrades_ever")}
        />
      </div>

      {/* ── Chart + Top Products ────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Daily Revenue Chart */}
        <div className="lg:col-span-2 bg-bg-card border border-accent/10 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[13px] font-semibold">{t("daily_revenue")}</p>
            <p className="text-[11px] text-text-muted">{t("last_7_days")}</p>
          </div>
          <MiniBarChart data={stats.daily} />
          <div className="flex justify-between mt-2">
            {stats.daily.map((d, i) => (
              <p key={i} className="flex-1 text-center text-[10px] text-text-muted">{d.label}</p>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-white/5 grid grid-cols-3 gap-4">
            {stats.daily.slice(-3).map((d, i) => (
              <div key={i} className="text-center">
                <p className="text-[11px] text-text-muted">{d.label}</p>
                <p className="text-[14px] font-semibold text-accent-light">฿{d.value.toLocaleString()}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Top Products */}
        <div className="bg-bg-card border border-accent/10 rounded-2xl p-5">
          <p className="text-[13px] font-semibold mb-4">{t("top_products")}</p>
          {topProducts.length === 0 ? (
            <p className="text-text-muted text-[13px] text-center py-8">{t("no_data")}</p>
          ) : (
            <div className="space-y-3">
              {topProducts.map((p, i) => {
                const maxRev = topProducts[0].revenue
                return (
                  <div key={i}>
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-[12px] font-medium truncate flex-1 pr-2">{p.name}</p>
                      <p className="text-[12px] text-accent-light font-semibold flex-shrink-0">
                        ฿{p.revenue.toLocaleString()}
                      </p>
                    </div>
                    <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-accent/50 rounded-full transition-all"
                        style={{ width: `${(p.revenue / maxRev) * 100}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-text-muted mt-0.5">
                      {p.count} {t("upgrades_count")}
                    </p>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Table ──────────────────────────────────────────── */}
      <div className="bg-bg-card border border-accent/10 rounded-2xl overflow-hidden">

        {/* Table Header */}
        <div className="px-5 py-4 border-b border-white/5 flex flex-wrap gap-3 items-center justify-between">
          <div>
            <p className="text-[13px] font-semibold">{t("upgrade_history")}</p>
            <p className="text-[11px] text-text-muted">{filtered.length} {t("records")}</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("search")}
              className="bg-bg-base border border-accent/15 rounded-xl px-4 py-2 text-[13px] placeholder:text-text-muted outline-none focus:border-accent/40 w-48"
            />
            <div className="flex gap-1 bg-bg-base border border-accent/15 rounded-xl p-1">
              {["all", "promptpay", "card"].map((m) => (
                <button key={m} onClick={() => setMethodFilter(m)}
                  className={`px-3 py-1 rounded-lg text-[12px] font-medium transition capitalize ${
                    methodFilter === m ? "bg-accent/20 text-accent-light" : "text-text-muted hover:text-text-base"
                  }`}>
                  {m === "all" ? t("all") : m === "promptpay" ? t("promptpay") : t("card")}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left text-[11px] text-text-muted border-b border-white/5 bg-white/[0.02]">
                <th className="px-5 py-3.5 font-medium">{t("col_user")}</th>
                <th className="px-4 py-3.5 font-medium">{t("col_product")}</th>
                <th className="px-4 py-3.5 font-medium">{t("col_username")}</th>
                <th className="px-4 py-3.5 font-medium">{t("col_amount")}</th>
                <th className="px-4 py-3.5 font-medium">{t("col_method")}</th>
                <th className="px-4 py-3.5 font-medium">{t("col_date")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-text-muted">
                    {t("no_data")}
                  </td>
                </tr>
              )}
              {filtered.map((u) => (
                <tr key={u.id} className="hover:bg-white/[0.02] transition">

                  {/* User */}
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      {u.users.avatar ? (
                        <img src={u.users.avatar} className="w-6 h-6 rounded-full object-cover flex-shrink-0" />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-accent/20 flex items-center justify-center text-[10px] flex-shrink-0">
                          {u.users.username?.[0]?.toUpperCase()}
                        </div>
                      )}
                      <div>
                        <p className="font-medium">{u.users.username}</p>
                        <p className="text-[11px] text-text-muted">{u.users.email ?? ""}</p>
                      </div>
                    </div>
                  </td>

                  {/* Product */}
                  <td className="px-4 py-4 text-text-base">
                    {locale === "th" ? u.products.name_th : u.products.name_en}
                  </td>

                  {/* In-game username */}
                  <td className="px-4 py-4">
                    {u.orders.whitelisted_username ? (
                      <span className="font-mono text-[12px] bg-bg-base px-2 py-1 rounded-lg text-accent-light">
                        {u.orders.whitelisted_username}
                      </span>
                    ) : (
                      <span className="text-text-muted">—</span>
                    )}
                  </td>

                  {/* Amount */}
                  <td className="px-4 py-4">
                    <span className="font-semibold text-yellow-400">
                      ฿{Number(u.amount).toLocaleString()}
                    </span>
                  </td>

                  {/* Payment Method */}
                  <td className="px-4 py-4">
                    <span className="text-[11px] px-2 py-0.5 rounded-full capitalize"
                      style={{
                        background: u.payment_method === "promptpay"
                          ? "rgba(27,167,225,.15)" : "rgba(103,114,229,.15)",
                        color: u.payment_method === "promptpay" ? "#1ba7e1" : "#6772e5",
                      }}>
                      {u.payment_method === "promptpay" ? t("promptpay") : t("card")}
                    </span>
                  </td>

                  {/* Date */}
                  <td className="px-4 py-4 text-text-muted text-[12px] whitespace-nowrap">
                    {format(new Date(u.upgraded_at), "dd MMM yyyy HH:mm", { locale: dateFns })}
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