"use client"

import { useEffect, useId, useRef, useState } from "react"
import { useLocale } from "next-intl"

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

export default function VariantManager({ productId, variants, allowPremium = true }: { productId: string; variants: Variant[]; allowPremium?: boolean }) {
  const locale = useLocale()
  const th = locale === "th"
  const copy = (thai: string, english: string) => th ? thai : english
  const fieldId = useId()
  const editorTitle = useRef<HTMLHeadingElement>(null)
  const thaiName = useRef<HTMLInputElement>(null)
  const [list, setList] = useState(variants)
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({ ...blankVariant })
  const [saving, setSaving] = useState(false)
  const [pending, setPending] = useState<{ id: string; action: "toggle" | "delete" } | null>(null)
  const [formError, setFormError] = useState("")
  const [rowError, setRowError] = useState<{ id: string; message: string } | null>(null)
  const [notice, setNotice] = useState("")
  const [focusRequest, setFocusRequest] = useState(0)
  const editorOpen = adding || editingId !== null
  const busy = saving || pending !== null
  const premium = form.variant_type === "premium"

  useEffect(() => {
    if (!editorOpen) return
    editorTitle.current?.focus({ preventScroll: true })
    editorTitle.current?.scrollIntoView({ block: "start", behavior: "smooth" })
  }, [editorOpen, focusRequest])

  const set = (k: string, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }))
  const price = (value: number | null) => Number(value ?? 0).toLocaleString(th ? "th-TH" : "en-US")
  const variantName = (v: Variant) => th ? v.label_th || v.label_en : v.label_en || v.label_th

  const handleAddClick = () => {
    setForm({ ...blankVariant })
    setEditingId(null)
    setAdding(true)
    setFormError("")
    setNotice("")
    setFocusRequest((n) => n + 1)
  }

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
    setAdding(false)
    setEditingId(v.id)
    setFormError("")
    setNotice("")
    setFocusRequest((n) => n + 1)
  }

  const handleSave = async () => {
    if (busy) return
    if (!editingId && !form.label_th) {
      setFormError(copy("กรอกชื่อภาษาไทยก่อนสร้างแพ็กเกจ", "Enter a Thai name before creating the package."))
      thaiName.current?.focus()
      return
    }
    if (!form.label_en || (premium ? !form.premium_addon_price : !form.price)) {
      setFormError(copy("กรอกชื่อภาษาอังกฤษและราคาให้ครบก่อนบันทึก", "Enter an English name and price before saving."))
      return
    }
    if (!premium && form.duration_type === "days" && (!form.duration_days || Number(form.duration_days) <= 0)) {
      setFormError(copy("กรอกจำนวนวันที่มากกว่า 0", "Enter a number of days greater than 0."))
      return
    }

    setSaving(true)
    setFormError("")
    setNotice("")
    try {
      const url = editingId
        ? `/api/admin/products/${productId}/variants/${editingId}`
        : `/api/admin/products/${productId}/variants`
      const res = await fetch(url, {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          price: premium ? 0 : Number(form.price),
          premium_addon_price: Number(form.premium_addon_price),
          duration_days: form.duration_type === "days" ? Number(form.duration_days) : null,
          sort_order: Number(form.sort_order || 0),
          discount_pct: Number(form.discount_pct || 0),
          discount_limit: Number(form.discount_limit || 0),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setFormError(data.error || copy("บันทึกแพ็กเกจไม่สำเร็จ ลองอีกครั้ง", "Could not save the package. Try again."))
        return
      }
      const saved = { ...data, price: Number(data.price), premium_addon_price: Number(data.premium_addon_price) }
      setList((l) => editingId ? l.map((v) => v.id === editingId ? saved : v) : [...l, saved])
      setForm({ ...blankVariant })
      setAdding(false)
      setEditingId(null)
      setNotice(copy("บันทึกแพ็กเกจแล้ว", "Package saved."))
    } catch {
      setFormError(copy("เชื่อมต่อไม่สำเร็จ ข้อมูลที่กรอกยังอยู่ ลองบันทึกอีกครั้ง", "Could not connect. Your changes are still here; try saving again."))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (v: Variant) => {
    if (busy || !confirm(copy(`ลบแพ็กเกจ “${variantName(v)}” ใช่ไหม?`, `Delete the package “${variantName(v)}”?`))) return
    setPending({ id: v.id, action: "delete" })
    setRowError(null)
    setNotice("")
    try {
      const res = await fetch(`/api/admin/products/${productId}/variants/${v.id}`, { method: "DELETE" })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        setRowError({ id: v.id, message: data?.error || copy("ลบแพ็กเกจไม่สำเร็จ ลองอีกครั้ง", "Could not delete the package. Try again.") })
        return
      }
      setList((l) => l.filter((row) => row.id !== v.id))
      if (editingId === v.id) {
        setEditingId(null)
        setAdding(false)
      }
      setNotice(copy("ลบแพ็กเกจแล้ว", "Package deleted."))
    } catch {
      setRowError({ id: v.id, message: copy("เชื่อมต่อไม่สำเร็จ ยังไม่ได้ลบแพ็กเกจ", "Could not connect. The package has not been deleted.") })
    } finally {
      setPending(null)
    }
  }

  const handleToggle = async (v: Variant) => {
    if (busy) return
    setPending({ id: v.id, action: "toggle" })
    setRowError(null)
    setNotice("")
    try {
      const res = await fetch(`/api/admin/products/${productId}/variants/${v.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !v.is_active }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        setRowError({ id: v.id, message: data?.error || copy("เปลี่ยนสถานะไม่สำเร็จ ลองอีกครั้ง", "Could not change the status. Try again.") })
        return
      }
      setList((l) => l.map((row) => row.id === v.id ? { ...row, is_active: !v.is_active } : row))
      if (editingId === v.id) setForm((f) => ({ ...f, is_active: !v.is_active }))
      setNotice(copy("อัปเดตสถานะแพ็กเกจแล้ว", "Package status updated."))
    } catch {
      setRowError({ id: v.id, message: copy("เชื่อมต่อไม่สำเร็จ สถานะแพ็กเกจยังเหมือนเดิม", "Could not connect. The package status is unchanged.") })
    } finally {
      setPending(null)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-text-base">{copy("แพ็กเกจและราคา", "Packages and pricing")}</h2>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-text-muted">{copy("กำหนดระยะเวลาและราคาที่ลูกค้าเลือกซื้อ แพ็กเกจแต่ละรายการบันทึกได้ในส่วนนี้", "Set the durations and prices customers can buy. Save each package here.")}</p>
        </div>
        <button type="button" onClick={handleAddClick} disabled={busy} className={`${secondaryButton} shrink-0 text-accent-light`}>{copy("+ เพิ่มแพ็กเกจ", "+ Add package")}</button>
      </div>

      {notice && <p role="status" className="rounded-xl border border-success/25 bg-success-bg px-4 py-3 text-sm text-success">{notice}</p>}

      {editorOpen && (
        <section aria-labelledby={`${fieldId}-title`} aria-busy={saving} className="rounded-2xl border border-accent/40 bg-bg-card p-4 sm:p-6">
          <div className="mb-5 border-b border-border-soft pb-4">
            <h3 ref={editorTitle} id={`${fieldId}-title`} tabIndex={-1} className="scroll-mt-24 text-base font-semibold text-text-base outline-none focus-visible:rounded focus-visible:ring-2 focus-visible:ring-accent">{editingId ? copy("แก้ไขแพ็กเกจ", "Edit package") : copy("เพิ่มแพ็กเกจใหม่", "New package")}</h3>
            <p className="mt-1 text-sm text-text-muted">{copy("บันทึกแพ็กเกจนี้ได้โดยตรง โดยไม่ต้องกดบันทึกข้อมูลสินค้า", "Save this package directly, independently of the product details.")}</p>
          </div>

          {formError && <p id={`${fieldId}-error`} role="alert" className="mb-5 rounded-xl border border-hot/30 bg-hot/5 px-4 py-3 text-sm text-hot">{formError}</p>}

          <fieldset disabled={saving} className="min-w-0 space-y-5 disabled:opacity-70">
            {allowPremium && (
              <div>
                <p className={lbl}>{copy("ประเภทแพ็กเกจ", "Package type")}</p>
                <div className="grid gap-2 sm:grid-cols-2" role="group" aria-label={copy("ประเภทแพ็กเกจ", "Package type")}>
                  {(["normal", "premium"] as const).map((type) => (
                    <button key={type} type="button" onClick={() => set("variant_type", type)} aria-pressed={form.variant_type === type} className={`rounded-xl border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${form.variant_type === type ? "border-accent bg-accent/5" : "border-border-soft hover:border-accent/40"}`}>
                      <span className={`block text-sm font-semibold ${form.variant_type === type ? "text-accent-light" : "text-text-base"}`}>{type === "normal" ? copy("แพ็กเกจหลัก", "Standard package") : copy("ตัวเสริม Premium", "Premium add-on")}</span>
                      <span className="mt-1 block text-xs leading-relaxed text-text-muted">{type === "normal" ? copy("ลูกค้าเลือกระยะเวลาและชำระราคาแพ็กเกจ", "Customers choose a duration and pay this package price.") : copy("ลูกค้าติ๊กเพิ่มจากแพ็กเกจหลัก และชำระราคาเพิ่ม", "Customers select this extra alongside a standard package.")}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor={`${fieldId}-thai`} className={lbl}>{copy("ชื่อภาษาไทย", "Thai name")}{!editingId && <> <span className="text-hot">*</span></>}</label>
                <input ref={thaiName} id={`${fieldId}-thai`} value={form.label_th} onChange={(e) => set("label_th", e.target.value)} placeholder={premium ? "อัปเกรดพรีเมียม" : "เข้าใช้งาน 30 วัน"} aria-required={!editingId} aria-invalid={!editingId && !form.label_th && !!formError} aria-describedby={!editingId && !form.label_th && formError ? `${fieldId}-error` : undefined} className={inp} />
              </div>
              <div>
                <label htmlFor={`${fieldId}-english`} className={lbl}>{copy("ชื่อภาษาอังกฤษ", "English name")} <span className="text-hot">*</span></label>
                <input id={`${fieldId}-english`} value={form.label_en} onChange={(e) => set("label_en", e.target.value)} placeholder={premium ? "Premium Upgrade" : "30 Days Access"} aria-required="true" className={inp} />
              </div>
            </div>

            <div className="rounded-xl border border-border-soft bg-bg-base p-4">
              {premium ? (
                <div className="max-w-lg">
                  <label htmlFor={`${fieldId}-addon-price`} className={lbl}>{copy("ราคาเพิ่มจากแพ็กเกจหลัก (฿)", "Price added to the standard package (฿)")} <span className="text-hot">*</span></label>
                  <input id={`${fieldId}-addon-price`} type="number" value={form.premium_addon_price} onFocus={(e) => e.target.select()} onChange={(e) => set("premium_addon_price", e.target.value)} aria-required="true" aria-describedby={`${fieldId}-price-help`} className={`${inp} text-lg font-semibold`} />
                  <p id={`${fieldId}-price-help`} className="mt-2 text-xs leading-relaxed text-text-muted">{copy("ตัวเสริมนี้แสดงเป็นช่องให้ลูกค้าติ๊กเพิ่ม ราคาจะบวกกับแพ็กเกจหลักที่เลือก", "Shown as an optional checkbox. This amount is added to the selected standard package.")}</p>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor={`${fieldId}-duration`} className={lbl}>{copy("ระยะเวลาใช้งาน", "Access duration")}</label>
                    <select id={`${fieldId}-duration`} value={form.duration_type} onChange={(e) => set("duration_type", e.target.value)} className={inp}>
                      <option value="permanent">{copy("ถาวร", "Lifetime")}</option>
                      <option value="days">{copy("ระบุจำนวนวัน", "Number of days")}</option>
                    </select>
                  </div>
                  {form.duration_type === "days" && (
                    <div>
                      <label htmlFor={`${fieldId}-days`} className={lbl}>{copy("จำนวนวัน", "Days")} <span className="text-hot">*</span></label>
                      <input id={`${fieldId}-days`} type="number" value={form.duration_days} onFocus={(e) => e.target.select()} onChange={(e) => set("duration_days", e.target.value)} aria-required="true" className={inp} />
                    </div>
                  )}
                  <div>
                    <label htmlFor={`${fieldId}-price`} className={lbl}>{copy("ราคาแพ็กเกจ (฿)", "Package price (฿)")} <span className="text-hot">*</span></label>
                    <input id={`${fieldId}-price`} type="number" value={form.price} onFocus={(e) => e.target.select()} onChange={(e) => set("price", e.target.value)} aria-required="true" className={`${inp} text-lg font-semibold`} />
                  </div>
                </div>
              )}
            </div>

            <details className="rounded-xl border border-border-soft">
              <summary className="cursor-pointer rounded-xl px-4 py-3 text-sm font-medium text-text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">{premium ? copy("การแสดงผลเพิ่มเติม", "Display options") : copy("ส่วนลดและการแสดงผลเพิ่มเติม", "Discount and display options")}</summary>
              <div className="grid gap-4 border-t border-border-soft p-4 sm:grid-cols-2">
                {!premium && <>
                  <div>
                    <label htmlFor={`${fieldId}-discount`} className={lbl}>{copy("ส่วนลด (%)", "Discount (%)")}</label>
                    <input id={`${fieldId}-discount`} type="number" value={form.discount_pct} onFocus={(e) => e.target.select()} onChange={(e) => set("discount_pct", e.target.value)} placeholder="0" className={inp} />
                  </div>
                  <div>
                    <label htmlFor={`${fieldId}-limit`} className={lbl}>{copy("จำนวนคำสั่งซื้อที่รับส่วนลด", "Discount order limit")}</label>
                    <input id={`${fieldId}-limit`} type="number" value={form.discount_limit} onFocus={(e) => e.target.select()} onChange={(e) => set("discount_limit", e.target.value)} placeholder="0" className={inp} />
                  </div>
                  <p className="text-xs leading-relaxed text-text-muted sm:col-span-2">{copy("ใช้ร่วมกับการเปิดส่วนลดจำนวนจำกัดในข้อมูลสินค้า", "Applies when limited discounts are enabled for the product.")}{editingId && ` · ${copy("ใช้สิทธิ์แล้ว", "Used")}: ${list.find((v) => v.id === editingId)?.discount_used ?? 0}`}</p>
                </>}
                <div>
                  <label htmlFor={`${fieldId}-sort`} className={lbl}>{copy("ลำดับการแสดงผล", "Display order")}</label>
                  <input id={`${fieldId}-sort`} type="number" value={form.sort_order} onFocus={(e) => e.target.select()} onChange={(e) => set("sort_order", e.target.value)} placeholder="0" className={inp} />
                </div>
              </div>
            </details>
          </fieldset>

          <div className="mt-5 flex flex-col-reverse gap-3 border-t border-border-soft pt-4 sm:flex-row sm:items-center sm:justify-end">
            <button type="button" onClick={() => { setAdding(false); setEditingId(null); setFormError("") }} disabled={saving} className={secondaryButton}>{copy("ยกเลิกการแก้ไข", "Cancel editing")}</button>
            <button type="button" onClick={handleSave} disabled={busy} className="min-h-11 rounded-xl bg-accent px-6 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-card disabled:cursor-wait disabled:opacity-60">{saving ? copy("กำลังบันทึก…", "Saving…") : copy("บันทึกแพ็กเกจ", "Save package")}</button>
          </div>
        </section>
      )}

      <div>
        <p className="mb-3 text-sm font-medium text-text-muted">{copy(`แพ็กเกจที่บันทึก (${list.length})`, `Packages saved (${list.length})`)}</p>
        {list.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border-light bg-bg-base px-5 py-8 text-center">
            <p className="font-medium text-text-base">{copy("ยังไม่มีแพ็กเกจ", "No packages yet")}</p>
            <p className="mt-1 text-sm text-text-muted">{copy("เพิ่มแพ็กเกจแรกเพื่อกำหนดราคาและระยะเวลาใช้งาน", "Add the first package to set a price and access duration.")}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {list.map((v) => (
              <div key={v.id} aria-busy={pending?.id === v.id} className={`rounded-xl border bg-bg-card p-4 ${editingId === v.id ? "border-accent/50" : "border-border-soft"}`}>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="break-words text-sm font-semibold text-text-base">{variantName(v)}</p>
                      {v.variant_type === "premium" && <span className="rounded-md bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent-light">{copy("ตัวเสริม Premium", "Premium add-on")}</span>}
                      <span className={`rounded-md px-2 py-0.5 text-xs ${v.is_active ? "bg-success-bg text-success" : "bg-surface-tint text-text-muted"}`}>{v.is_active ? copy("เปิดขาย", "Active") : copy("ปิดขาย", "Inactive")}</span>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-text-muted">
                      {v.variant_type !== "premium" ? <>
                        <span>{v.duration_type === "permanent" ? copy("ถาวร", "Lifetime") : copy(`${v.duration_days} วัน`, `${v.duration_days} days`)}</span>
                        <span className="font-semibold text-text-base">฿{price(v.price)}</span>
                        {Number(v.discount_pct) > 0 && <span className={Number(v.discount_used) >= Number(v.discount_limit) ? "text-text-muted" : "text-success"}>
                          {copy(`ลด ${v.discount_pct}% · ใช้แล้ว ${v.discount_used ?? 0}/${v.discount_limit ?? 0}`, `${v.discount_pct}% off · used ${v.discount_used ?? 0}/${v.discount_limit ?? 0}`)}
                          {Number(v.discount_used) >= Number(v.discount_limit) && copy(" · ครบสิทธิ์", " · limit reached")}
                        </span>}
                      </> : <span className="font-semibold text-text-base">{copy("ราคาเพิ่ม", "Extra")} +฿{price(v.premium_addon_price)}</span>}
                      <span className="text-xs">{copy("ลำดับ", "Order")} {v.sort_order ?? 0}</span>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <button type="button" onClick={() => handleEditClick(v)} disabled={busy} className={`${secondaryButton} text-accent-light`} aria-label={copy(`แก้ไข ${variantName(v)}`, `Edit ${variantName(v)}`)}>{copy("แก้ไข", "Edit")}</button>
                    <button type="button" onClick={() => handleToggle(v)} disabled={busy} className={secondaryButton} aria-label={v.is_active ? copy(`ปิดขาย ${variantName(v)}`, `Disable ${variantName(v)}`) : copy(`เปิดขาย ${variantName(v)}`, `Enable ${variantName(v)}`)}>{pending?.id === v.id && pending.action === "toggle" ? copy("กำลังอัปเดต…", "Updating…") : v.is_active ? copy("ปิดขาย", "Disable") : copy("เปิดขาย", "Enable")}</button>
                    <details className="relative">
                      <summary aria-label={copy(`เพิ่มเติมสำหรับ ${variantName(v)}`, `More actions for ${variantName(v)}`)} className="flex min-h-10 cursor-pointer list-none items-center rounded-lg px-3 text-sm text-text-muted hover:bg-surface-tint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent [&::-webkit-details-marker]:hidden">{copy("เพิ่มเติม", "More")}</summary>
                      <div className="absolute right-0 z-10 mt-1 min-w-44 rounded-xl border border-border-soft bg-bg-card p-1 shadow-lg">
                        <button type="button" onClick={() => handleDelete(v)} disabled={busy} className="min-h-10 w-full rounded-lg px-3 py-2 text-left text-sm text-hot hover:bg-hot/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50">{pending?.id === v.id && pending.action === "delete" ? copy("กำลังลบ…", "Deleting…") : copy("ลบแพ็กเกจ", "Delete package")}</button>
                      </div>
                    </details>
                  </div>
                </div>
                {rowError?.id === v.id && <p role="alert" className="mt-3 border-t border-hot/20 pt-3 text-sm text-hot">{rowError.message}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

const lbl = "mb-1.5 block text-sm font-medium text-text-base"
const inp = "w-full min-h-11 rounded-xl border border-border-light bg-bg-input px-3 py-2.5 text-sm text-text-base placeholder:text-text-muted/60 outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/15"
const secondaryButton = "min-h-10 rounded-lg border border-border-soft px-3 py-2 text-sm font-medium text-text-muted transition hover:border-accent/40 hover:bg-surface-tint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-wait disabled:opacity-50"
