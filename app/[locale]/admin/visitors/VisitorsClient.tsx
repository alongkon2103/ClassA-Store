"use client"

import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, PieChart, Pie, Cell, Legend,
} from "recharts"
import { format, parseISO } from "date-fns"
import { useTranslations, useLocale } from "next-intl"
import { th as thLocale, enUS } from "date-fns/locale"

type Row = {
  date: string
  total_views: number
  unique_visitors: number
  new_visitors: number
  logged_in_views: number
}

type PathRow = { path: string; views: number; visitors: number }

type Props = {
  data: {
    dailyStats: Row[]
    today: {
      date: string
      total_views: number
      unique_visitors: number
      logged_in_views: number
    }
    totals30: { total_views: number; unique_visitors: number }
    todayTopPaths: PathRow[]
    last30TopPaths: PathRow[]
    deviceBreakdown: { device: string | null; count: number }[]
    countryBreakdown: { country: string | null; count: number }[]
    last24hHourly: { hour: string; views: number; visitors: number }[]
  }
}

const COLORS = ["#427ab5", "#3ecf8e", "#f0c060", "#a78bfa", "#e0904a", "#f87171"]

type StatCardProps = {
  label: string
  value: string
  sub?: string
  color?: string
}

function StatCard({ label, value, sub, color = "text-text-base" }: StatCardProps) {
  return (
    <div className="bg-bg-card border border-accent/10 rounded-2xl p-5">
      <p className="text-[11px] tracking-widest text-text-muted uppercase mb-2">{label}</p>
      <p className={`text-[24px] font-bold leading-none ${color}`}>{value}</p>
      {sub && <p className="text-[11px] text-text-muted mt-1.5">{sub}</p>}
    </div>
  )
}

type TooltipEntry = { name?: string; value?: number | string; color?: string }

type ChartTooltipProps = {
  active?: boolean
  payload?: TooltipEntry[]
  label?: string | number
}

function ChartTooltip({ active, payload, label }: ChartTooltipProps) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-bg-card border border-accent/20 rounded-xl px-4 py-2.5 text-[13px] space-y-1">
      <p className="text-text-muted text-[11px]">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }} className="font-semibold">
          {p.name}: {Number(p.value).toLocaleString()}
        </p>
      ))}
    </div>
  )
}

export default function VisitorsClient({ data }: Props) {
  const t = useTranslations("Visitors")
  const locale = useLocale()
  const dfLocale = locale === "th" ? thLocale : enUS

  const merged = [
    ...data.dailyStats,
    {
      date: data.today.date,
      total_views: data.today.total_views,
      unique_visitors: data.today.unique_visitors,
      new_visitors: 0,
      logged_in_views: data.today.logged_in_views,
    },
  ].reduce<Row[]>((acc, r) => {
    const exists = acc.find(x => x.date === r.date)
    if (exists) {
      exists.total_views = Math.max(exists.total_views, r.total_views)
      exists.unique_visitors = Math.max(exists.unique_visitors, r.unique_visitors)
      exists.logged_in_views = Math.max(exists.logged_in_views, r.logged_in_views)
    } else {
      acc.push(r)
    }
    return acc
  }, [])

  const chartData = merged.map(r => ({
    date: format(parseISO(r.date), "MMM d", { locale: dfLocale }),
    views: r.total_views,
    visitors: r.unique_visitors,
  }))

  const hourlyChart = data.last24hHourly.map(r => ({
    hour: format(parseISO(r.hour), "HH:mm"),
    views: r.views,
    visitors: r.visitors,
  }))

  const deviceData = data.deviceBreakdown.map(d => ({
    name: d.device || "unknown",
    value: d.count,
  }))

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-[22px] font-bold">{t("title")}</h1>
        <p className="text-[12px] text-text-muted mt-1">{t("subtitle")}</p>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label={t("today_visitors")}
          value={data.today.unique_visitors.toLocaleString()}
          sub={t("today_views_sub", { count: data.today.total_views })}
          color="text-accent-light"
        />
        <StatCard
          label={t("today_logged_in")}
          value={data.today.logged_in_views.toLocaleString()}
          sub={t("logged_in_sub")}
          color="text-emerald-400"
        />
        <StatCard
          label={t("last30_visitors")}
          value={data.totals30.unique_visitors.toLocaleString()}
          sub={t("last30_sub")}
        />
        <StatCard
          label={t("last30_views")}
          value={data.totals30.total_views.toLocaleString()}
          sub={t("last30_views_sub")}
        />
      </div>

      {/* 30-day chart */}
      <div className="bg-bg-card border border-accent/10 rounded-2xl">
        <div className="px-5 py-4 border-b border-white/5">
          <p className="text-[13px] font-semibold">{t("trend_title")}</p>
          <p className="text-[11px] text-text-muted mt-0.5">{t("trend_sub")}</p>
        </div>
        <div className="p-4 h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="gView" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#427ab5" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#427ab5" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gVis" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3ecf8e" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#3ecf8e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#888" }} />
              <YAxis tick={{ fontSize: 11, fill: "#888" }} />
              <Tooltip content={<ChartTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Area type="monotone" dataKey="views" stroke="#427ab5" fill="url(#gView)" strokeWidth={2} name={t("legend_views")} />
              <Area type="monotone" dataKey="visitors" stroke="#3ecf8e" fill="url(#gVis)" strokeWidth={2} name={t("legend_visitors")} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 24-hour live + Devices */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-bg-card border border-accent/10 rounded-2xl">
          <div className="px-5 py-4 border-b border-white/5">
            <p className="text-[13px] font-semibold">{t("hourly_title")}</p>
            <p className="text-[11px] text-text-muted mt-0.5">{t("hourly_sub")}</p>
          </div>
          <div className="p-4 h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={hourlyChart}>
                <CartesianGrid stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="hour" tick={{ fontSize: 11, fill: "#888" }} />
                <YAxis tick={{ fontSize: 11, fill: "#888" }} />
                <Tooltip content={<ChartTooltip />} />
                <Line type="monotone" dataKey="views" stroke="#427ab5" strokeWidth={2} dot={false} name={t("legend_views")} />
                <Line type="monotone" dataKey="visitors" stroke="#3ecf8e" strokeWidth={2} dot={false} name={t("legend_visitors")} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-bg-card border border-accent/10 rounded-2xl">
          <div className="px-5 py-4 border-b border-white/5">
            <p className="text-[13px] font-semibold">{t("device_title")}</p>
            <p className="text-[11px] text-text-muted mt-0.5">{t("device_sub")}</p>
          </div>
          <div className="p-4 h-[240px]">
            {deviceData.length === 0 ? (
              <div className="flex items-center justify-center h-full text-text-muted text-[12px]">{t("no_data")}</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={deviceData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={75}>
                    {deviceData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<ChartTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Top Paths + Countries */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-bg-card border border-accent/10 rounded-2xl">
          <div className="px-5 py-4 border-b border-white/5">
            <p className="text-[13px] font-semibold">{t("top_paths_title")}</p>
            <p className="text-[11px] text-text-muted mt-0.5">{t("top_paths_sub")}</p>
          </div>
          <div className="divide-y divide-white/5">
            {data.last30TopPaths.length === 0 ? (
              <p className="px-5 py-8 text-center text-text-muted text-[12px]">{t("no_data")}</p>
            ) : (
              data.last30TopPaths.map((p, i) => (
                <div key={p.path} className="px-5 py-3 flex items-center gap-3">
                  <span className="text-text-muted text-[11px] w-5">{i + 1}</span>
                  <span className="flex-1 text-[12px] font-mono truncate" title={p.path}>{p.path}</span>
                  <span className="text-[12px] font-semibold text-accent-light">{p.views.toLocaleString()}</span>
                  <span className="text-[11px] text-text-muted w-16 text-right">{p.visitors.toLocaleString()} {t("uniq_short")}</span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-bg-card border border-accent/10 rounded-2xl">
          <div className="px-5 py-4 border-b border-white/5">
            <p className="text-[13px] font-semibold">{t("country_title")}</p>
            <p className="text-[11px] text-text-muted mt-0.5">{t("country_sub")}</p>
          </div>
          <div className="p-4 h-[280px]">
            {data.countryBreakdown.length === 0 ? (
              <div className="flex items-center justify-center h-full text-text-muted text-[12px]">{t("no_country")}</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.countryBreakdown.map(c => ({ country: c.country || "?", count: c.count }))}>
                  <CartesianGrid stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="country" tick={{ fontSize: 11, fill: "#888" }} />
                  <YAxis tick={{ fontSize: 11, fill: "#888" }} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="count" fill="#427ab5" radius={[6, 6, 0, 0]} name={t("legend_views")} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
