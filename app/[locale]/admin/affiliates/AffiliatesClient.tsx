"use client"

import { useCallback, useEffect, useState } from "react"
import { useTranslations } from "next-intl"

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
}

type Detail = {
  profile: ListRow
  codes: {
    id: string; code: string; type: string; value: number
    commission_pct: number | null; is_active: boolean
    used_count: number; max_uses: number | null; product_name: string | null
  }[]
  earnings: {
    id: string; base_amount: number; commission_pct: number; commission_amount: number
    status: string; clawback: boolean; created_at: string; paid_at: string | null; product_name: string | null
  }[]
  payouts: { id: string; amount: number; method: string | null; note: string | null; paid_at: string }[]
}

const baht = (n: number) => `฿${n.toLocaleString(undefined, { minimumFractionDigits: 2 })}`

export default function AffiliatesClient() {
  const t = useTranslations("AdminAffiliates")
  const [rows, setRows] = useState<ListRow[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const r = await fetch("/api/admin/affiliates")
    setRows(r.ok ? await r.json() : [])
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  const totalPending = rows.reduce((s, r) => s + r.pending_amount, 0)
  const totalPaid = rows.reduce((s, r) => s + r.paid_amount, 0)

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-[22px] sm:text-[26px] font-bold">{t("title")}</h1>
          <p className="text-text-muted text-[12px] sm:text-[13px] mt-1">{t("subtitle")}</p>
        </div>
        <button
          onClick={() => setShowCreate((v) => !v)}
          className="px-4 py-2 rounded-xl bg-accent text-white text-[13px] font-medium hover:bg-accent/90 self-start sm:self-auto"
        >
          {showCreate ? t("cancel") : t("new_affiliate")}
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-bg-card border border-accent/10 rounded-2xl p-5">
          <p className="text-[11px] tracking-widest text-text-muted uppercase mb-2">{t("affiliates")}</p>
          <p className="text-[24px] font-bold">{rows.length}</p>
        </div>
        <div className="bg-bg-card border border-accent/10 rounded-2xl p-5">
          <p className="text-[11px] tracking-widest text-text-muted uppercase mb-2">{t("total_pending")}</p>
          <p className="text-[24px] font-bold text-amber-400">{baht(totalPending)}</p>
        </div>
        <div className="bg-bg-card border border-accent/10 rounded-2xl p-5">
          <p className="text-[11px] tracking-widest text-text-muted uppercase mb-2">{t("total_paid")}</p>
          <p className="text-[24px] font-bold text-green-400">{baht(totalPaid)}</p>
        </div>
      </div>

      {showCreate && <CreateForm onDone={() => { setShowCreate(false); load() }} t={t} />}

      <div className="bg-bg-card border border-accent/10 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px] min-w-[720px]">
            <thead>
              <tr className="text-left text-[11px] text-text-muted border-b border-white/5">
                <th className="px-4 py-3 font-medium">{t("col_affiliate")}</th>
                <th className="px-4 py-3 font-medium text-right">{t("col_rate")}</th>
                <th className="px-4 py-3 font-medium text-right">{t("col_codes")}</th>
                <th className="px-4 py-3 font-medium text-right">{t("col_pending")}</th>
                <th className="px-4 py-3 font-medium text-right">{t("col_paid")}</th>
                <th className="px-4 py-3 font-medium">{t("col_status")}</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                <tr><td colSpan={7} className="text-center py-12 text-text-muted">{t("loading")}</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-text-muted">{t("empty")}</td></tr>
              ) : rows.map((r) => (
                <tr key={r.user_id} className="hover:bg-white/[0.02]">
                  <td className="px-4 py-3">
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
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => setOpenId(r.user_id)} className="text-[12px] text-accent-light hover:underline">
                      {t("manage")}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {openId && (
        <DetailModal userId={openId} onClose={() => setOpenId(null)} onChanged={load} t={t} />
      )}
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
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/60 p-2 sm:p-4" onClick={onClose}>
      <div className="w-full max-w-3xl bg-bg-card border border-accent/15 rounded-2xl overflow-hidden max-h-[95vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
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
            <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
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
                  <div key={c.id} className="flex items-center justify-between bg-bg-base border border-white/5 rounded-lg px-3 py-2 text-[12px]">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-mono font-semibold">{c.code}</span>
                      <span className="text-text-muted">−{c.type === "fixed" ? `฿${c.value}` : `${c.value}%`}</span>
                      <span className="text-amber-400/80">· {t("comm")} {c.commission_pct ?? d.profile.default_commission_pct}%</span>
                      {c.product_name && <span className="text-text-muted truncate">· {c.product_name}</span>}
                    </div>
                    <button
                      onClick={() => navigator.clipboard?.writeText(`${link}${c.code}`)}
                      className="shrink-0 text-[11px] text-accent-light hover:underline">{t("copy_link")}</button>
                  </div>
                ))}
              </div>
              <CreateCode userId={userId} defaultPct={d.profile.default_commission_pct} onDone={() => { reload(); onChanged() }} t={t} />
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
      </div>
    </div>
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CreateCode({ userId, defaultPct, onDone, t }: { userId: string; defaultPct: number; onDone: () => void; t: any }) {
  const [code, setCode] = useState("")
  const [value, setValue] = useState("10")
  const [type, setType] = useState<"percent" | "fixed">("percent")
  const [comm, setComm] = useState("")
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const submit = async () => {
    setErr(null); setBusy(true)
    const res = await fetch("/api/admin/discount-codes", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: code || undefined, type, value: Number(value),
        owner_user_id: userId, commission_pct: comm === "" ? null : Number(comm),
        per_user_limit: 1, max_uses: null,
      }),
    })
    setBusy(false)
    if (!res.ok) { setErr((await res.json()).error || t("error_save")); return }
    setCode(""); setComm(""); setValue("10"); onDone()
  }

  const inputCls = "w-full bg-bg-base border border-accent/15 rounded-lg px-3 py-2 text-[13px] outline-none focus:border-accent/40 transition"

  return (
    <div className="mt-3 border-t border-white/10 pt-4">
      <p className="text-[11px] uppercase tracking-wider text-text-muted mb-3 font-bold">{t("add_code_title")}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div>
          <label className="block text-[10px] text-text-muted mb-1 uppercase tracking-wider">{t("label_code")}</label>
          <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder={t("code_ph")}
            className={`${inputCls} uppercase`} />
        </div>
        <div>
          <label className="block text-[10px] text-text-muted mb-1 uppercase tracking-wider">{t("label_discount")}</label>
          <div className="flex gap-1.5">
            <select value={type} onChange={(e) => setType(e.target.value as "percent" | "fixed")}
              className="bg-bg-base border border-accent/15 rounded-lg px-2 py-2 text-[13px] shrink-0">
              <option value="percent">%</option><option value="fixed">฿</option>
            </select>
            <input type="number" value={value} onChange={(e) => setValue(e.target.value)}
              placeholder={type === "percent" ? "10" : "50"} className={inputCls} />
          </div>
        </div>
        <div>
          <label className="block text-[10px] text-text-muted mb-1 uppercase tracking-wider">{t("label_comm")}</label>
          <input type="number" value={comm} onChange={(e) => setComm(e.target.value)}
            placeholder={t("comm_default_ph", { pct: defaultPct })} className={inputCls} />
        </div>
        <div className="flex items-end">
          <button onClick={submit} disabled={busy}
            className="w-full px-3 py-2 rounded-lg bg-accent text-white text-[13px] font-medium hover:bg-accent/90 disabled:opacity-50">
            {busy ? t("saving") : t("add_code")}
          </button>
        </div>
      </div>
      <p className="text-[11px] text-text-muted mt-2 leading-relaxed">{t("add_code_hint", { pct: defaultPct })}</p>
      {err && <p className="text-[12px] text-red-400 mt-1">{err}</p>}
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
