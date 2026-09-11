"use client"

// หน้าจัดการ AC Points: แท็บผู้ใช้ (ค้นหา/เรียง → ลิ้นชักจัดการ เพิ่ม/หัก/ตั้งยอด/ยกเลิกรายการ) ·
// แท็บประวัติทั้งร้าน (กรองประเภท/ค้นหา) · แท็บตั้งค่าเรท (RateSettings)
import { useCallback, useEffect, useState } from "react"
import { useTranslations } from "next-intl"
import { Link } from "@/i18n/routing"
import RateSettings from "./RateSettings"

type UserRow = { id: string; username: string; email: string | null; avatar: string | null; balance: number; entries: number; last_at: string | null }
type Entry = {
  id: string; delta: number; type: string; note: string | null; created_at: string
  order_id: string | null; order_href?: string | null; product: string | null; reverses_id: string | null; voided: boolean
  by?: string | null; user?: { id: string; username: string; email: string | null }
}
type Tab = "users" | "ledger" | "rate"
type Config = { active: boolean; perBaht: number; startAt: string | null }

const fmt = (s: string | null | undefined) => (s ? new Date(s).toLocaleString("th-TH", { day: "numeric", month: "short", year: "2-digit", hour: "2-digit", minute: "2-digit" }) : "-")
const input = "bg-bg-base border border-white/10 rounded-xl px-4 py-2.5 text-[14px] text-text-base outline-none focus:border-accent/50"
const btnPrimary = "px-5 py-2.5 rounded-xl bg-accent hover:opacity-90 text-white text-[13px] font-bold disabled:opacity-50 transition"
const btnGhost = "px-4 py-2 rounded-xl border border-white/10 text-[13px] text-text-muted hover:text-text-base hover:border-white/20 transition disabled:opacity-50"
const ERR_KEYS: Record<string, string> = { already_voided: "err_already_voided", void_not_allowed: "err_void_not_allowed", note_required: "note_required" }

function useDebounced(value: string, ms = 400) {
  const [v, setV] = useState(value)
  useEffect(() => { const id = setTimeout(() => setV(value), ms); return () => clearTimeout(id) }, [value, ms])
  return v
}

export default function PointsAdminClient({ config, configs, stats }: {
  config: Config
  configs: Record<string, string>
  stats: { outstanding: number; earned: number; earnedCount: number; reversed: number; adjusted: number }
}) {
  const t = useTranslations("AdminPoints")
  const [tab, setTab] = useState<Tab>("users")
  const [drawerUser, setDrawerUser] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [busy, setBusy] = useState(false)
  const [reconcileMsg, setReconcileMsg] = useState<string | null>(null)

  const reconcile = async () => {
    setBusy(true); setReconcileMsg(null)
    try {
      const r = await fetch("/api/admin/points", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "reconcile" }) })
      const d = await r.json()
      setReconcileMsg(r.ok ? t("reconcile_result", { awarded: d.awarded, scanned: d.scanned }) : t("err_generic"))
      setRefreshKey((k) => k + 1)
    } finally { setBusy(false) }
  }

  const tabs: { key: Tab; label: string }[] = [{ key: "users", label: t("tab_users") }, { key: "ledger", label: t("tab_ledger") }, { key: "rate", label: t("tab_rate") }]

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-3">
        <div>
          <h1 className="text-[24px] font-bold text-text-base">{t("title")}</h1>
          <p className="text-[13px] text-text-muted mt-1">
            {config.active
              ? t("status_active", { rate: (config.perBaht * 100).toLocaleString(), date: fmt(config.startAt) })
              : t("status_inactive")}
            {" · "}
            <button onClick={() => setTab("rate")} className="text-accent-light hover:underline">{t("tab_rate")}</button>
          </p>
        </div>
        <div className="flex items-center gap-3">
          {reconcileMsg && <span className="text-[12px] text-text-muted">{reconcileMsg}</span>}
          <button onClick={reconcile} disabled={busy || !config.active} className={btnGhost}>{busy ? t("working") : t("reconcile")}</button>
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

      <div className="flex gap-1 border-b border-white/5">
        {tabs.map((x) => (
          <button key={x.key} onClick={() => setTab(x.key)}
            className={`px-4 py-2.5 text-[13px] font-semibold border-b-2 -mb-px transition ${tab === x.key ? "border-accent text-accent-light" : "border-transparent text-text-muted hover:text-text-base"}`}>
            {x.label}
          </button>
        ))}
      </div>

      {tab === "users" && <UsersTab refreshKey={refreshKey} onOpen={setDrawerUser} />}
      {tab === "ledger" && <LedgerTab refreshKey={refreshKey} onOpenUser={setDrawerUser} />}
      {tab === "rate" && (
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-6 items-start">
          <RateSettings initialConfigs={configs} />
          <RateExamples perBaht={config.perBaht} />
        </div>
      )}

      {drawerUser && <UserDrawer userId={drawerUser} onClose={() => setDrawerUser(null)} onChanged={() => setRefreshKey((k) => k + 1)} />}
    </div>
  )
}

/* ── แท็บผู้ใช้ ── */
function UsersTab({ refreshKey, onOpen }: { refreshKey: number; onOpen: (id: string) => void }) {
  const t = useTranslations("AdminPoints")
  const [q, setQ] = useState("")
  const query = useDebounced(q)
  const [sort, setSort] = useState<"balance" | "recent">("balance")
  const [page, setPage] = useState(1)
  const [data, setData] = useState<{ users: UserRow[]; total: number; limit: number } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { setPage(1) }, [query, sort])
  useEffect(() => {
    let alive = true
    setLoading(true)
    fetch(`/api/admin/points/users?q=${encodeURIComponent(query)}&sort=${sort}&page=${page}`)
      .then((r) => r.json()).then((d) => { if (alive) setData(d) }).finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [query, sort, page, refreshKey])

  const pages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1
  return (
    <section className="bg-bg-card border border-white/5 rounded-2xl overflow-hidden">
      <div className="p-4 flex flex-col md:flex-row gap-3 md:items-center border-b border-white/5">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("users_search_placeholder")} className={`flex-1 ${input}`} />
        <select value={sort} onChange={(e) => setSort(e.target.value as "balance" | "recent")} disabled={!!query} className={`${input} md:w-[200px]`}>
          <option value="balance">{t("sort_balance")}</option>
          <option value="recent">{t("sort_recent")}</option>
        </select>
        {data && <span className="text-[12px] text-text-muted whitespace-nowrap">{t("total_users", { n: data.total })}</span>}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead className="bg-white/[0.03] text-text-muted text-[12px]">
            <tr><th className="text-left px-4 py-2">{t("col_user")}</th><th className="text-right px-4 py-2">{t("col_balance")}</th><th className="text-right px-4 py-2">{t("col_entries")}</th><th className="text-left px-4 py-2">{t("col_last")}</th><th className="px-4 py-2" /></tr>
          </thead>
          <tbody>
            {loading && !data && <tr><td colSpan={5} className="px-4 py-8 text-center text-text-muted">{t("loading")}</td></tr>}
            {data && data.users.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-text-muted">{t("no_users")}</td></tr>}
            {data?.users.map((u) => (
              <tr key={u.id} className="border-t border-white/5 hover:bg-white/[0.02]">
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-3">
                    {u.avatar ? <img src={u.avatar} alt="" className="w-8 h-8 rounded-full object-cover" /> : <div className="w-8 h-8 rounded-full bg-accent/20 text-accent-light flex items-center justify-center text-[12px] font-bold">{(u.username || "?")[0]?.toUpperCase()}</div>}
                    <div className="min-w-0"><p className="font-semibold text-text-base truncate">{u.username}</p><p className="text-[11px] text-text-muted truncate">{u.email ?? "-"}</p></div>
                  </div>
                </td>
                <td className={`px-4 py-2.5 text-right font-bold ${u.balance < 0 ? "text-red-400" : "text-yellow-400"}`}>{u.balance.toLocaleString()}</td>
                <td className="px-4 py-2.5 text-right text-text-muted">{u.entries}</td>
                <td className="px-4 py-2.5 text-text-muted whitespace-nowrap">{fmt(u.last_at)}</td>
                <td className="px-4 py-2.5 text-right"><button onClick={() => onOpen(u.id)} className={btnGhost}>{t("manage")}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pager page={page} pages={pages} onPage={setPage} />
    </section>
  )
}

/* ── แท็บประวัติทั้งร้าน ── */
function LedgerTab({ refreshKey, onOpenUser }: { refreshKey: number; onOpenUser: (id: string) => void }) {
  const t = useTranslations("AdminPoints")
  const [type, setType] = useState("all")
  const [q, setQ] = useState("")
  const query = useDebounced(q)
  const [page, setPage] = useState(1)
  const [data, setData] = useState<{ entries: Entry[]; total: number; limit: number } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { setPage(1) }, [query, type])
  useEffect(() => {
    let alive = true
    setLoading(true)
    fetch(`/api/admin/points/ledger?type=${type}&q=${encodeURIComponent(query)}&page=${page}`)
      .then((r) => r.json()).then((d) => { if (alive) setData(d) }).finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [type, query, page, refreshKey])

  const pages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1
  return (
    <section className="bg-bg-card border border-white/5 rounded-2xl overflow-hidden">
      <div className="p-4 flex flex-col md:flex-row gap-3 md:items-center border-b border-white/5">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("ledger_search_placeholder")} className={`flex-1 ${input}`} />
        <select value={type} onChange={(e) => setType(e.target.value)} className={`${input} md:w-[200px]`}>
          <option value="all">{t("filter_type_all")}</option>
          <option value="earn_purchase">{t("type_earn")}</option>
          <option value="reverse_purchase">{t("type_reverse")}</option>
          <option value="adjust_admin">{t("type_adjust")}</option>
        </select>
        {data && <span className="text-[12px] text-text-muted whitespace-nowrap">{t("total_entries", { n: data.total })}</span>}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead className="bg-white/[0.03] text-text-muted">
            <tr><th className="text-left px-4 py-2">{t("col_date")}</th><th className="text-left px-4 py-2">{t("col_user")}</th><th className="text-left px-4 py-2">{t("col_type")}</th><th className="text-left px-4 py-2">{t("col_detail")}</th><th className="text-right px-4 py-2">{t("col_points")}</th></tr>
          </thead>
          <tbody>
            {loading && !data && <tr><td colSpan={5} className="px-4 py-8 text-center text-text-muted">{t("loading")}</td></tr>}
            {data && data.entries.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-text-muted">{t("no_entries")}</td></tr>}
            {data?.entries.map((e) => (
              <tr key={e.id} className={`border-t border-white/5 ${e.voided ? "opacity-50" : ""}`}>
                <td className="px-4 py-2 text-text-muted whitespace-nowrap">{fmt(e.created_at)}</td>
                <td className="px-4 py-2"><button onClick={() => e.user && onOpenUser(e.user.id)} className="text-accent-light hover:underline">{e.user?.username ?? "-"}</button><span className="block text-text-muted">{e.user?.email ?? ""}</span></td>
                <td className="px-4 py-2"><TypeBadge entry={e} /></td>
                <td className="px-4 py-2 text-text-muted">{e.product ?? e.note ?? "-"}{e.order_id && <Link href={e.order_href ?? `/orders/${e.order_id}`} className="ml-2 text-accent-light hover:underline">#{e.order_id.slice(0, 8)}</Link>}</td>
                <td className={`px-4 py-2 text-right font-bold ${e.delta > 0 ? "text-green-400" : "text-red-400"}`}>{e.delta > 0 ? "+" : ""}{e.delta.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pager page={page} pages={pages} onPage={setPage} />
    </section>
  )
}

/* ── ลิ้นชักจัดการรายคน ── */
function UserDrawer({ userId, onClose, onChanged }: { userId: string; onClose: () => void; onChanged: () => void }) {
  const t = useTranslations("AdminPoints")
  const [data, setData] = useState<{ user: { id: string; username: string; email: string | null; avatar: string | null; created_at: string | null }; balance: number; total: number; limit: number; entries: Entry[] } | null>(null)
  const [page, setPage] = useState(1)
  const [mode, setMode] = useState<"add" | "deduct" | "set">("add")
  const [amount, setAmount] = useState("")
  const [note, setNote] = useState("")
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const load = useCallback(async (p: number, append = false) => {
    const r = await fetch(`/api/admin/points/users/${userId}?page=${p}`)
    if (!r.ok) return
    const d = await r.json()
    setData((prev) => (append && prev ? { ...d, entries: [...prev.entries, ...d.entries] } : d))
    setPage(p)
  }, [userId])
  useEffect(() => { load(1) }, [load])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose()
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  const errText = (code: string) => (ERR_KEYS[code] ? t(ERR_KEYS[code]) : t("err_generic"))

  const post = async (payload: Record<string, unknown>) => {
    setBusy(true); setMsg(null)
    try {
      const r = await fetch("/api/admin/points", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) { setMsg({ ok: false, text: errText(String(d.error ?? "")) }); return false }
      setMsg({ ok: true, text: d.delta === 0 ? t("no_change") : t("done", { balance: Number(d.balance).toLocaleString() }) })
      await load(1)
      onChanged()
      return true
    } finally { setBusy(false) }
  }

  const apply = async () => {
    if (!data) return
    const n = Math.abs(Math.trunc(Number(amount)))
    if (!Number.isFinite(n) || (mode !== "set" && n === 0)) return
    if (!note.trim()) { setMsg({ ok: false, text: t("note_required") }); return }
    const user = data.user.username
    if (mode === "add") {
      if (!confirm(t("confirm_add", { points: n.toLocaleString(), user }))) return
      if (await post({ action: "adjust", user_id: userId, delta: n, note })) { setAmount(""); setNote("") }
    } else if (mode === "deduct") {
      if (n > data.balance && !confirm(t("deduct_over"))) return
      if (!confirm(t("confirm_deduct", { points: n.toLocaleString(), user }))) return
      if (await post({ action: "adjust", user_id: userId, delta: -n, note })) { setAmount(""); setNote("") }
    } else {
      const delta = n - data.balance
      if (!confirm(t("confirm_set", { points: n.toLocaleString(), user, delta: (delta > 0 ? "+" : "") + delta.toLocaleString() }))) return
      if (await post({ action: "set", user_id: userId, balance: n, note })) { setAmount(""); setNote("") }
    }
  }

  const voidEntry = async (e: Entry) => {
    if (!confirm(t("void_confirm", { points: (-e.delta > 0 ? "+" : "") + (-e.delta).toLocaleString() }))) return
    await post({ action: "void", entry_id: e.id })
  }

  const u = data?.user
  return (
    <div className="fixed inset-0 z-[200]" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <aside className="absolute right-0 top-0 h-full w-full max-w-[540px] bg-bg-card border-l border-white/10 shadow-2xl overflow-y-auto">
        <div className="sticky top-0 bg-bg-card/95 backdrop-blur border-b border-white/5 px-6 py-4 flex items-start justify-between gap-3 z-10">
          <div className="flex items-center gap-3 min-w-0">
            {u?.avatar ? <img src={u.avatar} alt="" className="w-11 h-11 rounded-full object-cover" /> : <div className="w-11 h-11 rounded-full bg-accent/20 text-accent-light flex items-center justify-center font-bold">{(u?.username || "?")[0]?.toUpperCase()}</div>}
            <div className="min-w-0">
              <p className="text-[15px] font-bold text-text-base truncate">{u?.username ?? t("loading")}</p>
              <p className="text-[12px] text-text-muted truncate">{u?.email ?? ""}{u?.created_at ? ` · ${t("member_since", { date: fmt(u.created_at) })}` : ""}</p>
            </div>
          </div>
          <button onClick={onClose} className={btnGhost}>{t("close")}</button>
        </div>

        {data && (
          <div className="p-6 space-y-6">
            <div className="rounded-2xl border border-yellow-500/20 bg-yellow-500/5 p-5">
              <p className="text-[11px] text-yellow-500/80 font-bold uppercase tracking-wider">{t("balance")}</p>
              <p className={`text-[2.2rem] font-black leading-none mt-1 ${data.balance < 0 ? "text-red-400" : "text-yellow-400"}`}>{data.balance.toLocaleString()}</p>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                {(["add", "deduct", "set"] as const).map((m) => (
                  <button key={m} onClick={() => setMode(m)}
                    className={`py-2 rounded-xl text-[13px] font-semibold border transition ${mode === m ? "bg-accent/15 border-accent/40 text-accent-light" : "border-white/10 text-text-muted hover:text-text-base"}`}>
                    {t(`mode_${m}`)}
                  </button>
                ))}
              </div>
              <div className="space-y-1">
                <label className="text-[12px] text-text-muted">{mode === "set" ? t("set_label") : t("amount_label")}</label>
                <input type="number" min={0} step={1} value={amount} onChange={(e) => setAmount(e.target.value)} className={`w-full ${input}`} />
              </div>
              <div className="space-y-1">
                <label className="text-[12px] text-text-muted">{t("note_label")}</label>
                <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} className={`w-full ${input}`} />
              </div>
              <div className="flex items-center gap-3">
                <button onClick={apply} disabled={busy || !amount} className={btnPrimary}>{busy ? t("working") : t("apply")}</button>
                {msg && <span className={`text-[12px] ${msg.ok ? "text-green-400" : "text-red-400"}`}>{msg.text}</span>}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-[14px] font-bold text-text-base">{t("history")}</h3>
                <span className="text-[12px] text-text-muted">{t("total_entries", { n: data.total })}</span>
              </div>
              {data.entries.length === 0 ? (
                <p className="text-[13px] text-text-muted py-6 text-center">{t("no_entries")}</p>
              ) : (
                <ul className="divide-y divide-white/5 rounded-xl border border-white/10 overflow-hidden">
                  {data.entries.map((e) => (
                    <li key={e.id} className={`px-4 py-3 flex items-start gap-3 ${e.voided ? "opacity-50" : ""}`}>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap"><TypeBadge entry={e} /><span className="text-[11px] text-text-muted">{fmt(e.created_at)}</span>{e.by && <span className="text-[11px] text-text-muted">{t("by", { name: e.by })}</span>}</div>
                        <p className="text-[12px] text-text-muted mt-1 break-words">{e.product ?? e.note ?? "-"}{e.order_id && <Link href={e.order_href ?? `/orders/${e.order_id}`} className="ml-2 text-accent-light hover:underline">#{e.order_id.slice(0, 8)}</Link>}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={`text-[14px] font-black ${e.delta > 0 ? "text-green-400" : "text-red-400"}`}>{e.delta > 0 ? "+" : ""}{e.delta.toLocaleString()}</p>
                        {e.type === "adjust_admin" && !e.reverses_id && !e.voided && (
                          <button onClick={() => voidEntry(e)} disabled={busy} className="text-[11px] text-red-400 hover:underline disabled:opacity-50">{t("void")}</button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {data.entries.length < data.total && (
                <button onClick={() => load(page + 1, true)} className={`${btnGhost} w-full mt-3`}>{t("load_more")}</button>
              )}
            </div>
          </div>
        )}
      </aside>
    </div>
  )
}

/* ── ชิ้นส่วนร่วม ── */
function TypeBadge({ entry }: { entry: Entry }) {
  const t = useTranslations("AdminPoints")
  const label = entry.reverses_id ? t("void_of") : ({ earn_purchase: t("type_earn"), reverse_purchase: t("type_reverse"), adjust_admin: t("type_adjust") } as Record<string, string>)[entry.type] ?? entry.type
  const tone = entry.reverses_id ? "bg-white/5 text-text-muted" : entry.type === "earn_purchase" ? "bg-green-500/10 text-green-400" : entry.type === "reverse_purchase" ? "bg-red-500/10 text-red-400" : "bg-yellow-500/10 text-yellow-400"
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`px-2 py-0.5 rounded-md text-[11px] font-semibold ${tone}`}>{label}</span>
      {entry.voided && <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-white/5 text-text-muted line-through">{t("voided")}</span>}
    </span>
  )
}

function Pager({ page, pages, onPage }: { page: number; pages: number; onPage: (p: number) => void }) {
  const t = useTranslations("AdminPoints")
  if (pages <= 1) return null
  return (
    <div className="px-4 py-3 border-t border-white/5 flex items-center justify-between text-[12px] text-text-muted">
      <button onClick={() => onPage(page - 1)} disabled={page <= 1} className={btnGhost}>{t("prev")}</button>
      <span>{t("page_of", { page, pages })}</span>
      <button onClick={() => onPage(page + 1)} disabled={page >= pages} className={btnGhost}>{t("next")}</button>
    </div>
  )
}

function RateExamples({ perBaht }: { perBaht: number }) {
  const t = useTranslations("AdminPoints")
  return (
    <div className="bg-bg-card border border-white/5 rounded-2xl p-6">
      <h3 className="text-[14px] font-bold text-text-base mb-3">{t("rate_examples_title")}</h3>
      <ul className="divide-y divide-white/5 text-[13px]">
        {[100, 500, 1000, 1250].map((amt) => (
          <li key={amt} className="py-2 flex items-center justify-between">
            <span className="text-text-muted">{t("rate_example_game", { amount: `฿${amt.toLocaleString()}` })}</span>
            <span className="font-bold text-yellow-400">{Math.floor(amt * perBaht).toLocaleString()}</span>
          </li>
        ))}
      </ul>
      <p className="text-[11px] text-text-muted mt-3 leading-relaxed">{t("rate_fee_note")}</p>
    </div>
  )
}
