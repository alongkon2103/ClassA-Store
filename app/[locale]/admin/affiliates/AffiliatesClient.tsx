"use client"

import { useCallback, useEffect, useState } from "react"
import { useTranslations } from "next-intl"
import { motion, AnimatePresence } from "framer-motion"
import { Link } from "@/i18n/routing"
import AffiliatesOverview from "./AffiliatesOverview"

type ListRow = {
  user_id: string
  username: string
  email: string | null
  avatar: string | null
  default_commission_pct: number
  payout_method: string | null
  payout_detail: string | null
  display_name: string | null
  is_active: boolean
  code_count: number
  pending_amount: number
  paid_amount: number
  pending_count: number
  api_enabled?: boolean
  api_key_prefix?: string | null
  api_key_created_at?: string | null
}

type CodeRow = {
  id: string; code: string; type: string; value: number
  commission_pct: number | null; is_active: boolean
  used_count: number; max_uses: number | null; product_id: string | null; product_name: string | null
  per_user_limit: number | null
}
type ProductOpt = { id: string; name: string }

type Detail = {
  profile: ListRow
  codes: CodeRow[]
  earnings: {
    id: string; base_amount: number; commission_pct: number; commission_amount: number
    status: string; clawback: boolean; created_at: string; paid_at: string | null; product_name: string | null
  }[]
  payouts: { id: string; amount: number; method: string | null; note: string | null; paid_at: string }[]
  products: ProductOpt[]
}

const baht = (n: number) => `฿${n.toLocaleString(undefined, { minimumFractionDigits: 2 })}`

type Req = { id: string; affiliate_user_id: string; username: string; email: string | null; amount: number; method: string | null; detail: string | null; requested_at: string | null }

export default function AffiliatesClient() {
  const t = useTranslations("AdminAffiliates")
  const [rows, setRows] = useState<ListRow[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)
  const [requests, setRequests] = useState<Req[]>([])
  const [minWithdraw, setMinWithdraw] = useState<number>(0)
  const [reqBusy, setReqBusy] = useState(false)
  const [tab, setTab] = useState<"manage" | "overview">("manage")

  const load = useCallback(async () => {
    setLoading(true)
    const [a, rq, st] = await Promise.all([
      fetch("/api/admin/affiliates"),
      fetch("/api/admin/affiliates/requests"),
      fetch("/api/admin/affiliates/settings"),
    ])
    setRows(a.ok ? await a.json() : [])
    setRequests(rq.ok ? await rq.json() : [])
    if (st.ok) setMinWithdraw((await st.json()).min_withdraw ?? 0)
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  const resolveRequest = async (id: string, action: "paid" | "reject", reason?: string) => {
    if (action === "paid" && !confirm(t("req_paid_confirm"))) return
    setReqBusy(true)
    const res = await fetch(`/api/admin/affiliates/requests/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, reason }),
    })
    if (!res.ok) alert((await res.json().catch(() => ({}))).error || t("error_save"))
    await load(); setReqBusy(false)
  }

  const saveMin = async (v: number) => {
    const res = await fetch("/api/admin/affiliates/settings", {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ min_withdraw: v }),
    })
    if (res.ok) { const j = await res.json(); setMinWithdraw(j.min_withdraw ?? v) }
    return res.ok
  }

  const totalPending = rows.reduce((s, r) => s + r.pending_amount, 0)
  const totalPaid = rows.reduce((s, r) => s + r.paid_amount, 0)

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-[22px] sm:text-[26px] font-bold">{t("title")}</h1>
          <p className="text-text-muted text-[12px] sm:text-[13px] mt-1">{t("subtitle")}</p>
        </div>
        {tab === "manage" && (
          <button
            onClick={() => setShowCreate((v) => !v)}
            className="px-4 py-2 rounded-xl bg-accent text-white text-[13px] font-medium hover:bg-accent/90 active:scale-95 transition-all self-start sm:self-auto"
          >
            {showCreate ? t("cancel") : t("new_affiliate")}
          </button>
        )}
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-1 border-b border-white/5">
        {(["manage", "overview"] as const).map((key) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2.5 text-[13px] font-medium border-b-2 -mb-px transition-colors ${
              tab === key ? "border-accent text-accent-light" : "border-transparent text-text-muted hover:text-text-base"
            }`}
          >
            {t(key === "manage" ? "tab_manage" : "tab_overview")}
          </button>
        ))}
      </div>

      {tab === "overview" ? <AffiliatesOverview /> : <>

      {showCreate && <CreateForm onDone={() => { setShowCreate(false); load() }} t={t} />}

      {/* ── KPIs ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi icon={<UsersIcon />} label={t("affiliates")} value={String(rows.length)} tone="accent" />
        <Kpi icon={<ClockIcon />} label={t("requests_count")} value={String(requests.length)} tone="blue" />
        <Kpi icon={<WalletIcon />} label={t("total_pending")} value={baht(totalPending)} tone="amber" />
        <Kpi icon={<CheckIcon />} label={t("total_paid")} value={baht(totalPaid)} tone="green" />
      </div>

      {/* ── Withdrawal requests (actionable — prominent when present) ── */}
      {requests.length > 0 && (
        <section className="bg-blue-500/[0.05] border border-blue-500/25 rounded-2xl p-5">
          <div className="flex items-center gap-2.5 mb-4">
            <span className="w-7 h-7 rounded-lg bg-blue-500/15 text-blue-300 flex items-center justify-center shrink-0"><ClockIcon /></span>
            <h2 className="text-[14px] font-semibold">{t("requests_title")}</h2>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-medium">{requests.length}</span>
          </div>
          <div className="space-y-2">
            {requests.map((r) => (
              <RequestRow key={r.id} r={r} busy={reqBusy}
                onPaid={() => resolveRequest(r.id, "paid")}
                onReject={(reason) => resolveRequest(r.id, "reject", reason)}
                t={t} />
            ))}
          </div>
        </section>
      )}

      {/* ── Setting ── */}
      <MinWithdrawSetting value={minWithdraw} onSave={saveMin} t={t} />

      {/* ── Affiliates table ── */}
      <section className="bg-bg-card border border-accent/10 rounded-2xl overflow-hidden">
        <div className="flex items-center gap-2.5 px-5 pt-5 pb-3">
          <span className="w-7 h-7 rounded-lg bg-accent/10 text-accent-light flex items-center justify-center shrink-0"><UsersIcon /></span>
          <h2 className="text-[14px] font-semibold">{t("affiliates")}</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px] min-w-[720px]">
            <thead>
              <tr className="text-left text-[11px] text-text-muted border-y border-white/5 bg-white/[0.015]">
                <th className="px-5 py-2.5 font-medium">{t("col_affiliate")}</th>
                <th className="px-4 py-2.5 font-medium text-right">{t("col_rate")}</th>
                <th className="px-4 py-2.5 font-medium text-right">{t("col_codes")}</th>
                <th className="px-4 py-2.5 font-medium text-right">{t("col_pending")}</th>
                <th className="px-4 py-2.5 font-medium text-right">{t("col_paid")}</th>
                <th className="px-4 py-2.5 font-medium">{t("col_status")}</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                <tr><td colSpan={7} className="text-center py-12 text-text-muted">{t("loading")}</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-text-muted">{t("empty")}</td></tr>
              ) : rows.map((r) => (
                <tr key={r.user_id} className="hover:bg-accent/[0.04] transition-colors">
                  <td className="px-5 py-3">
                    <p className="font-medium">{r.display_name || r.username}</p>
                    <p className="text-[11px] text-text-muted">{r.email}</p>
                  </td>
                  <td className="px-4 py-3 text-right font-mono">{r.default_commission_pct}%</td>
                  <td className="px-4 py-3 text-right text-text-muted">{r.code_count}</td>
                  <td className="px-4 py-3 text-right font-mono text-amber-400">{baht(r.pending_amount)}</td>
                  <td className="px-4 py-3 text-right font-mono text-green-400/80">{baht(r.paid_amount)}</td>
                  <td className="px-4 py-3">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${r.is_active ? "bg-green-500/15 text-green-400" : "bg-white/10 text-text-muted"}`}>
                      {r.is_active ? t("active") : t("paused")}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <Link href={`/admin/affiliates/${r.user_id}`}
                      className="text-[12px] px-3 py-1.5 rounded-lg text-text-muted hover:text-accent-light hover:bg-white/5 transition-all mr-1">
                      {t("stats")}
                    </Link>
                    <button onClick={() => setOpenId(r.user_id)}
                      className="text-[12px] px-3 py-1.5 rounded-lg bg-accent/10 text-accent-light hover:bg-accent/20 active:scale-95 transition-all">
                      {t("manage")}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      </>}

      <AnimatePresence>
        {openId && (
          <DetailModal userId={openId} onClose={() => setOpenId(null)} onChanged={load} t={t} />
        )}
      </AnimatePresence>
    </div>
  )
}

type PickUser = { id: string; username: string; email: string | null; avatar: string | null; role: string }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CreateForm({ onDone, t }: { onDone: () => void; t: any }) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<PickUser[]>([])
  const [selected, setSelected] = useState<PickUser | null>(null)
  const [open, setOpen] = useState(false)
  const [searching, setSearching] = useState(false)
  const [pct, setPct] = useState("10")
  const [method, setMethod] = useState("")
  const [detail, setDetail] = useState("")
  const [name, setName] = useState("")
  const [err, setErr] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Debounced search against the real users table (min 2 chars).
  useEffect(() => {
    if (selected) return
    const q = query.trim()
    if (q.length < 2) { setResults([]); return }
    setSearching(true)
    const timer = setTimeout(async () => {
      try {
        const r = await fetch(`/api/admin/users/search?q=${encodeURIComponent(q)}`)
        setResults(r.ok ? await r.json() : [])
        setOpen(true)
      } finally { setSearching(false) }
    }, 250)
    return () => clearTimeout(timer)
  }, [query, selected])

  const submit = async () => {
    if (!selected) return
    setErr(null); setSaving(true)
    const res = await fetch("/api/admin/affiliates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: selected.id, default_commission_pct: Number(pct),
        payout_method: method || null, payout_detail: detail || null, display_name: name || null,
      }),
    })
    setSaving(false)
    if (!res.ok) { setErr((await res.json()).error || t("error_save")); return }
    onDone()
  }

  const roleBadge = (role: string) =>
    role === "affiliate" ? "bg-amber-500/15 text-amber-400"
    : role === "admin" || role === "partnership" ? "bg-red-500/15 text-red-400"
    : "bg-white/10 text-text-muted"

  return (
    <div className="bg-bg-card border border-accent/15 rounded-2xl p-5 space-y-4">
      <p className="text-[13px] font-semibold">{t("new_affiliate")}</p>
      <p className="text-[11px] text-text-muted -mt-2">{t("create_hint")}</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label={t("field_user")}>
          {selected ? (
            <div className="flex items-center justify-between gap-2 bg-bg-base border border-accent/30 rounded-xl px-3 py-2">
              <div className="min-w-0">
                <p className="text-[13px] font-medium truncate">{selected.username}</p>
                <p className="text-[11px] text-text-muted truncate">{selected.email ?? "—"}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={`text-[9px] px-1.5 py-0.5 rounded-full uppercase ${roleBadge(selected.role)}`}>{selected.role}</span>
                <button onClick={() => { setSelected(null); setQuery("") }} className="text-text-muted hover:text-red-400">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                </button>
              </div>
            </div>
          ) : (
            <div className="relative">
              <input
                value={query}
                onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
                onFocus={() => setOpen(true)}
                placeholder={t("search_user_ph")}
                className="w-full bg-bg-base border border-accent/15 rounded-xl px-3 py-2 text-[14px]"
              />
              {open && query.trim().length >= 2 && (
                <div className="absolute z-20 mt-1 w-full max-h-64 overflow-y-auto bg-bg-card border border-accent/20 rounded-xl shadow-xl">
                  {searching && <div className="px-3 py-2 text-[12px] text-text-muted">{t("searching")}</div>}
                  {!searching && results.length === 0 && <div className="px-3 py-2 text-[12px] text-text-muted">{t("no_results")}</div>}
                  {results.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => { setSelected(u); setQuery(""); setResults([]); setOpen(false) }}
                      className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left hover:bg-white/[0.04] transition"
                    >
                      <div className="min-w-0">
                        <p className="text-[13px] truncate">{u.username}</p>
                        <p className="text-[11px] text-text-muted truncate">{u.email ?? "—"}</p>
                      </div>
                      <span className={`shrink-0 text-[9px] px-1.5 py-0.5 rounded-full uppercase ${roleBadge(u.role)}`}>{u.role}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </Field>
        <Field label={t("field_rate")}>
          <input type="number" value={pct} onChange={(e) => setPct(e.target.value)}
            className="w-full bg-bg-base border border-accent/15 rounded-xl px-3 py-2 text-[14px]" />
        </Field>
        <Field label={t("field_display_name")}>
          <input value={name} onChange={(e) => setName(e.target.value)}
            className="w-full bg-bg-base border border-accent/15 rounded-xl px-3 py-2 text-[14px]" />
        </Field>
        <Field label={t("field_payout_method")}>
          <input value={method} onChange={(e) => setMethod(e.target.value)} placeholder={t("payout_method_ph")}
            className="w-full bg-bg-base border border-accent/15 rounded-xl px-3 py-2 text-[14px]" />
        </Field>
        <Field label={t("field_payout_detail")}>
          <input value={detail} onChange={(e) => setDetail(e.target.value)} placeholder={t("payout_detail_ph")}
            className="w-full bg-bg-base border border-accent/15 rounded-xl px-3 py-2 text-[14px]" />
        </Field>
      </div>
      {err && <p className="text-[13px] text-red-400">{err}</p>}
      <div className="flex justify-end">
        <button onClick={submit} disabled={saving || !selected}
          className="px-4 py-2 rounded-xl bg-accent text-white text-[13px] font-medium hover:bg-accent/90 disabled:opacity-50">
          {saving ? t("saving") : t("create")}
        </button>
      </div>
    </div>
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function DetailModal({ userId, onClose, onChanged, t }: { userId: string; onClose: () => void; onChanged: () => void; t: any }) {
  const [d, setD] = useState<Detail | null>(null)
  const [busy, setBusy] = useState(false)

  const reload = useCallback(async () => {
    const r = await fetch(`/api/admin/affiliates/${userId}`)
    if (r.ok) setD(await r.json())
  }, [userId])
  useEffect(() => { reload() }, [reload])

  const patchProfile = async (patch: Record<string, unknown>) => {
    setBusy(true)
    await fetch(`/api/admin/affiliates/${userId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch),
    })
    await reload(); onChanged(); setBusy(false)
  }

  const payout = async () => {
    if (!confirm(t("payout_confirm"))) return
    setBusy(true)
    const res = await fetch(`/api/admin/affiliates/${userId}/payout`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}),
    })
    if (res.ok) { const j = await res.json(); alert(t("payout_done", { amount: baht(j.amount), count: j.count })) }
    else alert((await res.json()).error || t("error_save"))
    await reload(); onChanged(); setBusy(false)
  }

  const deleteCode = async (codeId: string, code: string) => {
    if (!confirm(t("delete_code_confirm", { code }))) return
    setBusy(true)
    const res = await fetch(`/api/admin/discount-codes/${codeId}`, { method: "DELETE" })
    if (!res.ok) alert((await res.json().catch(() => ({}))).error || t("error_save"))
    await reload(); onChanged(); setBusy(false)
  }

  const removeAffiliate = async () => {
    if (!confirm(t("delete_confirm"))) return
    setBusy(true)
    const res = await fetch(`/api/admin/affiliates/${userId}`, { method: "DELETE" })
    setBusy(false)
    if (res.ok) { onChanged(); onClose(); return }
    const j = await res.json().catch(() => ({}))
    if (j.errorCode === "PENDING_EXISTS") alert(t("delete_pending", { amount: baht(j.pending_amount ?? 0) }))
    else alert(j.error || t("error_save"))
  }

  const link = d ? `${typeof window !== "undefined" ? window.location.origin : ""}/r/` : ""

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/60 backdrop-blur-sm p-2 sm:p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 12 }}
        transition={{ type: "spring", damping: 26, stiffness: 320 }}
        className="w-full max-w-3xl bg-bg-card border border-accent/15 rounded-2xl overflow-hidden max-h-[95vh] flex flex-col shadow-2xl shadow-black/40"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between sticky top-0 bg-bg-card z-10">
          <div>
            <h2 className="text-[15px] font-bold">{d?.profile.display_name || d?.profile.username || "…"}</h2>
            <p className="text-[11px] text-text-muted">{d?.profile.email}</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={removeAffiliate} disabled={busy || !d}
              className="text-[12px] px-2.5 py-1 rounded-lg text-red-400 hover:bg-red-500/10 disabled:opacity-40 transition">
              {t("delete_affiliate")}
            </button>
            <button onClick={onClose} className="w-7 h-7 rounded-md hover:bg-white/5 text-text-muted flex items-center justify-center">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
            </button>
          </div>
        </div>

        {!d ? (
          <div className="p-10 text-center text-text-muted">{t("loading")}</div>
        ) : (
          <div className="overflow-y-auto p-4 space-y-5">
            {/* Profile edit */}
            <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <Field label={t("field_rate")}>
                <input type="number" defaultValue={d.profile.default_commission_pct}
                  onBlur={(e) => patchProfile({ default_commission_pct: Number(e.target.value) })}
                  className="w-full bg-bg-base border border-accent/15 rounded-lg px-2.5 py-1.5 text-[13px]" />
              </Field>
              <Field label={t("field_payout_method")}>
                <input defaultValue={d.profile.payout_method ?? ""} onBlur={(e) => patchProfile({ payout_method: e.target.value })}
                  className="w-full bg-bg-base border border-accent/15 rounded-lg px-2.5 py-1.5 text-[13px]" />
              </Field>
              <Field label={t("field_payout_detail")}>
                <input defaultValue={d.profile.payout_detail ?? ""} onBlur={(e) => patchProfile({ payout_detail: e.target.value })}
                  className="w-full bg-bg-base border border-accent/15 rounded-lg px-2.5 py-1.5 text-[13px]" />
              </Field>
              <Field label={t("field_status")}>
                <button onClick={() => patchProfile({ is_active: !d.profile.is_active })} disabled={busy}
                  className={`w-full px-2.5 py-1.5 rounded-lg text-[12px] font-medium ${d.profile.is_active ? "bg-green-500/15 text-green-400" : "bg-white/10 text-text-muted"}`}>
                  {d.profile.is_active ? t("active") : t("paused")}
                </button>
              </Field>
            </section>

            {/* Codes + create */}
            <section>
              <p className="text-[11px] uppercase tracking-wider text-text-muted mb-2 font-bold">{t("codes")}</p>
              <div className="space-y-1.5">
                {d.codes.length === 0 && <p className="text-[12px] text-text-muted">{t("no_codes")}</p>}
                {d.codes.map((c) => (
                  <CodeItem key={c.id} code={c} products={d.products} defaultPct={d.profile.default_commission_pct}
                    link={link} busy={busy} t={t}
                    onCopy={() => navigator.clipboard?.writeText(`${link}${c.code}`)}
                    onDelete={() => deleteCode(c.id, c.code)}
                    onSaved={() => { reload(); onChanged() }} />
                ))}
              </div>
              <CreateCode userId={userId} products={d.products} defaultPct={d.profile.default_commission_pct} onDone={() => { reload(); onChanged() }} t={t} />
            </section>

            {/* Earnings */}
            <section>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] uppercase tracking-wider text-text-muted font-bold">{t("earnings")}</p>
                <button onClick={payout} disabled={busy || d.profile.pending_amount <= 0}
                  className="px-3 py-1.5 rounded-lg bg-accent text-white text-[12px] font-medium hover:bg-accent/90 disabled:opacity-40">
                  {t("pay_pending")}{d.profile.pending_amount > 0 ? ` (${baht(d.profile.pending_amount)})` : ""}
                </button>
              </div>
              <div className="max-h-[30vh] overflow-y-auto space-y-1">
                {d.earnings.length === 0 && <p className="text-[12px] text-text-muted">{t("no_earnings")}</p>}
                {d.earnings.map((e) => (
                  <div key={e.id} className="flex items-center justify-between text-[12px] bg-bg-base/50 rounded-lg px-3 py-1.5">
                    <span className="text-text-muted">{new Date(e.created_at).toLocaleDateString()} · {e.product_name ?? "—"}</span>
                    <span className="flex items-center gap-2">
                      <span className="font-mono">{baht(e.commission_amount)}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                        e.clawback ? "bg-red-500/20 text-red-400"
                        : e.status === "paid" ? "bg-green-500/15 text-green-400"
                        : e.status === "reversed" ? "bg-white/10 text-text-muted"
                        : "bg-amber-500/15 text-amber-400"}`}>
                        {e.clawback ? t("clawback") : t(`status_${e.status}`)}
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            </section>

            {/* API access */}
            <section>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] uppercase tracking-wider text-text-muted font-bold">{t("api_access")}</p>
                <button onClick={() => patchProfile({ api_enabled: !d.profile.api_enabled })} disabled={busy}
                  className={`text-[11px] px-2.5 py-1 rounded-lg font-medium ${d.profile.api_enabled ? "bg-green-500/15 text-green-400" : "bg-white/10 text-text-muted"}`}>
                  {d.profile.api_enabled ? t("api_on") : t("api_off")}
                </button>
              </div>
              <div className="bg-bg-base/40 border border-white/5 rounded-xl p-3.5 text-[12px] space-y-1.5">
                {d.profile.api_enabled ? (
                  <>
                    {d.profile.api_key_prefix ? (
                      <p>{t("api_key_label")}: <span className="font-mono text-text-base">{d.profile.api_key_prefix}…</span>
                        {d.profile.api_key_created_at ? <span className="text-text-muted"> · {new Date(d.profile.api_key_created_at).toLocaleDateString()}</span> : null}</p>
                    ) : (
                      <p className="text-text-muted">{t("api_no_key")}</p>
                    )}
                    <p className="text-text-muted leading-relaxed">{t("api_admin_hint")}</p>
                    {d.profile.api_key_prefix && (
                      <button onClick={() => { if (confirm(t("api_revoke_confirm"))) patchProfile({ revoke_api_key: true }) }} disabled={busy}
                        className="text-[11px] text-red-400 hover:underline disabled:opacity-40">{t("api_revoke")}</button>
                    )}
                  </>
                ) : (
                  <p className="text-text-muted leading-relaxed">{t("api_off_hint")}</p>
                )}
              </div>
            </section>

            {/* Payout history */}
            {d.payouts.length > 0 && (
              <section>
                <p className="text-[11px] uppercase tracking-wider text-text-muted mb-2 font-bold">{t("payout_history")}</p>
                <div className="space-y-1">
                  {d.payouts.map((p) => (
                    <div key={p.id} className="flex items-center justify-between text-[12px] text-text-muted">
                      <span>{new Date(p.paid_at).toLocaleDateString()} {p.method ? `· ${p.method}` : ""}</span>
                      <span className="font-mono text-green-400/80">{baht(p.amount)}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </motion.div>
    </motion.div>
  )
}

const fieldInput = "w-full bg-bg-base border border-accent/15 rounded-lg px-3 py-2 text-[13px] outline-none focus:border-accent/40 transition"

// Display row for one code + an inline editor (toggled by the pencil).
function CodeItem({ code, products, defaultPct, link, busy, onCopy, onDelete, onSaved, t }:
  { code: CodeRow; products: ProductOpt[]; defaultPct: number; link: string; busy: boolean
    onCopy: () => void; onDelete: () => void; onSaved: () => void
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    t: any }) {
  const [editing, setEditing] = useState(false)
  const [c, setC] = useState(code.code)
  const [type, setType] = useState<"percent" | "fixed">(code.type === "fixed" ? "fixed" : "percent")
  const [value, setValue] = useState(String(code.value))
  const [comm, setComm] = useState(code.commission_pct === null ? "" : String(code.commission_pct))
  const [productId, setProductId] = useState(code.product_id ?? "")
  const [perUser, setPerUser] = useState<"1" | "unlimited">(code.per_user_limit == null ? "unlimited" : "1")
  const [active, setActive] = useState(code.is_active)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const save = async () => {
    setErr(null); setSaving(true)
    const res = await fetch(`/api/admin/discount-codes/${code.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: c, type, value: Number(value),
        commission_pct: comm === "" ? null : Number(comm),
        product_id: productId || null, is_active: active,
        per_user_limit: perUser === "unlimited" ? null : 1,
      }),
    })
    setSaving(false)
    if (!res.ok) { setErr((await res.json().catch(() => ({}))).error || t("error_save")); return }
    setEditing(false); onSaved()
  }

  if (editing) {
    return (
      <div className="bg-bg-base border border-accent/25 rounded-lg p-3 space-y-2.5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          <div>
            <label className="block text-[10px] text-text-muted mb-1 uppercase tracking-wider">{t("label_code")}</label>
            <input value={c} onChange={(e) => setC(e.target.value.toUpperCase())} className={`${fieldInput} uppercase`} />
          </div>
          <div>
            <label className="block text-[10px] text-text-muted mb-1 uppercase tracking-wider">{t("label_discount")}</label>
            <div className="flex gap-1.5">
              <select value={type} onChange={(e) => setType(e.target.value as "percent" | "fixed")}
                className="bg-bg-base border border-accent/15 rounded-lg px-2 py-2 text-[13px] shrink-0">
                <option value="percent">%</option><option value="fixed">฿</option>
              </select>
              <input type="number" value={value} onChange={(e) => setValue(e.target.value)} className={fieldInput} />
            </div>
          </div>
          <div>
            <label className="block text-[10px] text-text-muted mb-1 uppercase tracking-wider">{t("label_comm")}</label>
            <input type="number" value={comm} onChange={(e) => setComm(e.target.value)}
              placeholder={t("comm_default_ph", { pct: defaultPct })} className={fieldInput} />
          </div>
          <div>
            <label className="block text-[10px] text-text-muted mb-1 uppercase tracking-wider">{t("label_product")}</label>
            <select value={productId} onChange={(e) => setProductId(e.target.value)} className={fieldInput}>
              <option value="">{t("all_products")}</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] text-text-muted mb-1 uppercase tracking-wider">{t("label_per_user")}</label>
            <select value={perUser} onChange={(e) => setPerUser(e.target.value as "1" | "unlimited")} className={fieldInput}>
              <option value="1">{t("per_user_once")}</option>
              <option value="unlimited">{t("per_user_unlimited")}</option>
            </select>
          </div>
        </div>
        {err && <p className="text-[12px] text-red-400">{err}</p>}
        <div className="flex items-center justify-between">
          <button onClick={() => setActive((v) => !v)}
            className={`text-[11px] px-2.5 py-1 rounded-lg font-medium ${active ? "bg-green-500/15 text-green-400" : "bg-white/10 text-text-muted"}`}>
            {active ? t("active") : t("inactive")}
          </button>
          <div className="flex gap-2">
            <button onClick={() => setEditing(false)} className="text-[12px] px-3 py-1.5 rounded-lg text-text-muted hover:bg-white/5">{t("cancel")}</button>
            <button onClick={save} disabled={saving}
              className="text-[12px] px-3 py-1.5 rounded-lg bg-accent text-white font-medium hover:bg-accent/90 disabled:opacity-50">
              {saving ? t("saving") : t("save")}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 bg-bg-base border rounded-lg px-3 py-2.5 text-[12px] transition-all duration-200 hover:border-accent/25 ${code.is_active ? "border-white/5" : "border-white/5 opacity-50"}`}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 min-w-0">
        <span className="font-mono font-semibold">{code.code}</span>
        <span className="text-text-muted">−{code.type === "fixed" ? `฿${code.value}` : `${code.value}%`}</span>
        <span className="text-amber-400/80">· {t("comm")} {code.commission_pct ?? defaultPct}%</span>
        <span className="text-text-muted truncate max-w-[140px]">· {code.product_name ?? t("all_products")}</span>
        {code.per_user_limit == null && <span className="text-green-400/80 shrink-0">· {t("per_user_unlimited_badge")}</span>}
        {!code.is_active && <span className="text-text-muted">· {t("inactive")}</span>}
      </div>
      <div className="shrink-0 flex items-center gap-3 ml-auto">
        <button onClick={() => setEditing(true)} className="text-[11px] text-accent-light hover:underline">{t("edit")}</button>
        <button onClick={onCopy} className="text-[11px] text-accent-light hover:underline">{t("copy_link")}</button>
        <button onClick={onDelete} disabled={busy} title={t("delete_code")}
          className="text-text-muted hover:text-red-400 disabled:opacity-40 transition">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
          </svg>
        </button>
      </div>
    </div>
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CreateCode({ userId, products, defaultPct, onDone, t }: { userId: string; products: ProductOpt[]; defaultPct: number; onDone: () => void; t: any }) {
  const [code, setCode] = useState("")
  const [value, setValue] = useState("10")
  const [type, setType] = useState<"percent" | "fixed">("percent")
  const [comm, setComm] = useState("")
  const [productId, setProductId] = useState("")
  const [perUser, setPerUser] = useState<"1" | "unlimited">("1")
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const submit = async () => {
    setErr(null); setBusy(true)
    const res = await fetch("/api/admin/discount-codes", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: code || undefined, type, value: Number(value),
        owner_user_id: userId, commission_pct: comm === "" ? null : Number(comm),
        product_id: productId || null, per_user_limit: perUser === "unlimited" ? null : 1, max_uses: null,
      }),
    })
    setBusy(false)
    if (!res.ok) { setErr((await res.json()).error || t("error_save")); return }
    setCode(""); setComm(""); setValue("10"); setProductId(""); setPerUser("1"); onDone()
  }

  return (
    <div className="mt-4 bg-bg-base/40 border border-white/5 rounded-xl p-4">
      <p className="text-[11px] uppercase tracking-wider text-text-muted mb-3 font-bold">{t("add_code_title")}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <div>
          <label className="block text-[10px] text-text-muted mb-1 uppercase tracking-wider">{t("label_code")}</label>
          <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder={t("code_ph")}
            className={`${fieldInput} uppercase`} />
        </div>
        <div>
          <label className="block text-[10px] text-text-muted mb-1 uppercase tracking-wider">{t("label_discount")}</label>
          <div className="flex gap-1.5">
            <select value={type} onChange={(e) => setType(e.target.value as "percent" | "fixed")}
              className="bg-bg-base border border-accent/15 rounded-lg px-2 py-2 text-[13px] shrink-0">
              <option value="percent">%</option><option value="fixed">฿</option>
            </select>
            <input type="number" value={value} onChange={(e) => setValue(e.target.value)}
              placeholder={type === "percent" ? "10" : "50"} className={fieldInput} />
          </div>
        </div>
        <div>
          <label className="block text-[10px] text-text-muted mb-1 uppercase tracking-wider">{t("label_comm")}</label>
          <input type="number" value={comm} onChange={(e) => setComm(e.target.value)}
            placeholder={t("comm_default_ph", { pct: defaultPct })} className={fieldInput} />
        </div>
        <div>
          <label className="block text-[10px] text-text-muted mb-1 uppercase tracking-wider">{t("label_product")}</label>
          <select value={productId} onChange={(e) => setProductId(e.target.value)} className={fieldInput}>
            <option value="">{t("all_products")}</option>
            {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[10px] text-text-muted mb-1 uppercase tracking-wider">{t("label_per_user")}</label>
          <select value={perUser} onChange={(e) => setPerUser(e.target.value as "1" | "unlimited")} className={fieldInput}>
            <option value="1">{t("per_user_once")}</option>
            <option value="unlimited">{t("per_user_unlimited")}</option>
          </select>
        </div>
      </div>
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mt-3">
        <p className="text-[11px] text-text-muted leading-relaxed sm:max-w-[70%]">{t("add_code_hint", { pct: defaultPct })}</p>
        <button onClick={submit} disabled={busy}
          className="shrink-0 px-5 py-2 rounded-lg bg-accent text-white text-[13px] font-medium hover:bg-accent/90 active:scale-95 transition-all disabled:opacity-50">
          {busy ? t("saving") : t("add_code")}
        </button>
      </div>
      {err && <p className="text-[12px] text-red-400 mt-2">{err}</p>}
    </div>
  )
}

// One withdrawal request. "Reject" reveals an inline reason box (required)
// before confirming, so the affiliate always gets told why.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function RequestRow({ r, busy, onPaid, onReject, t }: { r: Req; busy: boolean; onPaid: () => void; onReject: (reason: string) => void; t: any }) {
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState("")
  return (
    <div className="bg-bg-base border border-white/5 rounded-xl px-4 py-3 transition-all duration-200 hover:border-blue-500/25">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[13px] font-medium">{r.username} <span className="text-text-muted font-normal">· {r.email}</span></p>
          <p className="text-[11px] text-text-muted mt-0.5">
            {t("send_to")}: <span className="text-text-base font-mono">{r.method ?? "—"} {r.detail ?? ""}</span>
            {r.requested_at ? ` · ${new Date(r.requested_at).toLocaleDateString()}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="font-mono font-bold text-amber-400 text-[15px] mr-1">{baht(r.amount)}</span>
          {!rejecting && (
            <>
              <button onClick={() => setRejecting(true)} disabled={busy}
                className="text-[12px] px-3 py-1.5 rounded-lg text-text-muted hover:text-red-400 hover:bg-white/5 disabled:opacity-40">{t("req_reject")}</button>
              <button onClick={onPaid} disabled={busy}
                className="text-[12px] px-3 py-1.5 rounded-lg bg-green-500/15 text-green-400 font-medium hover:bg-green-500/25 disabled:opacity-40">{t("req_mark_paid")}</button>
            </>
          )}
        </div>
      </div>
      {rejecting && (
        <div className="mt-3">
          <label className="block text-[11px] text-text-muted mb-1.5 uppercase tracking-wider">{t("reject_reason_label")}</label>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t("reject_reason_ph")}
            rows={4}
            className="w-full bg-bg-card border border-red-500/20 rounded-lg px-3 py-2.5 text-[13px] leading-relaxed resize-y focus:border-red-500/45 outline-none transition-colors" autoFocus />
          <p className="text-[11px] text-text-muted mt-1">{t("reject_reason_hint")}</p>
          <div className="flex items-center justify-end gap-2 mt-2.5">
            <button onClick={() => { setRejecting(false); setReason("") }} disabled={busy}
              className="text-[12px] px-3.5 py-2 rounded-lg text-text-muted hover:bg-white/5">{t("cancel")}</button>
            <button onClick={() => onReject(reason.trim())} disabled={busy || !reason.trim()}
              className="text-[12px] px-3.5 py-2 rounded-lg bg-red-500/15 text-red-400 font-medium hover:bg-red-500/25 disabled:opacity-40">{t("confirm_reject")}</button>
          </div>
        </div>
      )}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] text-text-muted mb-1 uppercase tracking-wider">{label}</label>
      {children}
    </div>
  )
}

// Controlled min-withdrawal input. Syncs from the loaded value (fixes the old
// uncontrolled input that always showed 0), saves on blur/Enter, and flashes a
// "saved" confirmation so the admin knows it persisted.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function MinWithdrawSetting({ value, onSave, t }: { value: number; onSave: (v: number) => Promise<boolean>; t: any }) {
  const [val, setVal] = useState(String(value ?? 0))
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  // Reflect the value once it loads / after a save round-trips.
  useEffect(() => { setVal(String(value ?? 0)) }, [value])

  const commit = async () => {
    const n = Number(val)
    if (!Number.isFinite(n) || n < 0) { setVal(String(value ?? 0)); return }
    if (n === value) return
    setSaving(true)
    const okSave = await onSave(n)
    setSaving(false)
    if (okSave) { setSaved(true); setTimeout(() => setSaved(false), 1800) }
  }

  return (
    <div className="bg-bg-card border border-accent/10 rounded-2xl px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
      <div>
        <p className="text-[12px] font-medium">{t("min_withdraw_label")}</p>
        <p className="text-[11px] text-text-muted">{t("min_withdraw_hint")}</p>
      </div>
      <div className="flex items-center gap-2.5">
        {saved && (
          <span className="text-[11px] text-green-400 flex items-center gap-1">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>
            {t("saved")}
          </span>
        )}
        <div className="flex items-center gap-1.5">
          <span className="text-text-muted text-[13px]">฿</span>
          <input
            type="number"
            value={val}
            onChange={(e) => setVal(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur() }}
            disabled={saving}
            className="w-24 bg-bg-base border border-accent/15 rounded-lg px-3 py-1.5 text-[13px] disabled:opacity-50"
          />
        </div>
      </div>
    </div>
  )
}

// ── KPI card + icons (shared design language with the affiliate dashboard) ─────
const KPI_TONES = {
  accent: { text: "text-accent-light", chip: "bg-accent/12 text-accent-light" },
  blue: { text: "text-blue-400", chip: "bg-blue-500/12 text-blue-300" },
  amber: { text: "text-amber-400", chip: "bg-amber-500/12 text-amber-400" },
  green: { text: "text-green-400", chip: "bg-green-500/12 text-green-400" },
} as const

function Kpi({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone: keyof typeof KPI_TONES }) {
  const c = KPI_TONES[tone]
  return (
    <div className="bg-bg-card border border-accent/10 rounded-2xl p-5 transition-all duration-200 hover:border-accent/25 hover:-translate-y-0.5">
      <div className="flex items-center gap-2.5 mb-2.5">
        <span className={`w-8 h-8 rounded-lg flex items-center justify-center ${c.chip}`}>{icon}</span>
        <p className="text-[11px] tracking-widest text-text-muted uppercase leading-tight">{label}</p>
      </div>
      <p className={`text-[24px] font-bold leading-none ${c.text}`}>{value}</p>
    </div>
  )
}

const kIcon = { width: 15, height: 15, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const }
function UsersIcon() { return <svg {...kIcon}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg> }
function WalletIcon() { return <svg {...kIcon}><path d="M20 12V8H6a2 2 0 0 1-2-2c0-1.1.9-2 2-2h12v4" /><path d="M4 6v12a2 2 0 0 0 2 2h14v-4" /><path d="M18 12a2 2 0 0 0 0 4h4v-4Z" /></svg> }
function ClockIcon() { return <svg {...kIcon}><circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 15 14" /></svg> }
function CheckIcon() { return <svg {...kIcon}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg> }
