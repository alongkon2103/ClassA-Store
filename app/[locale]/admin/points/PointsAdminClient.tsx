"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { Link } from "@/i18n/routing"

type Entry = { id: string; delta: number; type: string; note: string | null; created_at: string; user: { id: string; username: string; email: string | null }; order_id: string | null; product: string | null }
type Lookup = { user: { id: string; username: string; email: string | null; avatar: string | null }; balance: number; entries: Omit<Entry, "user">[] }

const fmt = (s: string) => new Date(s).toLocaleString("th-TH", { day: "numeric", month: "short", year: "2-digit", hour: "2-digit", minute: "2-digit" })

export default function PointsAdminClient({ config, stats, entries }: {
  config: { active: boolean; perBaht: number; startAt: string | null }
  stats: { outstanding: number; earned: number; earnedCount: number; reversed: number; adjusted: number }
  entries: Entry[]
}) {
  const t = useTranslations("AdminPoints")
  const [q, setQ] = useState("")
  const [lookup, setLookup] = useState<Lookup | null>(null)
  const [lookupErr, setLookupErr] = useState<string | null>(null)
  const [delta, setDelta] = useState("")
  const [note, setNote] = useState("")
  const [busy, setBusy] = useState<"search" | "adjust" | "reconcile" | null>(null)
  const [reconcileMsg, setReconcileMsg] = useState<string | null>(null)

  const search = async () => {
    if (!q.trim()) return
    setBusy("search"); setLookupErr(null)
    try {
      const r = await fetch(`/api/admin/points?q=${encodeURIComponent(q.trim())}`)
      if (!r.ok) { setLookup(null); setLookupErr(t("not_found")); return }
      setLookup(await r.json())
    } finally { setBusy(null) }
  }

  const adjust = async () => {
    if (!lookup) return
    const d = Number(delta)
    if (!Number.isInteger(d) || d === 0) return alert(t("delta_invalid"))
    if (!confirm(t("adjust_confirm", { points: (d > 0 ? "+" : "") + d.toLocaleString(), user: lookup.user.username }))) return
    setBusy("adjust")
    try {
      const r = await fetch("/api/admin/points", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "adjust", user_id: lookup.user.id, delta: d, note }) })
      if (!r.ok) return alert(t("adjust_failed"))
      setDelta(""); setNote("")
      await search()
    } finally { setBusy(null) }
  }

  const reconcile = async () => {
    setBusy("reconcile"); setReconcileMsg(null)
    try {
      const r = await fetch("/api/admin/points", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "reconcile" }) })
      const d = await r.json()
      setReconcileMsg(r.ok ? t("reconcile_result", { awarded: d.awarded, scanned: d.scanned }) : t("adjust_failed"))
    } finally { setBusy(null) }
  }

  const typeLabel = (type: string) => ({ earn_purchase: t("type_earn"), reverse_purchase: t("type_reverse"), adjust_admin: t("type_adjust") } as Record<string, string>)[type] ?? type
  const input = "bg-bg-base border border-white/10 rounded-xl px-4 py-2.5 text-[14px] text-text-base outline-none focus:border-accent/50"

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-3">
        <div>
          <h1 className="text-[24px] font-bold text-text-base">{t("title")}</h1>
          <p className="text-[13px] text-text-muted mt-1">
            {config.active
              ? t("status_active", { rate: (config.perBaht * 100).toLocaleString(), date: config.startAt ? fmt(config.startAt) : "-" })
              : t("status_inactive")}
            {" · "}<Link href="/admin/settings" className="text-accent-light hover:underline">{t("go_settings")}</Link>
          </p>
        </div>
        <div className="flex items-center gap-3">
          {reconcileMsg && <span className="text-[12px] text-text-muted">{reconcileMsg}</span>}
          <button onClick={reconcile} disabled={busy !== null || !config.active}
            className="px-4 py-2 rounded-xl border border-white/10 text-[13px] text-text-muted hover:text-text-base hover:border-white/20 transition disabled:opacity-50">
            {busy === "reconcile" ? t("working") : t("reconcile")}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: t("stat_outstanding"), n: stats.outstanding, tone: "text-accent-light" },
          { label: t("stat_earned", { n: stats.earnedCount }), n: stats.earned, tone: "text-green-400" },
          { label: t("stat_reversed"), n: stats.reversed, tone: "text-red-400" },
          { label: t("stat_adjusted"), n: stats.adjusted, tone: "text-yellow-400" },
        ].map((x) => (
          <div key={x.label} className="bg-bg-card border border-white/5 rounded-2xl p-5">
            <div className={`text-[1.5rem] font-black leading-none ${x.tone}`}>{x.n.toLocaleString()}</div>
            <div className="text-[12px] text-text-muted mt-1.5">{x.label}</div>
          </div>
        ))}
      </div>

      {/* ค้นหา + ปรับแต้ม */}
      <section className="bg-bg-card border border-white/5 rounded-2xl p-6 space-y-4">
        <h2 className="text-[16px] font-bold text-text-base">{t("lookup_title")}</h2>
        <div className="flex gap-2">
          <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && search()} placeholder={t("lookup_placeholder")} className={`flex-1 ${input}`} />
          <button onClick={search} disabled={busy !== null} className="px-5 rounded-xl bg-accent text-white text-[13px] font-bold disabled:opacity-50">{busy === "search" ? t("working") : t("search")}</button>
        </div>
        {lookupErr && <p className="text-[13px] text-red-400">{lookupErr}</p>}
        {lookup && (
          <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
            <div className="rounded-xl border border-white/10 p-4 space-y-3">
              <div>
                <p className="text-[14px] font-bold text-text-base">{lookup.user.username}</p>
                <p className="text-[12px] text-text-muted">{lookup.user.email ?? "-"}</p>
              </div>
              <div>
                <p className="text-[11px] text-text-muted uppercase tracking-wider">{t("balance")}</p>
                <p className="text-[1.6rem] font-black text-yellow-400 leading-none mt-1">{lookup.balance.toLocaleString()}</p>
              </div>
              <div className="space-y-2 pt-2 border-t border-white/10">
                <input type="number" step={1} value={delta} onChange={(e) => setDelta(e.target.value)} placeholder={t("delta_placeholder")} className={`w-full ${input}`} />
                <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("note_placeholder")} maxLength={200} className={`w-full ${input}`} />
                <button onClick={adjust} disabled={busy !== null} className="w-full py-2.5 rounded-xl bg-accent text-white text-[13px] font-bold disabled:opacity-50">
                  {busy === "adjust" ? t("working") : t("adjust")}
                </button>
              </div>
            </div>
            <div className="rounded-xl border border-white/10 overflow-hidden">
              <table className="w-full text-[12px]">
                <thead className="bg-white/[0.03] text-text-muted"><tr><th className="text-left px-3 py-2">{t("col_date")}</th><th className="text-left px-3 py-2">{t("col_type")}</th><th className="text-left px-3 py-2">{t("col_detail")}</th><th className="text-right px-3 py-2">{t("col_points")}</th></tr></thead>
                <tbody>
                  {lookup.entries.length === 0 && <tr><td colSpan={4} className="px-3 py-6 text-center text-text-muted">{t("no_entries")}</td></tr>}
                  {lookup.entries.map((e) => (
                    <tr key={e.id} className="border-t border-white/5">
                      <td className="px-3 py-2 text-text-muted whitespace-nowrap">{fmt(e.created_at)}</td>
                      <td className="px-3 py-2">{typeLabel(e.type)}</td>
                      <td className="px-3 py-2 text-text-muted truncate max-w-[240px]">{e.product ?? e.note ?? "-"}</td>
                      <td className={`px-3 py-2 text-right font-bold ${e.delta > 0 ? "text-green-400" : "text-red-400"}`}>{e.delta > 0 ? "+" : ""}{e.delta.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* รายการล่าสุดทั้งร้าน */}
      <section className="bg-bg-card border border-white/5 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-white/5"><h2 className="text-[16px] font-bold text-text-base">{t("recent_title")}</h2></div>
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead className="bg-white/[0.03] text-text-muted"><tr><th className="text-left px-4 py-2">{t("col_date")}</th><th className="text-left px-4 py-2">{t("col_user")}</th><th className="text-left px-4 py-2">{t("col_type")}</th><th className="text-left px-4 py-2">{t("col_detail")}</th><th className="text-right px-4 py-2">{t("col_points")}</th></tr></thead>
            <tbody>
              {entries.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-text-muted">{t("no_entries")}</td></tr>}
              {entries.map((e) => (
                <tr key={e.id} className="border-t border-white/5">
                  <td className="px-4 py-2 text-text-muted whitespace-nowrap">{fmt(e.created_at)}</td>
                  <td className="px-4 py-2"><button onClick={() => { setQ(e.user.email ?? e.user.username); setTimeout(search, 0) }} className="text-accent-light hover:underline">{e.user.username}</button><span className="block text-text-muted">{e.user.email ?? ""}</span></td>
                  <td className="px-4 py-2">{typeLabel(e.type)}</td>
                  <td className="px-4 py-2 text-text-muted">{e.product ?? e.note ?? "-"}{e.order_id && <Link href={`/orders/${e.order_id}`} className="ml-2 text-accent-light hover:underline">#{e.order_id.slice(0, 8)}</Link>}</td>
                  <td className={`px-4 py-2 text-right font-bold ${e.delta > 0 ? "text-green-400" : "text-red-400"}`}>{e.delta > 0 ? "+" : ""}{e.delta.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
