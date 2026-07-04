"use client"

import { useState } from "react"

type Variant = {
  id: string
  label_en: string
  label_th: string | null
  duration_type: string
  duration_days: number | null
  price: number
  sort_order: number | null
  is_active: boolean
  variant_type: string | null
  premium_addon_price: number | null
  discount_pct: number | null
  discount_limit: number | null
  discount_used: number | null
}

const blankVariant = {
  label_en: "", label_th: "",
  duration_type: "permanent", duration_days: "",
  price: "", sort_order: "", is_active: true,
  variant_type: "normal",
  premium_addon_price: "",
  discount_pct: "",
  discount_limit: "",
}

export default function VariantManager({ productId, variants }: { productId: string; variants: Variant[] }) {
  const [list, setList]     = useState(variants)
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm]     = useState({ ...blankVariant })
  const [saving, setSaving] = useState(false)

  const set = (k: string, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }))

  const handleEditClick = (v: Variant) => {
    setForm({
      label_en: v.label_en || "",
      label_th: v.label_th || "",
      duration_type: v.duration_type || "permanent",
      duration_days: v.duration_days?.toString() || "",
      price: v.price?.toString() || "",
      sort_order: v.sort_order?.toString() || "",
      is_active: v.is_active,
      variant_type: v.variant_type || "normal",
      premium_addon_price: v.premium_addon_price?.toString() || "",
      discount_pct: v.discount_pct?.toString() || "",
      discount_limit: v.discount_limit?.toString() || "",
    })
    setEditingId(v.id)
  }

  // --- Logic การตรวจสอบข้อมูล ---
  const handleSave = async () => {
    // ถ้าเป็น Premium Add-on บังคับใส่ราคา addon
    if (form.variant_type === "premium") {
      if (!form.label_en || !form.premium_addon_price) {
        alert("Please enter Label and Premium Add-on Price"); return
      }
    } else {
      // ถ้าเป็น Normal บังคับใส่ label และราคาหลัก
      if (!form.label_en || !form.price) {
        alert("Fill label and price"); return
      }
    }

    if (form.variant_type === "normal" && form.duration_type === "days" && (!form.duration_days || Number(form.duration_days) <= 0)) {
      alert("Please enter a valid number of days")
      return
    }

    setSaving(true)
    const url = editingId 
      ? `/api/admin/products/${productId}/variants/${editingId}`
      : `/api/admin/products/${productId}/variants`
    
    const res = await fetch(url, {
      method: editingId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        price: form.variant_type === "premium" ? 0 : Number(form.price),
        premium_addon_price: Number(form.premium_addon_price),
        duration_days: form.duration_type === "days" ? Number(form.duration_days) : null,
        sort_order: Number(form.sort_order || 0),
        discount_pct: Number(form.discount_pct || 0),
        discount_limit: Number(form.discount_limit || 0),
      }),
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) { alert(data.error || "Failed to save variant"); return }
    
    if (editingId) {
      setList((l) => l.map((v) => v.id === editingId ? { ...data, price: Number(data.price), premium_addon_price: Number(data.premium_addon_price) } : v))
    } else {
      setList((l) => [...l, { ...data, price: Number(data.price), premium_addon_price: Number(data.premium_addon_price) }])
    }
    
    setForm({ ...blankVariant })
    setAdding(false)
    setEditingId(null)
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Delete variant?")) return
    try {
      const res = await fetch(`/api/admin/products/${productId}/variants/${id}`, { method: "DELETE" })
      if (!res.ok) { alert("Failed to delete"); return }
      setList((l) => l.filter((v) => v.id !== id))
    } catch { alert("An error occurred") }
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
        <button onClick={() => { setAdding(true); setEditingId(null); setForm({...blankVariant}); }}
          className="text-[13px] px-4 py-2 rounded-xl bg-accent/15 text-accent-light hover:bg-accent/25 transition font-medium">
          + Add New Variant / Add-on
        </button>
      </div>

      {/* List */}
      <div className="grid gap-2">
        {list.map((v) => (
          <div key={v.id}
            className={`flex items-center justify-between border rounded-2xl px-4 py-3 ${v.variant_type === 'premium' ? 'bg-yellow-500/5 border-yellow-500/20' : 'bg-bg-base border-accent/10'}`}>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-[13px] font-bold">{v.label_en}</p>
                {v.variant_type === "premium" && (
                   <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-500 text-black font-bold uppercase tracking-tighter">Premium Add-on</span>
                )}
                {!v.is_active && <span className="text-[10px] text-red-400">Disabled</span>}
              </div>
              <div className="flex items-center gap-3 mt-1 text-[12px] text-text-muted">
                {v.variant_type === 'normal' ? (
                  <>
                    <span className="bg-white/5 px-1.5 py-0.5 rounded text-[11px]">{v.duration_type === "permanent" ? "Lifetime" : `${v.duration_days} Days`}</span>
                    <span className="text-accent-light font-bold">฿{v.price}</span>
                    {Number(v.discount_pct) > 0 && (
                      <span className={`font-bold ml-2 ${Number(v.discount_used) >= Number(v.discount_limit) ? 'text-red-400 line-through opacity-50' : 'text-green-400'}`}>
                        (-{v.discount_pct}% | {v.discount_used}/{v.discount_limit})
                      </span>
                    )}
                  </>
                ) : (
                  <span className="text-yellow-500 font-bold">Extra Charge: +฿{v.premium_addon_price}</span>
                )}
                <span className="opacity-50 text-[11px]">Sort: {v.sort_order}</span>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => handleEditClick(v)}
                className="text-[12px] px-3 py-1.5 rounded-lg border border-accent/20 text-accent-light hover:bg-accent/5 transition">
                Edit
              </button>
              <button onClick={() => handleToggle(v.id, v.is_active)}
                className="text-[12px] px-3 py-1.5 rounded-lg border border-white/10 text-text-muted hover:bg-white/5 transition">
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

      {/* Add/Edit Form */}
      {(adding || editingId) && (
        <div className="bg-bg-card border-2 border-accent/30 rounded-3xl p-6 space-y-6 shadow-2xl animate-in fade-in slide-in-from-bottom-4">
          <div className="flex justify-between items-center border-b border-white/5 pb-4">
             <h3 className="text-base font-bold">{editingId ? 'Edit Option' : 'Create New Option'}</h3>
             <div className="flex bg-bg-base p-1 rounded-xl border border-white/5">
                <button 
                  onClick={() => set("variant_type", "normal")}
                  className={`px-4 py-1.5 rounded-lg text-[12px] font-medium transition ${form.variant_type === 'normal' ? 'bg-accent text-white shadow-lg' : 'text-text-muted'}`}>
                  Normal Variant
                </button>
                <button 
                  onClick={() => set("variant_type", "premium")}
                  className={`px-4 py-1.5 rounded-lg text-[12px] font-medium transition ${form.variant_type === 'premium' ? 'bg-yellow-500 text-black shadow-lg' : 'text-text-muted'}`}>
                  Premium Add-on
                </button>
             </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Common Fields */}
            <div className="space-y-4">
                <div>
                  <label className={lbl}>Label (English)</label>
                  <input value={form.label_en} onChange={(e) => set("label_en", e.target.value)}
                    placeholder={form.variant_type === 'premium' ? "Premium Upgrade" : "30 Days Access"} className={inp} />
                </div>
                <div>
                  <label className={lbl}>Label (Thai)</label>
                  <input value={form.label_th} onChange={(e) => set("label_th", e.target.value)}
                    placeholder={form.variant_type === 'premium' ? "อัปเกรดพรีเมียม" : "เข้าใช้งาน 30 วัน"} className={inp} />
                </div>
                <div>
                  <label className={lbl}>Display Sort Order</label>
                  <input type="number" 
                    value={form.sort_order} 
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => set("sort_order", e.target.value)} className={inp} />
                </div>
            </div>

            {/* Conditional Fields */}
            <div className={`p-5 rounded-2xl border-2 transition-all ${form.variant_type === 'premium' ? 'bg-yellow-500/5 border-yellow-500/30' : 'bg-accent/5 border-accent/30'}`}>
              {form.variant_type === 'normal' ? (
                <div className="space-y-4">
                  <p className="text-[12px] font-bold text-accent-light uppercase">Settings for Normal Variant</p>
                  <div>
                    <label className={lbl}>Duration Type</label>
                    <select value={form.duration_type} onChange={(e) => set("duration_type", e.target.value)} className={inp}>
                      <option value="permanent">Lifetime (ถาวร)</option>
                      <option value="days">Limited Days (รายวัน)</option>
                    </select>
                  </div>
                  {form.duration_type === "days" && (
                    <div>
                      <label className={lbl}>Number of Days</label>
                      <input type="number" value={form.duration_days} 
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => set("duration_days", e.target.value)} className={inp} />
                    </div>
                  )}
                  <div>
                    <label className={lbl}>Price (฿)</label>
                    <input type="number" value={form.price} 
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => set("price", e.target.value)} className={`${inp} text-lg font-bold text-accent-light`} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={lbl}>Discount (%)</label>
                      <input type="number" value={form.discount_pct} 
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => set("discount_pct", e.target.value)} placeholder="0" className={inp} />
                    </div>
                    <div>
                      <label className={lbl}>Limit (Orders)</label>
                      <input type="number" value={form.discount_limit} 
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => set("discount_limit", e.target.value)} placeholder="0" className={inp} />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-[12px] font-bold text-yellow-500 uppercase">Settings for Premium Add-on</p>
                  <div className="bg-yellow-500/10 p-3 rounded-xl border border-yellow-500/20 mb-4">
                    <p className="text-[11px] text-yellow-200/80 leading-relaxed">
                      * ระบบจะแสดงเป็นกล่อง Checkbox ให้ลูกค้าติ๊กเพิ่มจากระยะเวลาปกติ
                    </p>
                  </div>
                  <div>
                    <label className={lbl}>Extra Price to Add (฿)</label>
                    <input type="number" 
                      value={form.premium_addon_price} 
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => set("premium_addon_price", e.target.value)}
                      placeholder="เช่น 50" 
                      className={`${inp} text-xl font-bold text-yellow-500 border-yellow-500/40`} 
                    />
                    <p className="text-[10px] text-text-muted mt-2 italic">ราคานี้จะถูกนำไปบวกเพิ่มจากราคา Variant ปกติที่ลูกค้าเลือก</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-3 justify-end pt-4 border-t border-white/5">
            <button onClick={() => { setAdding(false); setEditingId(null); }}
              className="text-[13px] px-6 py-2.5 rounded-xl border border-white/10 text-text-muted hover:text-text-base transition">
              Discard
            </button>
            <button onClick={handleSave} disabled={saving}
              className={`text-[13px] px-8 py-2.5 rounded-xl font-bold shadow-lg transition disabled:opacity-50 ${form.variant_type === 'premium' ? 'bg-yellow-500 text-black hover:bg-yellow-400' : 'bg-accent text-white hover:opacity-90'}`}>
              {saving ? "Saving..." : editingId ? "Save Changes" : "Save Selection"}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

const lbl = "block text-[11px] text-text-muted uppercase font-bold tracking-wider mb-1.5"
const inp = "w-full bg-bg-base border border-white/10 rounded-xl px-4 py-3 text-[14px] placeholder:text-text-muted/50 outline-none focus:border-accent/50 transition"