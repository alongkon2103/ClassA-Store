"use client"

// แท็บ "ของรางวัล" ในหน้า AC Points: รายการ + เปิด/ปิด + แก้ไข/ลบ + ฟอร์มเพิ่ม/แก้ (ฟิลด์ตามประเภท) + คลังโค้ดของ external_code
import { useCallback, useEffect, useState } from "react"
import { useTranslations } from "next-intl"
import { getImageUrl } from "@/lib/getImageUrl"
import type { AdminRewardRow, RewardKind } from "@/lib/pointsRedeem"

type Product = { id: string; name_th: string; name_en: string; type: string }
type Form = {
  id?: string; kind: RewardKind; title_th: string; title_en: string; description_th: string; description_en: string; image_url: string
  cost: string; stock: string; per_user_limit: string; sort_order: string; is_active: boolean
  d_type: "fixed" | "percent"; d_value: string; d_product: string; d_valid_days: string; g_product: string; g_days: string
}
const blank = (): Form => ({ kind: "discount_code", title_th: "", title_en: "", description_th: "", description_en: "", image_url: "", cost: "", stock: "", per_user_limit: "", sort_order: "0", is_active: true, d_type: "fixed", d_value: "", d_product: "", d_valid_days: "30", g_product: "", g_days: "7" })
const input = "bg-bg-base border border-white/10 rounded-xl px-4 py-2.5 text-[14px] text-text-base outline-none focus:border-accent/50 w-full"
const btnPrimary = "px-5 py-2.5 rounded-xl bg-accent hover:opacity-90 text-white text-[13px] font-bold disabled:opacity-50 transition"
const btnGhost = "px-4 py-2 rounded-xl border border-white/10 text-[13px] text-text-muted hover:text-text-base hover:border-white/20 transition disabled:opacity-50"
const API = "/api/admin/points/rewards"

export default function RewardsTab() {
  const t = useTranslations("AdminPoints")
  const [rows, setRows] = useState<AdminRewardRow[] | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [form, setForm] = useState<Form | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [codes, setCodes] = useState("")

  const load = useCallback(async () => {
    const r = await fetch(API, { cache: "no-store" })
    if (r.ok) { const d = await r.json(); setRows(d.rewards); setProducts(d.products) }
  }, [])
  useEffect(() => { void load() }, [load])

  const call = async (method: string, body: object) => {
    setBusy(true); setMsg(null)
    try {
      const r = await fetch(API, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) { setMsg(t("rw_err", { error: d.error === "has_redemptions" ? t("rw_has_redemptions") : String(d.error ?? r.status) })); return null }
      await load()
      return d
    } finally { setBusy(false) }
  }
  const edit = (r: AdminRewardRow) => {
    const c = r.config
    setCodes("")
    setForm({
      id: r.id, kind: r.kind, title_th: r.title_th, title_en: r.title_en, description_th: r.description_th ?? "", description_en: r.description_en ?? "", image_url: r.image_url ?? "",
      cost: String(r.cost), stock: r.stock == null ? "" : String(r.stock), per_user_limit: r.per_user_limit == null ? "" : String(r.per_user_limit), sort_order: String(r.sort_order), is_active: r.is_active,
      d_type: c.type === "percent" ? "percent" : "fixed", d_value: c.value == null ? "" : String(c.value), d_product: (r.kind === "discount_code" ? (c.product_id as string | null) : "") ?? "", d_valid_days: c.valid_days == null ? "30" : String(c.valid_days),
      g_product: (r.kind === "game_days" ? (c.product_id as string) : "") ?? "", g_days: c.days == null ? "7" : String(c.days),
    })
  }
  const save = async () => {
    if (!form) return
    const config = form.kind === "discount_code" ? { type: form.d_type, value: Number(form.d_value), product_id: form.d_product || null, valid_days: Number(form.d_valid_days) }
      : form.kind === "game_days" ? { product_id: form.g_product, days: Number(form.g_days) } : {}
    const body = { id: form.id, kind: form.kind, title_th: form.title_th, title_en: form.title_en, description_th: form.description_th, description_en: form.description_en, image_url: form.image_url || null,
      cost: Number(form.cost), stock: form.stock === "" ? null : Number(form.stock), per_user_limit: form.per_user_limit === "" ? null : Number(form.per_user_limit), sort_order: Number(form.sort_order), is_active: form.is_active, config }
    const d = await call(form.id ? "PATCH" : "POST", body)
    if (d) { setForm(null); setMsg(t("rw_saved")) }
  }
  const upload = async (file: File) => {
    const fd = new FormData(); fd.append("file", file); fd.append("type", "image")
    setBusy(true)
    try {
      const r = await fetch("/api/admin/upload", { method: "POST", body: fd })
      const d = await r.json().catch(() => null)
      if (r.ok && d?.url) setForm((f) => (f ? { ...f, image_url: d.url } : f)); else setMsg(t("rw_err", { error: d?.error ?? r.status }))
    } finally { setBusy(false) }
  }
  const addCodes = async () => {
    if (!form?.id || !codes.trim()) return
    const d = await call("PUT", { id: form.id, codes })
    if (d) { setCodes(""); setMsg(t("rw_codes_added", { added: d.added, skipped: d.skipped })) }
  }
  const gameName = (p: Product | null | undefined) => (p ? `${p.name_th} (${p.type === "desktop_program" ? "PC" : "Roblox"})` : t("rw_all_games"))
  const kindLabel = (k: RewardKind) => t(`rw_kind_${k}`)
  const set = (patch: Partial<Form>) => setForm((f) => (f ? { ...f, ...patch } : f))
  const field = (label: string, el: React.ReactNode) => <label className="block"><span className="text-[12px] text-text-muted">{label}</span><div className="mt-1">{el}</div></label>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        {msg ? <p className="text-[13px] text-text-muted">{msg}</p> : <span />}
        {!form && <button onClick={() => { setCodes(""); setForm(blank()) }} className={btnPrimary}>+ {t("rw_add")}</button>}
      </div>

      {form && (
        <div className="bg-bg-card border border-accent/20 rounded-2xl p-5 grid grid-cols-1 md:grid-cols-2 gap-3">
          {field(t("rw_kind"), (
            <select value={form.kind} disabled={!!form.id} onChange={(e) => set({ kind: e.target.value as RewardKind })} className={input}>
              {(["discount_code", "external_code", "game_days"] as RewardKind[]).map((k) => <option key={k} value={k}>{kindLabel(k)}</option>)}
            </select>
          ))}
          {field(t("rw_cost"), <input type="number" min={1} value={form.cost} onChange={(e) => set({ cost: e.target.value })} className={input} />)}
          {field(t("rw_title_th"), <input value={form.title_th} onChange={(e) => set({ title_th: e.target.value })} maxLength={120} className={input} />)}
          {field(t("rw_title_en"), <input value={form.title_en} onChange={(e) => set({ title_en: e.target.value })} maxLength={120} className={input} />)}
          {field(t("rw_desc_th"), <textarea value={form.description_th} onChange={(e) => set({ description_th: e.target.value })} rows={2} className={input} />)}
          {field(t("rw_desc_en"), <textarea value={form.description_en} onChange={(e) => set({ description_en: e.target.value })} rows={2} className={input} />)}
          {form.kind === "discount_code" && (<>
            {field(t("rw_discount_type"), (
              <select value={form.d_type} onChange={(e) => set({ d_type: e.target.value as "fixed" | "percent" })} className={input}>
                <option value="fixed">{t("rw_fixed")}</option><option value="percent">{t("rw_percent")}</option>
              </select>
            ))}
            {field(t("rw_value"), <input type="number" min={1} value={form.d_value} onChange={(e) => set({ d_value: e.target.value })} className={input} />)}
            {field(t("rw_product"), (
              <select value={form.d_product} onChange={(e) => set({ d_product: e.target.value })} className={input}>
                <option value="">{t("rw_all_games")}</option>
                {products.map((p) => <option key={p.id} value={p.id}>{gameName(p)}</option>)}
              </select>
            ))}
            {field(t("rw_valid_days"), <input type="number" min={1} max={365} value={form.d_valid_days} onChange={(e) => set({ d_valid_days: e.target.value })} className={input} />)}
          </>)}
          {form.kind === "game_days" && (<>
            {field(t("rw_product"), (
              <select value={form.g_product} onChange={(e) => set({ g_product: e.target.value })} className={input}>
                <option value="">—</option>
                {products.map((p) => <option key={p.id} value={p.id}>{gameName(p)}</option>)}
              </select>
            ))}
            {field(t("rw_days"), <input type="number" min={1} max={3650} value={form.g_days} onChange={(e) => set({ g_days: e.target.value })} className={input} />)}
          </>)}
          {form.kind !== "external_code" && field(t("rw_stock"), <input type="number" min={0} value={form.stock} onChange={(e) => set({ stock: e.target.value })} className={input} />)}
          {field(t("rw_per_user"), <input type="number" min={1} value={form.per_user_limit} onChange={(e) => set({ per_user_limit: e.target.value })} className={input} />)}
          {field(t("rw_sort"), <input type="number" value={form.sort_order} onChange={(e) => set({ sort_order: e.target.value })} className={input} />)}
          {field(t("rw_image"), (
            <div className="flex items-center gap-3">
              {form.image_url && <img src={getImageUrl(form.image_url)} alt="" className="w-16 h-10 rounded-lg object-cover" />}
              <label className={`${btnGhost} cursor-pointer`}>{t("rw_upload")}<input type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void upload(f) }} /></label>
              {form.image_url && <button onClick={() => set({ image_url: "" })} className="text-[12px] text-text-dim hover:text-hot">✕</button>}
            </div>
          ))}
          <label className="flex items-center gap-2 text-[13px] text-text-muted"><input type="checkbox" checked={form.is_active} onChange={(e) => set({ is_active: e.target.checked })} />{t("rw_active")}</label>
          {form.kind === "external_code" && form.id && (
            <div className="md:col-span-2 rounded-xl border border-white/10 p-4">
              <p className="text-[13px] font-semibold text-text-base">{t("rw_codes")} · {t("rw_codes_left", { left: rows?.find((r) => r.id === form.id)?.codes_left ?? 0, total: rows?.find((r) => r.id === form.id)?.codes_total ?? 0 })}</p>
              <textarea value={codes} onChange={(e) => setCodes(e.target.value)} rows={4} placeholder={t("rw_codes_add")} className={`${input} mt-2 font-mono text-[12px]`} />
              <button onClick={addCodes} disabled={busy || !codes.trim()} className={`${btnGhost} mt-2`}>{t("rw_codes_add")}</button>
            </div>
          )}
          {form.kind === "external_code" && !form.id && <p className="md:col-span-2 text-[12px] text-text-dim">{t("rw_codes_after_save")}</p>}
          <div className="md:col-span-2 flex justify-end gap-2">
            <button onClick={() => setForm(null)} disabled={busy} className={btnGhost}>{t("rw_cancel")}</button>
            <button onClick={save} disabled={busy || !form.cost || (!form.title_th && !form.title_en) || (form.kind === "game_days" && !form.g_product)} className={btnPrimary}>{t("rw_save")}</button>
          </div>
        </div>
      )}

      <div className="bg-bg-card border border-white/5 rounded-2xl overflow-hidden">
        {rows === null ? <p className="p-5 text-[13px] text-text-muted">{t("loading")}</p>
          : rows.length === 0 ? <p className="p-5 text-[13px] text-text-muted">{t("rw_empty")}</p>
          : (
            <div className="divide-y divide-white/5">
              {rows.map((r) => (
                <div key={r.id} className={`px-5 py-3 flex items-center gap-3 flex-wrap ${r.is_active ? "" : "opacity-60"}`}>
                  <div className="w-16 h-10 rounded-lg bg-bg-base overflow-hidden shrink-0">{r.image_url && <img src={getImageUrl(r.image_url)} alt="" className="w-full h-full object-cover" />}</div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold text-text-base truncate">{r.title_th}{r.title_en !== r.title_th ? ` · ${r.title_en}` : ""}</p>
                    <p className="text-[11px] text-text-muted">
                      {kindLabel(r.kind)} · <span className="text-gold font-semibold">{r.cost.toLocaleString()} pts</span>
                      {r.kind === "game_days" && ` · +${String(r.config.days)} ${t("rw_days_unit")} · ${gameName(r.product)}`}
                      {r.kind === "discount_code" && ` · ${r.config.type === "percent" ? `${String(r.config.value)}%` : `฿${String(r.config.value)}`} · ${gameName(r.product)}`}
                      {r.kind === "external_code" ? ` · ${t("rw_codes_left", { left: r.codes_left, total: r.codes_total })}` : r.stock != null ? ` · ${t("rw_stock_left", { n: r.stock })}` : ""}
                      {` · ${t("rw_redeemed", { n: r.redemptions })}`}
                    </p>
                  </div>
                  <button onClick={() => edit(r)} className={btnGhost}>{t("rw_edit")}</button>
                  <button onClick={() => call("PATCH", { id: r.id, is_active: !r.is_active })} disabled={busy}
                          className={`relative inline-flex h-5 w-9 items-center rounded-full transition ${r.is_active ? "bg-green-500" : "bg-white/15"} disabled:opacity-50`} title={t("rw_active")}>
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${r.is_active ? "translate-x-4" : "translate-x-0.5"}`} />
                  </button>
                  <button onClick={() => { if (confirm(t("rw_delete_confirm", { title: r.title_th }))) void call("DELETE", { id: r.id }) }} disabled={busy}
                          className="text-[12px] px-2.5 py-1 rounded-lg border border-hot/30 text-hot hover:bg-hot/10 disabled:opacity-50">{t("rw_delete")}</button>
                </div>
              ))}
            </div>
          )}
      </div>
    </div>
  )
}
