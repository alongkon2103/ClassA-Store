"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

const blankVariant = {
  label_en: "", label_th: "",
  duration_type: "permanent", duration_days: "",
  price: "", sort_order: 0, is_active: true,
}

export default function VariantManager({ productId, variants }: { productId: string; variants: any[] }) {
  const router = useRouter()
  const [list, setList]     = useState(variants)
  const [adding, setAdding] = useState(false)
  const [form, setForm]     = useState({ ...blankVariant })
  const [saving, setSaving] = useState(false)

  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }))

  const handleAdd = async () => {
    if (!form.label_en || !form.price) { alert("Fill label and price"); return }
    setSaving(true)
    const res = await fetch(`/api/admin/products/${productId}/variants`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        price: Number(form.price),
        duration_days: form.duration_type === "days" ? Number(form.duration_days) : null,
      }),
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) { alert(data.error); return }
    setList((l) => [...l, { ...data, price: Number(data.price) }])
    setForm({ ...blankVariant })
    setAdding(false)
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Delete variant?")) return
    await fetch(`/api/admin/products/${productId}/variants/${id}`, { method: "DELETE" })
    setList((l) => l.filter((v) => v.id !== id))
  }

  const handleToggle = async (id: string, current: boolean) => {
    await fetch(`/api/admin/products/${productId}/variants/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !current }),
    })
    setList((l) => l.map((v) => v.id === id ? { ...v, is_active: !current } : v))
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-[13px] text-text-muted">{list.length} variant(s)</p>
        <button onClick={() => setAdding(true)}
          className="text-[13px] px-4 py-2 rounded-xl bg-accent/15 text-accent-light hover:bg-accent/25 transition">
          + Add Variant
        </button>
      </div>

      {/* List */}
      <div className="space-y-2">
        {list.map((v) => (
          <div key={v.id}
            className="flex items-center justify-between bg-bg-base border border-accent/10 rounded-xl px-4 py-3">
            <div>
              <div className="flex items-center gap-2">
                <p className="text-[13px] font-medium">{v.label_en}</p>
                <span className="text-[10px] text-text-muted">{v.label_th}</span>
                {!v.is_active && <span className="text-[10px] text-red-400">Inactive</span>}
              </div>
              <div className="flex items-center gap-3 mt-0.5 text-[12px] text-text-muted">
                <span>{v.duration_type === "permanent" ? "Permanent" : `${v.duration_days} Days`}</span>
                <span className="text-accent-light font-semibold">฿{v.price}</span>
                <span>sort: {v.sort_order}</span>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => handleToggle(v.id, v.is_active)}
                className="text-[12px] px-3 py-1.5 rounded-lg border border-white/10 text-text-muted hover:text-text-base transition">
                {v.is_active ? "Disable" : "Enable"}
              </button>
              <button onClick={() => handleDelete(v.id)}
                className="text-[12px] px-3 py-1.5 rounded-lg border border-red-500/20 text-red-400 hover:bg-red-500/10 transition">
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Add Form */}
      {adding && (
        <div className="bg-bg-base border border-accent/20 rounded-2xl p-5 space-y-4">
          <p className="text-[13px] font-semibold">New Variant</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Label (EN)</label>
              <input value={form.label_en} onChange={(e) => set("label_en", e.target.value)}
                placeholder="Permanent" className={inp} />
            </div>
            <div>
              <label className={lbl}>Label (TH)</label>
              <input value={form.label_th} onChange={(e) => set("label_th", e.target.value)}
                placeholder="ถาวร" className={inp} />
            </div>
            <div>
              <label className={lbl}>Duration Type</label>
              <select value={form.duration_type} onChange={(e) => set("duration_type", e.target.value)} className={inp}>
                <option value="permanent">Permanent</option>
                <option value="days">Days</option>
              </select>
            </div>
            {form.duration_type === "days" && (
              <div>
                <label className={lbl}>Duration (days)</label>
                <input type="number" value={form.duration_days} onChange={(e) => set("duration_days", e.target.value)}
                  placeholder="30" className={inp} />
              </div>
            )}
            <div>
              <label className={lbl}>Price (฿)</label>
              <input type="number" value={form.price} onChange={(e) => set("price", e.target.value)}
                placeholder="199" className={inp} />
            </div>
            <div>
              <label className={lbl}>Sort Order</label>
              <input type="number" value={form.sort_order} onChange={(e) => set("sort_order", Number(e.target.value))}
                placeholder="0" className={inp} />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setAdding(false)}
              className="text-[13px] px-4 py-2 rounded-xl border border-white/10 text-text-muted hover:text-text-base transition">
              Cancel
            </button>
            <button onClick={handleAdd} disabled={saving}
              className="text-[13px] px-4 py-2 rounded-xl bg-accent text-white hover:opacity-90 transition disabled:opacity-50">
              {saving ? "Saving..." : "Add Variant"}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

const lbl = "block text-[11px] text-text-muted uppercase tracking-wide mb-1.5"
const inp = "w-full bg-bg-card border border-accent/15 rounded-xl px-3 py-2.5 text-[13px] placeholder:text-text-muted outline-none focus:border-accent/40 transition"