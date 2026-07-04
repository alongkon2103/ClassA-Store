"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import Image from "next/image"
import { getImageUrl } from "@/lib/getImageUrl"
import { motion, AnimatePresence } from "framer-motion"
import Select, { components, type SingleValue, type StylesConfig, type OptionProps, type SingleValueProps } from "react-select"
import type { gifts as Gift } from "@prisma/client"

type Translate = ReturnType<typeof useTranslations<"AdminFunctions">>

type ProductFunction = {
  id: string
  product_id: string
  name: string
  label_th: string | null
  label_en: string | null
  image_url: string | null
  sort_order: number
  default_gift_id: number | null
  default_trigger_threshold: number | null
  created_at: string | null
}

type Props = {
  productId: string
  functions: ProductFunction[]
  allGifts: Gift[]
}

type GiftOption = {
  value: number | null
  label: string
  gift: Gift | null
}

export default function FunctionManager({ productId, functions: initial, allGifts }: Props) {
  const t = useTranslations("AdminFunctions")

  const [functions, setFunctions] = useState<ProductFunction[]>(
    [...initial].sort((a, b) => a.sort_order - b.sort_order)
  )
  const [loading, setLoading] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [uploading, setUploading] = useState<"add" | "edit" | null>(null)
  const [adding, setAdding] = useState(false)
  const [showAdd, setShowAdd] = useState(false)

  const blankForm = { name: "", label_th: "", label_en: "", image_url: "", default_gift_id: null as number | null, default_trigger_threshold: "" as string }
  const [newForm, setNewForm] = useState(blankForm)
  const [editForm, setEditForm] = useState(blankForm)

  // ── Upload ──────────────────────────────────────────────────
  const handleUpload = async (file: File, target: "add" | "edit") => {
    setUploading(target)
    try {
      const fd = new FormData()
      fd.append("file", file)
      fd.append("type", "image")
      const res = await fetch("/api/admin/upload", { method: "POST", body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      if (target === "add") setNewForm(p => ({ ...p, image_url: data.url }))
      if (target === "edit") setEditForm(p => ({ ...p, image_url: data.url }))
    } catch { alert("Upload failed") }
    finally { setUploading(null) }
  }

  // ── Add ─────────────────────────────────────────────────────
  const handleAdd = async () => {
    if (!newForm.name.trim()) return
    setAdding(true)
    try {
      const res = await fetch(`/api/admin/products/${productId}/functions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newForm.name.trim().toLowerCase(),
          label_th: newForm.label_th.trim() || null,
          label_en: newForm.label_en.trim() || null,
          image_url: newForm.image_url || null,
          sort_order: functions.length,
          default_gift_id: newForm.default_gift_id,
          default_trigger_threshold: newForm.default_trigger_threshold !== "" ? parseInt(newForm.default_trigger_threshold, 10) : null,
        }),
      })
      const data = await res.json()
      if (!res.ok) { alert(data.error || t("error")); return }
      setFunctions(p => [...p, data].sort((a, b) => a.sort_order - b.sort_order))
      setNewForm(blankForm)
      setShowAdd(false)
    } catch { alert(t("error")) }
    finally { setAdding(false) }
  }

  // ── Edit ────────────────────────────────────────────────────
  const startEdit = (fn: ProductFunction) => {
    setEditingId(fn.id)
    setEditForm({
      name: fn.name,
      label_th: fn.label_th ?? "",
      label_en: fn.label_en ?? "",
      image_url: fn.image_url ?? "",
      default_gift_id: fn.default_gift_id,
      default_trigger_threshold: fn.default_trigger_threshold?.toString() ?? "",
    })
  }

  const handleEdit = async (id: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/products/${productId}/functions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editForm.name.trim().toLowerCase(),
          label_th: editForm.label_th.trim() || null,
          label_en: editForm.label_en.trim() || null,
          image_url: editForm.image_url || null,
          default_gift_id: editForm.default_gift_id,
          default_trigger_threshold: editForm.default_trigger_threshold !== "" ? parseInt(editForm.default_trigger_threshold, 10) : null,
        }),
      })
      const data = await res.json()
      if (!res.ok) { alert(data.error || t("error")); return }
      setFunctions(p => p.map(f => f.id === id ? data : f))
      setEditingId(null)
    } catch { alert(t("error")) }
    finally { setLoading(false) }
  }

  // ── Delete ──────────────────────────────────────────────────
  const handleDelete = async (id: string) => {
    if (!confirm(t("deleteConfirm"))) return
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/products/${productId}/functions/${id}`, { method: "DELETE" })
      if (!res.ok) { alert(t("error")); return }
      setFunctions(p => p.filter(f => f.id !== id))
    } catch { alert(t("error")) }
    finally { setLoading(false) }
  }

  // ── Reorder ─────────────────────────────────────────────────
  const move = async (index: number, dir: -1 | 1) => {
    const next = [...functions]
    const swap = index + dir
    if (swap < 0 || swap >= next.length) return
      ;[next[index], next[swap]] = [next[swap], next[index]]
    const updated = next.map((f, i) => ({ ...f, sort_order: i }))
    setFunctions(updated)
    try {
      await fetch(`/api/admin/products/${productId}/functions/reorder`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updated.map(f => ({ id: f.id, sort_order: f.sort_order }))),
      })
    } catch { alert(t("error")) }
  }

  const getGift = (id: number | null) => allGifts.find(x => x.id === id) ?? null

  return (
    <div className="space-y-5">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[18px] font-bold">{t("title")}</h2>
          <p className="text-[13px] text-text-muted mt-0.5">{t("subtitle")}</p>
        </div>
        <button
          onClick={() => { setShowAdd(p => !p); setNewForm(blankForm) }}
          className="flex items-center gap-2 bg-accent hover:opacity-90 text-white text-[13px] font-semibold px-4 py-2.5 rounded-xl transition active:scale-95"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          {t("addFunction")}
        </button>
      </div>

      {/* ── Add Form ── */}
      <AnimatePresence>
        {showAdd && (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.2 }}
            className="bg-bg-card border border-accent/25 rounded-2xl overflow-visible"
          >
            <div className="h-0.5 bg-gradient-to-r from-accent via-accent-light to-transparent rounded-t-2xl" />
            <div className="p-5 space-y-4">
              <p className="text-[11px] tracking-widest text-accent-light uppercase font-medium">
                {t("newFunction")}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">

                {/* Icon + Name */}
                <div className="space-y-3">
                  <FieldLabel>{t("icon")}</FieldLabel>
                  <ImageUploadBox
                    url={newForm.image_url}
                    uploading={uploading === "add"}
                    onUpload={f => handleUpload(f, "add")}
                    onClear={() => setNewForm(p => ({ ...p, image_url: "" }))}
                    t={t}
                  />
                  <div>
                    <FieldLabel required>{t("nameKey")}</FieldLabel>
                    <input
                      value={newForm.name}
                      onChange={e => setNewForm(p => ({ ...p, name: e.target.value }))}
                      placeholder="kill, speed, jump..."
                      className={inp}
                    />
                  </div>
                </div>

                {/* Label TH */}
                <div>
                  <FieldLabel>{t("labelTh")}</FieldLabel>
                  <input
                    value={newForm.label_th}
                    onChange={e => setNewForm(p => ({ ...p, label_th: e.target.value }))}
                    placeholder="ภาษาไทย"
                    className={inp}
                  />
                </div>

                {/* Label EN */}
                <div>
                  <FieldLabel>{t("labelEn")}</FieldLabel>
                  <input
                    value={newForm.label_en}
                    onChange={e => setNewForm(p => ({ ...p, label_en: e.target.value }))}
                    placeholder="English"
                    className={inp}
                  />
                </div>

                {/* Default Gift */}
                <div>
                  <FieldLabel>{t("defaultGift")}</FieldLabel>
                  <GiftPicker
                    gifts={allGifts}
                    value={newForm.default_gift_id}
                    onChange={id => setNewForm(p => ({ ...p, default_gift_id: id, default_trigger_threshold: "" }))}
                    placeholder={t("noDefault")}
                  />
                </div>

                {/* Default Threshold */}
                {getGift(newForm.default_gift_id)?.trigger_type === 'like' && (
                  <div>
                    <FieldLabel>{t("defaultThreshold")}</FieldLabel>
                    <input
                      type="number"
                      min="1"
                      value={newForm.default_trigger_threshold}
                      onChange={e => setNewForm(p => ({ ...p, default_trigger_threshold: e.target.value }))}
                      placeholder="เช่น 50, 100, 200"
                      className={inp}
                    />
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-1">
                <button
                  onClick={() => { setShowAdd(false); setNewForm(blankForm) }}
                  className="px-4 py-2 rounded-xl border border-white/10 text-text-muted text-[13px] hover:text-text-base transition"
                >
                  {t("cancel")}
                </button>
                <button
                  onClick={handleAdd}
                  disabled={adding || !newForm.name.trim()}
                  className="px-5 py-2 rounded-xl bg-accent text-white text-[13px] font-semibold hover:opacity-90 transition disabled:opacity-40 flex items-center gap-2"
                >
                  {adding && <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                  {adding ? t("saving") : t("save")}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Empty State ── */}
      {functions.length === 0 && !showAdd && (
        <div className="text-center py-16 bg-bg-card border border-dashed border-accent/15 rounded-2xl">
          <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-accent/10 flex items-center justify-center">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-accent-light">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
          </div>
          <p className="text-[13px] text-text-muted">{t("empty")}</p>
        </div>
      )}

      {/* ── Function List ── */}
      <div className="space-y-2">
        {functions.map((fn, i) => {
          const isEditing = editingId === fn.id
          const gift = getGift(fn.default_gift_id)

          return (
            <div
              key={fn.id}
              className={`group bg-bg-card border rounded-2xl transition-all duration-200 ${isEditing
                  ? "border-accent/40 shadow-lg shadow-accent/5"
                  : "border-accent/10 hover:border-accent/25"
                }`}
            >
              {isEditing ? (
                <div className="p-4 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 items-end">

                    {/* Icon */}
                    <div className="space-y-1.5">
                      <FieldLabel small>{t("icon")}</FieldLabel>
                      <div className="flex items-center gap-2">
                        <div className="w-10 h-10 rounded-xl bg-bg-base border border-accent/10 flex items-center justify-center overflow-hidden flex-shrink-0">
                          {editForm.image_url ? (
                            <Image src={getImageUrl(editForm.image_url)} alt="" width={40} height={40} className="w-full h-full object-cover" unoptimized />
                          ) : (
                            <span className="text-[9px] text-text-muted font-bold uppercase">{t("noIcon")}</span>
                          )}
                        </div>
                        <label className="flex-1 cursor-pointer">
                          <div className="text-center text-[11px] font-medium py-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 transition text-text-muted">
                            {uploading === "edit" ? "..." : t("upload")}
                          </div>
                          <input type="file" className="hidden" accept="image/*"
                            onChange={e => e.target.files?.[0] && handleUpload(e.target.files[0], "edit")} />
                        </label>
                      </div>
                    </div>

                    {/* Name */}
                    <div className="space-y-1.5">
                      <FieldLabel small required>{t("nameKey")}</FieldLabel>
                      <input value={editForm.name} onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))} className={inpSm} />
                    </div>

                    {/* Label TH */}
                    <div className="space-y-1.5">
                      <FieldLabel small>{t("labelTh")}</FieldLabel>
                      <input value={editForm.label_th} onChange={e => setEditForm(p => ({ ...p, label_th: e.target.value }))} className={inpSm} />
                    </div>

                    {/* Label EN */}
                    <div className="space-y-1.5">
                      <FieldLabel small>{t("labelEn")}</FieldLabel>
                      <input value={editForm.label_en} onChange={e => setEditForm(p => ({ ...p, label_en: e.target.value }))} className={inpSm} />
                    </div>

                    {/* Default Gift */}
                    <div className="space-y-1.5">
                      <FieldLabel small>{t("defaultGift")}</FieldLabel>
                      <GiftPicker
                        gifts={allGifts}
                        value={editForm.default_gift_id}
                        onChange={id => setEditForm(p => ({ ...p, default_gift_id: id, default_trigger_threshold: "" }))}
                        placeholder={t("noDefault")}
                      />
                    </div>

                    {/* Default Threshold */}
                    {getGift(editForm.default_gift_id)?.trigger_type === 'like' && (
                      <div className="space-y-1.5">
                        <FieldLabel small>{t("defaultThreshold")}</FieldLabel>
                        <input
                          type="number"
                          min="1"
                          value={editForm.default_trigger_threshold}
                          onChange={e => setEditForm(p => ({ ...p, default_trigger_threshold: e.target.value }))}
                          placeholder="เช่น 50, 100"
                          className={inpSm}
                        />
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end gap-2">
                    <button onClick={() => setEditingId(null)}
                      className="px-4 py-2 rounded-xl border border-white/10 text-text-muted text-[12px] hover:text-text-base transition">
                      {t("cancel")}
                    </button>
                    <button onClick={() => handleEdit(fn.id)} disabled={loading}
                      className="px-5 py-2 rounded-xl bg-accent text-white text-[12px] font-semibold hover:opacity-90 transition disabled:opacity-40 flex items-center gap-1.5">
                      {loading && <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                      {t("save")}
                    </button>
                  </div>
                </div>

              ) : (
                <div className="flex items-center gap-3 px-4 py-3">

                  {/* Reorder */}
                  <div className="flex flex-col items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                    <button onClick={() => move(i, -1)} disabled={i === 0 || loading}
                      className="p-1 rounded hover:bg-white/5 disabled:opacity-20 transition">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                        <polyline points="18 15 12 9 6 15" />
                      </svg>
                    </button>
                    <span className="text-[9px] font-mono text-text-muted">{i + 1}</span>
                    <button onClick={() => move(i, 1)} disabled={i === functions.length - 1 || loading}
                      className="p-1 rounded hover:bg-white/5 disabled:opacity-20 transition">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </button>
                  </div>

                  {/* Icon */}
                  <div className="w-10 h-10 rounded-xl overflow-hidden border border-white/5 bg-bg-base flex-shrink-0">
                    {fn.image_url ? (
                      <Image src={getImageUrl(fn.image_url)} alt="" width={40} height={40} className="w-full h-full object-cover" unoptimized />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[8px] text-text-muted font-bold uppercase bg-white/5">
                        {t("noIcon")}
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[11px] text-accent-light bg-accent/10 px-2 py-0.5 rounded-md">
                        {fn.name}
                      </span>
                      <span className="text-[13px] font-medium text-text-base truncate">
                        {fn.label_th || fn.label_en || "—"}
                      </span>
                      {fn.label_en && fn.label_th && (
                        <span className="text-[12px] text-text-muted truncate hidden sm:block">/ {fn.label_en}</span>
                      )}
                    </div>
                  </div>

                  {/* Default Gift pill */}
                  <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-bg-base border border-white/5 flex-shrink-0">
                    <span className="text-[10px] text-text-muted uppercase tracking-wide">{t("defaultGift")}:</span>
                    {gift ? (
                      <div className="flex items-center gap-1.5">
                        {gift.image_url && (
                          <Image src={getImageUrl(gift.image_url)} alt="" width={16} height={16} className="rounded" unoptimized />
                        )}
                        <span className="text-[12px] font-semibold text-accent-light">{gift.name}</span>
                        <span className="text-[10px] text-text-muted">💎{gift.diamonds}</span>
                        {fn.default_trigger_threshold !== null && (
                          <span className="text-[10px] text-text-muted ml-1">
                            (Threshold: {fn.default_trigger_threshold})
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-[12px] text-text-muted/40">—</span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                    <button onClick={() => startEdit(fn)}
                      className="p-2 rounded-lg text-text-muted hover:text-text-base hover:bg-white/5 transition">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                    </button>
                    <button onClick={() => handleDelete(fn.id)} disabled={loading}
                      className="p-2 rounded-lg text-text-muted hover:text-red-400 hover:bg-red-500/10 transition disabled:opacity-40">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      </svg>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Gift Picker — react-select ───────────────────────────────
// install: npm i react-select
// - menuPortalTarget={document.body} + menuPosition="fixed" แก้บัค clip ทุกกรณี
// - scroll ใน dropdown ไม่ปิด dropdown เพราะ react-select จัดการ event เอง
function GiftPicker({ gifts, value, onChange, placeholder }: {
  gifts: Gift[]
  value: number | null
  onChange: (id: number | null) => void
  placeholder: string
}) {
  const options: GiftOption[] = [
    { value: null, label: placeholder, gift: null },
    ...gifts.map(g => ({ value: g.id as number, label: g.name, gift: g })),
  ]

  const selected = options.find(o => o.value === value) ?? options[0]

  const selectStyles: StylesConfig<GiftOption, false> = {
    control: (base, state) => ({
      ...base,
      background: "var(--color-bg-base, #0f0f1a)",
      border: `1px solid ${state.isFocused
        ? "rgba(120,80,255,0.4)"
        : "rgba(120,80,255,0.15)"}`,
      borderRadius: "0.75rem",
      boxShadow: "none",
      minHeight: "38px",
      cursor: "pointer",
      transition: "border-color 0.15s",
      "&:hover": { borderColor: "rgba(120,80,255,0.4)" },
    }),
    valueContainer: base => ({ ...base, padding: "0 10px", gap: "6px", flexWrap: "nowrap" }),
    input: base => ({ ...base, color: "var(--color-text-base, #e2e2e2)", fontSize: "12px", margin: 0, padding: 0 }),
    placeholder: base => ({ ...base, color: "var(--color-text-muted, #666)", fontSize: "12px" }),
    singleValue: base => ({ ...base, color: "var(--color-text-base, #e2e2e2)", fontSize: "12px", overflow: "visible" }),
    indicatorSeparator: () => ({ display: "none" }),
    dropdownIndicator: base => ({ ...base, padding: "0 8px", color: "var(--color-text-muted, #666)" }),
    menu: base => ({
      ...base,
      background: "var(--color-bg-card, #16213e)",
      border: "1px solid rgba(120,80,255,0.2)",
      borderRadius: "1rem",
      boxShadow: "0 16px 48px rgba(0,0,0,0.5)",
      overflow: "hidden",
      zIndex: 9999,
      marginTop: "4px",
    }),
    menuList: base => ({ ...base, padding: "6px", maxHeight: "240px" }),
    option: (base, state) => ({
      ...base,
      background: state.isSelected
        ? "rgba(120,80,255,0.2)"
        : state.isFocused
          ? "rgba(255,255,255,0.05)"
          : "transparent",
      color: state.isSelected
        ? "var(--color-accent-light, #a899ff)"
        : "var(--color-text-base, #e2e2e2)",
      borderRadius: "0.5rem",
      padding: "8px 10px",
      cursor: "pointer",
      fontSize: "12px",
    }),
    noOptionsMessage: base => ({
      ...base,
      color: "var(--color-text-muted, #666)",
      fontSize: "11px",
      padding: "2rem 1rem",
      textAlign: "center",
    }),
  }

  // Option row — รูป + ชื่อ + diamonds
  const CustomOption = (props: OptionProps<GiftOption, false>) => {
    const g = props.data.gift
    return (
      <components.Option {...props}>
        <div className="flex items-center gap-2.5">
          {g ? (
            g.image_url ? (
              <Image src={getImageUrl(g.image_url)} alt="" width={20} height={20} className="rounded flex-shrink-0" unoptimized />
            ) : (
              <div className="w-5 h-5 rounded bg-white/5 flex items-center justify-center text-[10px] flex-shrink-0">🎁</div>
            )
          ) : (
            <div className="w-5 h-5 rounded bg-white/5 flex items-center justify-center flex-shrink-0 text-text-muted">
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate leading-tight">{props.data.label}</p>
            {g && <p className="text-[10px] text-text-muted mt-0.5">ID:{g.id} · 💎{g.diamonds}</p>}
          </div>
        </div>
      </components.Option>
    )
  }

  // Selected value display
  const CustomSingleValue = (props: SingleValueProps<GiftOption, false>) => {
    const g = props.data.gift
    return (
      <components.SingleValue {...props}>
        <div className="flex items-center gap-2">
          {g ? (
            <>
              {g.image_url && (
                <Image src={getImageUrl(g.image_url)} alt="" width={16} height={16} className="rounded flex-shrink-0" unoptimized />
              )}
              <span className="font-semibold text-accent-light truncate">{g.name}</span>
              <span className="text-[10px] text-text-muted flex-shrink-0">💎{g.diamonds}</span>
            </>
          ) : (
            <span className="text-text-muted">{placeholder}</span>
          )}
        </div>
      </components.SingleValue>
    )
  }

  return (
    <Select<GiftOption, false>
      options={options}
      value={selected}
      onChange={(opt: SingleValue<GiftOption>) => onChange(opt?.value ?? null)}
      styles={selectStyles}
      placeholder={placeholder}
      noOptionsMessage={() => "ไม่พบของขวัญ"}
      filterOption={(opt, input) => {
        if (!input) return true
        const q = input.toLowerCase()
        const g = opt.data.gift
        if (!g) return true
        return g.name.toLowerCase().includes(q) || String(g.id).includes(q)
      }}
      components={{ Option: CustomOption, SingleValue: CustomSingleValue }}
      // key props ที่แก้บัค — render dropdown ที่ body ไม่โดน clip
      menuPortalTarget={typeof document !== "undefined" ? document.body : null}
      menuPosition="fixed"
      isSearchable
    />
  )
}

// ── Image Upload Box ─────────────────────────────────────────
function ImageUploadBox({ url, uploading, onUpload, onClear, t }: {
  url: string
  uploading: boolean
  onUpload: (f: File) => void
  onClear: () => void
  t: Translate
}) {
  return (
    <div className="relative group/img w-16 h-16">
      <div className="w-16 h-16 rounded-xl overflow-hidden border border-accent/15 bg-bg-base flex items-center justify-center">
        {url ? (
          <>
            <Image src={getImageUrl(url)} alt="" width={64} height={64} className="w-full h-full object-cover" unoptimized />
            <button onClick={onClear}
              className="absolute inset-0 bg-black/60 opacity-0 group-hover/img:opacity-100 transition flex items-center justify-center rounded-xl">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </>
        ) : (
          <label className="w-full h-full flex flex-col items-center justify-center cursor-pointer hover:bg-white/5 transition rounded-xl gap-1">
            {uploading ? (
              <div className="w-5 h-5 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
            ) : (
              <>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="text-text-muted">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                <span className="text-[9px] text-text-muted uppercase font-bold">{t("upload")}</span>
              </>
            )}
            <input type="file" className="hidden" accept="image/*"
              onChange={e => e.target.files?.[0] && onUpload(e.target.files[0])} />
          </label>
        )}
      </div>
    </div>
  )
}

// ── Field Label ──────────────────────────────────────────────
function FieldLabel({ children, required, small }: {
  children: React.ReactNode
  required?: boolean
  small?: boolean
}) {
  return (
    <label className={`block font-medium text-text-muted uppercase tracking-wide mb-1.5 ${small ? "text-[10px]" : "text-[11px]"}`}>
      {children}
      {required && <span className="text-red-400 ml-1">*</span>}
    </label>
  )
}

// ── Styles ───────────────────────────────────────────────────
const inp = "w-full bg-bg-base border border-accent/15 rounded-xl px-4 py-2.5 text-[13px] placeholder:text-text-muted outline-none focus:border-accent/40 transition"
const inpSm = "w-full bg-bg-base border border-accent/15 rounded-xl px-3 py-2 text-[12px] placeholder:text-text-muted outline-none focus:border-accent/40 transition"