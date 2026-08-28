"use client"

import { useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { useTranslations, useLocale } from "next-intl"

type Split = { partner_id: string; pct: number }
type PartnerProduct = {
  id: string
  external_slug: string
  name_th: string
  name_en: string
  badge: string | null
  thumbnail_url: string | null
  ref_url: string
  price_from_thb: number | null
  plans_count: number
  is_visible: boolean
  sort_order: number
  preview_video_url: string | null
  commission_pending_thb: number
  commission_paid_thb: number
  sales_count: number
  splits: Split[]
}
type Store = {
  id: string
  key: string
  display_name: string
  site_url: string | null
  ref_slug: string | null
  commission_pct: number | null
  is_active: boolean
  last_synced_at: string | null
  last_sync_error: string | null
  products: PartnerProduct[]
}
type Configured = { key: string; display_name: string; envKey: string }
type Partner = { id: string; name: string }

const baht = (n: number) => `฿${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`

export default function PartnerStoreClient({
  stores, configured, partners,
}: { stores: Store[]; configured: Configured[]; partners: Partner[] }) {
  const t = useTranslations("Admin")
  const locale = useLocale()
  const router = useRouter()
  const [syncing, setSyncing] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [editing, setEditing] = useState<string | null>(null)

  const partnerName = (id: string) => partners.find((p) => p.id === id)?.name ?? "—"
  const syncedKeys = new Set(stores.map((s) => s.key))
  const notSynced = configured.filter((c) => !syncedKeys.has(c.key))

  // Earnings summary per person: their share of every game's commission.
  const summary = useMemo(() => {
    const m = new Map<string, { paid: number; pending: number }>()
    for (const s of stores) for (const p of s.products) for (const sp of p.splits) {
      const cur = m.get(sp.partner_id) ?? { paid: 0, pending: 0 }
      cur.paid += (p.commission_paid_thb * sp.pct) / 100
      cur.pending += (p.commission_pending_thb * sp.pct) / 100
      m.set(sp.partner_id, cur)
    }
    return m
  }, [stores])

  const runSync = async (key?: string) => {
    setSyncing(key ?? "all"); setMsg(null)
    try {
      const r = await fetch("/api/admin/partner-store/sync", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(key ? { key } : {}),
      })
      const data = await r.json().catch(() => null)
      if (!r.ok) setMsg(`❌ ${t("sync_error")}: ${data?.result ? JSON.stringify(data.result) : r.status}`)
      else { setMsg(`✅ ${t("sync_done")}`); router.refresh() }
    } catch (e) {
      setMsg(`❌ ${e instanceof Error ? e.message : "sync failed"}`)
    } finally { setSyncing(null) }
  }

  const toggleVisible = async (p: PartnerProduct) => {
    setBusy(p.id)
    try {
      const r = await fetch(`/api/admin/partner-store/products/${p.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_visible: !p.is_visible }),
      })
      if (r.ok) router.refresh()
    } finally { setBusy(null) }
  }

  return (
    <div className="p-5 sm:p-8 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-text-base">{t("partner_store")}</h1>
        <p className="text-[13px] text-text-muted mt-1">{t("partner_store_desc")}</p>
      </div>

      {msg && <div className="text-[13px] px-4 py-2 rounded-lg bg-bg-card border border-accent/10">{msg}</div>}

      {/* Earnings summary per person */}
      {summary.size > 0 && (
        <div className="bg-bg-card border border-accent/10 rounded-2xl p-5">
          <p className="text-[13px] font-semibold text-text-base mb-3">{t("earnings_summary")}</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[...summary.entries()].map(([pid, v]) => (
              <div key={pid} className="bg-bg-base/50 border border-white/5 rounded-xl p-3">
                <p className="text-[13px] font-medium text-text-base truncate">{partnerName(pid)}</p>
                <p className="text-[17px] font-bold text-green-400 mt-1">{baht(v.paid)}</p>
                <p className="text-[11px] text-text-muted">{t("pending")}: {baht(v.pending)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Configured-but-not-synced partners */}
      {notSynced.map((c) => (
        <div key={c.key} className="bg-bg-card border border-yellow-500/20 rounded-2xl p-5 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <p className="text-[14px] font-semibold text-text-base">{c.display_name}</p>
            <p className="text-[12px] text-text-muted mt-0.5">{t("set_env_hint")} <code className="text-accent-light">{c.envKey}</code></p>
          </div>
          <button onClick={() => runSync(c.key)} disabled={syncing !== null}
            className="px-4 py-2 rounded-lg bg-accent text-white text-[13px] font-semibold hover:opacity-90 disabled:opacity-50">
            {syncing === c.key ? t("syncing") : t("sync_now")}
          </button>
        </div>
      ))}

      {stores.map((store) => (
        <div key={store.id} className="bg-bg-card border border-accent/10 rounded-2xl overflow-hidden">
          <div className="p-5 flex items-start justify-between gap-4 flex-wrap border-b border-white/5">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase bg-violet-500 text-white px-2 py-0.5 rounded-full">Partner</span>
                <p className="text-[15px] font-bold text-text-base">{store.display_name}</p>
              </div>
              <p className="text-[12px] text-text-muted mt-1">
                ref: <span className="text-accent-light">{store.ref_slug ?? "—"}</span> · {t("commission")}: {store.commission_pct ?? "—"}%
                {" · "}
                {store.last_synced_at
                  ? `${t("last_synced")}: ${new Date(store.last_synced_at).toLocaleString(locale === "th" ? "th-TH" : "en-US")}`
                  : t("never_synced")}
              </p>
              {store.last_sync_error && <p className="text-[12px] text-red-400 mt-1">⚠ {t("sync_error")}: {store.last_sync_error}</p>}
            </div>
            <button onClick={() => runSync(store.key)} disabled={syncing !== null}
              className="px-4 py-2 rounded-lg bg-accent text-white text-[13px] font-semibold hover:opacity-90 disabled:opacity-50">
              {syncing === store.key ? t("syncing") : t("sync_now")}
            </button>
          </div>

          {store.products.length === 0 ? (
            <p className="p-5 text-[13px] text-text-muted">{t("no_partner_products")}</p>
          ) : (
            <div className="divide-y divide-white/5">
              {store.products.map((p) => (
                <div key={p.id} className={p.is_visible ? "" : "opacity-60"}>
                  <div className="px-5 py-3 flex items-center gap-3 flex-wrap">
                    {p.thumbnail_url
                      ? <img src={p.thumbnail_url} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                      : <div className="w-10 h-10 rounded-lg bg-accent/20 flex-shrink-0" />}
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] text-text-base font-medium line-clamp-1">{locale === "th" ? p.name_th : p.name_en}</p>
                      <p className="text-[11px] text-text-muted">
                        {p.external_slug} · {t("commission")} {t("realized")}: <span className="text-green-400">{baht(p.commission_paid_thb)}</span>
                        {" · "}{t("pending")}: {baht(p.commission_pending_thb)}
                      </p>
                    </div>

                    <VideoCell product={p} t={t} onDone={() => router.refresh()} />

                    <button onClick={() => setEditing(editing === p.id ? null : p.id)}
                      className="text-[12px] px-3 py-1.5 rounded-lg border border-accent/30 text-accent-light hover:bg-accent/10">
                      {t("split_commission")}{p.splits.length ? ` (${p.splits.length})` : ""}
                    </button>

                    <button onClick={() => toggleVisible(p)} disabled={busy === p.id}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition ${p.is_visible ? "bg-green-500" : "bg-white/15"} disabled:opacity-50`}
                      title={p.is_visible ? t("visible") : t("hidden")}>
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${p.is_visible ? "translate-x-4" : "translate-x-0.5"}`} />
                    </button>
                  </div>

                  {editing === p.id && (
                    <SplitEditor
                      product={p} partners={partners} t={t}
                      onSaved={() => { setEditing(null); router.refresh() }}
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

      {partners.length === 0 && (
        <p className="text-[12px] text-text-muted">{t("no_partners_hint")}</p>
      )}
    </div>
  )
}

// ── Split editor ─────────────────────────────────────────────────────────────
function SplitEditor({
  product, partners, t, onSaved,
}: {
  product: PartnerProduct
  partners: Partner[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  t: any
  onSaved: () => void
}) {
  const [rows, setRows] = useState<Split[]>(
    product.splits.length ? product.splits.map((s) => ({ ...s })) : [{ partner_id: "", pct: 0 }]
  )
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const sum = rows.reduce((a, r) => a + (Number(r.pct) || 0), 0)
  const clean = rows.filter((r) => r.partner_id && Number(r.pct) > 0)
  const dupes = new Set(clean.map((r) => r.partner_id)).size !== clean.length
  const okToSave = clean.length === 0 || (Math.abs(sum - 100) < 0.01 && !dupes)

  const setRow = (i: number, patch: Partial<Split>) =>
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))
  const addRow = () => setRows((rs) => [...rs, { partner_id: "", pct: 0 }])
  const removeRow = (i: number) => setRows((rs) => rs.filter((_, idx) => idx !== i))

  const save = async () => {
    setSaving(true); setErr(null)
    try {
      const r = await fetch(`/api/admin/partner-store/products/${product.id}/splits`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ splits: clean }),
      })
      const data = await r.json().catch(() => null)
      if (!r.ok) { setErr(data?.error === "must_sum_100" ? t("total_must_100") : (data?.error ?? `HTTP ${r.status}`)); return }
      onSaved()
    } catch (e) {
      setErr(e instanceof Error ? e.message : "save failed")
    } finally { setSaving(false) }
  }

  const base = product.commission_paid_thb

  return (
    <div className="px-5 pb-5 pt-1 bg-bg-base/40 border-t border-white/5">
      <p className="text-[12px] text-text-muted mb-3">{t("split_hint")}</p>
      <div className="space-y-2">
        {rows.map((r, i) => {
          const share = base * (Number(r.pct) || 0) / 100
          return (
            <div key={i} className="flex items-center gap-2 flex-wrap">
              <select value={r.partner_id} onChange={(e) => setRow(i, { partner_id: e.target.value })}
                className="flex-1 min-w-[140px] bg-bg-card border border-white/10 rounded-lg px-3 py-2 text-[13px] text-text-base">
                <option value="">— {t("person")} —</option>
                {partners.map((pp) => <option key={pp.id} value={pp.id}>{pp.name}</option>)}
              </select>
              <div className="flex items-center gap-1">
                <input type="number" min={0} max={100} step={0.5} value={r.pct}
                  onChange={(e) => setRow(i, { pct: parseFloat(e.target.value) || 0 })}
                  className="w-20 bg-bg-card border border-white/10 rounded-lg px-3 py-2 text-[13px] text-text-base text-right" />
                <span className="text-text-muted text-[13px]">%</span>
              </div>
              <span className="text-[12px] text-green-400 w-24 text-right">{baht(share)}</span>
              <button onClick={() => removeRow(i)} className="text-text-muted hover:text-red-400 text-[16px] px-1" title={t("remove")}>×</button>
            </div>
          )
        })}
      </div>

      <div className="flex items-center justify-between mt-3 flex-wrap gap-2">
        <button onClick={addRow} className="text-[12px] text-accent-light hover:underline">+ {t("add_person")}</button>
        <div className="flex items-center gap-3">
          <span className={`text-[13px] font-semibold ${clean.length === 0 || Math.abs(sum - 100) < 0.01 ? "text-text-muted" : "text-red-400"}`}>
            {t("sum")}: {sum}%
          </span>
          <button onClick={save} disabled={!okToSave || saving}
            className="px-4 py-2 rounded-lg bg-accent text-white text-[13px] font-semibold hover:opacity-90 disabled:opacity-40">
            {saving ? "..." : t("save")}
          </button>
        </div>
      </div>
      {err && <p className="text-[12px] text-red-400 mt-2">{err}</p>}
      {!okToSave && clean.length > 0 && <p className="text-[12px] text-yellow-400 mt-2">{t("total_must_100")}</p>}
    </div>
  )
}

// ── Hover-preview video upload (per partner game) ────────────────────────────
// Uploads a clip via the shared /api/admin/upload (type=video) — same flow as our
// own products — then saves its URL to the partner game. PRESERVED across syncs.
function VideoCell({
  product, t, onDone,
}: {
  product: PartnerProduct
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  t: any
  onDone: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const has = !!product.preview_video_url

  const patch = async (url: string | null) => {
    const r = await fetch(`/api/admin/partner-store/products/${product.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ preview_video_url: url }),
    })
    if (r.ok) onDone()
    else setErr(`HTTP ${r.status}`)
  }

  const upload = async (file: File) => {
    setBusy(true); setErr(null)
    try {
      const fd = new FormData()
      fd.append("file", file)
      fd.append("type", "video")
      const res = await fetch("/api/admin/upload", { method: "POST", body: fd })
      const data = await res.json().catch(() => null)
      if (!res.ok) { setErr(data?.error ?? "upload failed"); return }
      await patch(data.url)
    } catch (e) {
      setErr(e instanceof Error ? e.message : "failed")
    } finally { setBusy(false) }
  }

  const remove = async () => { setBusy(true); try { await patch(null) } finally { setBusy(false) } }

  return (
    <div className="flex items-center gap-1.5">
      <input ref={inputRef} type="file" accept="video/*" hidden
        onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = "" }} />
      {has ? (
        <>
          <span className="text-[11px] text-green-400 whitespace-nowrap">● {t("hover_video")}</span>
          <button onClick={() => inputRef.current?.click()} disabled={busy} className="text-[11px] text-accent-light hover:underline disabled:opacity-50">{t("change")}</button>
          <button onClick={remove} disabled={busy} title={t("remove")} className="text-[13px] text-text-muted hover:text-red-400 leading-none">×</button>
        </>
      ) : (
        <button onClick={() => inputRef.current?.click()} disabled={busy}
          className="text-[12px] px-3 py-1.5 rounded-lg border border-white/10 text-text-muted hover:bg-white/5 disabled:opacity-50 whitespace-nowrap">
          {busy ? "..." : t("upload_hover_video")}
        </button>
      )}
      {err && <span className="text-[10px] text-red-400">{err}</span>}
    </div>
  )
}
