"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { Link } from "@/i18n/routing"

type Row = { id: string; status: string; plan_key: string; price: number; min: number; customer_provider: string; customer_id: string; maki_order_id: string | null; note: string | null; created_at: string; paid_at: string | null; user: { id: string; username: string; email: string | null }; product: string; slug: string }
type Access = { game: string; server_id: string; days_remaining: number; expires_at: string; added_by: string; from_your_orders: boolean }

const fmt = (s: string | null) => (s ? new Date(s).toLocaleString("th-TH", { day: "numeric", month: "short", year: "2-digit", hour: "2-digit", minute: "2-digit" }) : "-")
const TONE: Record<string, string> = { pending: "bg-yellow-500/10 text-yellow-400", paid: "bg-green-500/10 text-green-400", expired: "bg-white/5 text-text-muted", failed: "bg-red-500/10 text-red-400" }
const btn = "px-3 py-1.5 rounded-lg border border-white/10 text-[12px] text-text-muted hover:text-text-base hover:border-white/20 transition disabled:opacity-50"

export default function MakiOrdersAdminClient({ stats, orders }: { stats: { paid: number; pending: number; revenue: number; margin: number }; orders: Row[] }) {
  const t = useTranslations("AdminMaki")
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [wl, setWl] = useState<{ key: string; loading: boolean; access?: Access[]; error?: string } | null>(null)

  const sync = async () => {
    setBusy(true); setMsg(null)
    try {
      const r = await fetch("/api/admin/maki", { method: "POST" })
      const d = await r.json()
      setMsg(r.ok ? t("sync_result", { checked: d.checked, paid: d.paid }) : t("whitelist_error"))
      if (r.ok && d.paid > 0) window.location.reload()
    } finally { setBusy(false) }
  }
  const check = async (o: Row) => {
    const key = `${o.customer_provider}:${o.customer_id}`
    setWl({ key, loading: true })
    const r = await fetch(`/api/admin/maki?provider=${o.customer_provider}&id=${encodeURIComponent(o.customer_id)}`)
    const d = await r.json().catch(() => ({}))
    setWl(r.ok ? { key, loading: false, access: d.access ?? [] } : { key, loading: false, error: d.error || t("whitelist_error") })
  }

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-3">
        <div>
          <h1 className="text-[24px] font-bold text-text-base">{t("orders_title")}</h1>
          <p className="text-[13px] text-text-muted mt-1">{t("orders_sub")}</p>
        </div>
        <div className="flex items-center gap-3">
          {msg && <span className="text-[12px] text-text-muted">{msg}</span>}
          <button onClick={sync} disabled={busy} className={btn}>{busy ? t("working") : t("sync_pending")}</button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: t("stat_paid"), n: stats.paid.toLocaleString(), tone: "text-green-400" },
          { label: t("stat_pending"), n: stats.pending.toLocaleString(), tone: "text-yellow-400" },
          { label: t("stat_revenue"), n: `฿${stats.revenue.toLocaleString()}`, tone: "text-accent-light" },
          { label: t("stat_margin"), n: `฿${stats.margin.toLocaleString()}`, tone: "text-accent-light" },
        ].map((x) => (
          <div key={x.label} className="bg-bg-card border border-white/5 rounded-2xl p-5">
            <div className={`text-[1.4rem] font-black leading-none ${x.tone}`}>{x.n}</div>
            <div className="text-[12px] text-text-muted mt-1.5">{x.label}</div>
          </div>
        ))}
      </div>

      {wl && (
        <section className="bg-bg-card border border-accent/20 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[14px] font-bold text-text-base">{t("whitelist_title")} <span className="font-mono text-text-muted text-[12px]">{wl.key}</span></h2>
            <button onClick={() => setWl(null)} className={btn}>{t("close")}</button>
          </div>
          {wl.loading ? <p className="text-[13px] text-text-muted">{t("working")}</p>
            : wl.error ? <p className="text-[13px] text-red-400">{wl.error}</p>
            : wl.access!.length === 0 ? <p className="text-[13px] text-text-muted">{t("whitelist_none")}</p>
            : (
              <ul className="divide-y divide-white/5 text-[13px]">
                {wl.access!.map((a) => (
                  <li key={a.server_id} className="py-2 flex items-center justify-between gap-3">
                    <span className="font-semibold">{a.game} {a.from_your_orders && <span className="ml-1 px-1.5 py-0.5 rounded bg-accent/15 text-accent-light text-[10px] font-bold">{t("whitelist_ours")}</span>}</span>
                    <span className="text-text-muted">{t("whitelist_days", { n: a.days_remaining })} · {fmt(a.expires_at)}</span>
                  </li>
                ))}
              </ul>
            )}
        </section>
      )}

      <section className="bg-bg-card border border-white/5 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead className="bg-white/[0.03] text-text-muted">
              <tr>
                <th className="text-left px-4 py-2">{t("col_date")}</th><th className="text-left px-4 py-2">{t("col_user")}</th><th className="text-left px-4 py-2">{t("col_product")}</th>
                <th className="text-right px-4 py-2">{t("col_price")}</th><th className="text-right px-4 py-2">{t("col_min")}</th><th className="text-right px-4 py-2">{t("col_margin")}</th>
                <th className="text-left px-4 py-2">{t("col_status")}</th><th className="text-left px-4 py-2">{t("col_customer")}</th><th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 && <tr><td colSpan={9} className="px-4 py-8 text-center text-text-muted">{t("no_orders")}</td></tr>}
              {orders.map((o) => (
                <tr key={o.id} className="border-t border-white/5">
                  <td className="px-4 py-2 text-text-muted whitespace-nowrap">{fmt(o.created_at)}</td>
                  <td className="px-4 py-2"><span className="text-text-base">{o.user.username}</span><span className="block text-text-muted">{o.user.email ?? ""}</span></td>
                  <td className="px-4 py-2"><span className="text-text-base">{o.product}</span><span className="block text-text-muted font-mono">{o.plan_key}</span></td>
                  <td className="px-4 py-2 text-right font-bold text-text-base">฿{o.price.toLocaleString()}</td>
                  <td className="px-4 py-2 text-right text-text-muted">฿{o.min.toLocaleString()}</td>
                  <td className="px-4 py-2 text-right font-bold text-green-400">฿{(o.price - o.min).toLocaleString()}</td>
                  <td className="px-4 py-2">
                    <span className={`px-2 py-0.5 rounded-md font-semibold ${TONE[o.status] ?? TONE.pending}`}>{o.status}</span>
                    {o.maki_order_id && <span className="block text-text-muted font-mono mt-0.5" title={o.maki_order_id}>{o.maki_order_id.slice(0, 13)}…</span>}
                    {o.note && <span className="block text-red-400 mt-0.5 max-w-[220px] truncate" title={o.note}>{o.note}</span>}
                  </td>
                  <td className="px-4 py-2 font-mono text-text-muted whitespace-nowrap">{o.customer_provider}:{o.customer_id}</td>
                  <td className="px-4 py-2 text-right whitespace-nowrap">
                    <button onClick={() => check(o)} className={btn}>{t("whitelist_check")}</button>
                    <Link href={`/orders/maki/${o.id}`} className={`${btn} ml-1.5 inline-block`}>#{o.id.slice(0, 8)}</Link>
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
