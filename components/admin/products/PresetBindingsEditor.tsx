"use client"

import { useEffect, useState } from "react"
import type { FunctionDefault } from "@/lib/integrations/tikkiesFunctionDefaults"
import type { PresetKey, TikkiesBindings } from "@/lib/tikkiesBindings"

type View = {
  schemaVersion: 1; preset: { id: string; filename: string }; sourceRevision: string
  functions: { functions: FunctionDefault[] }
  actions: { index: number; name: string; keys: PresetKey[]; supported: boolean; triggerLabel?: string }[]
  bindings: TikkiesBindings | null; bindingError: string | null
}
type Props = { productId: string; presetId: string; onClose: () => void; locale?: string }
export default function PresetBindingsEditor({ productId, presetId, onClose, locale = "th" }: Props) {
  const th = locale === "th"
  const [view, setView] = useState<View | null>(null), [draft, setDraft] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true), [saving, setSaving] = useState(false)
  const [error, setError] = useState(""), [saved, setSaved] = useState(false)
  const endpoint = `/api/admin/products/${productId}/presets/${presetId}/bindings`
  const unavailable = th ? "โหลดการจับคู่ไม่สำเร็จ กรุณาลองอีกครั้ง" : "Could not load bindings. Please try again."
  const stale = th ? "ไฟล์พรีเซ็ตเปลี่ยนแล้ว กรุณาปิดแล้วเปิดใหม่เพื่อตรวจสอบ Action ก่อนบันทึก" : "The preset file changed. Reopen this editor and review its Actions before saving."
  function apply(data: View) {
    setView(data)
    setDraft(Object.fromEntries((data.bindings?.entries || []).map(entry => [entry.functionId, String(entry.actionIndex)])))
  }
  useEffect(() => {
    const controller = new AbortController()
    setLoading(true); setError(""); setSaved(false); setView(null); setDraft({})
    fetch(endpoint, { cache: "no-store", signal: controller.signal }).then(async response => {
      const data = await response.json()
      if (!response.ok || !Array.isArray(data.actions) || !Array.isArray(data.functions?.functions)) throw Error(unavailable)
      if (!controller.signal.aborted) apply(data)
    }).catch(() => { if (!controller.signal.aborted) setError(unavailable) })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [endpoint, unavailable])
  async function save() {
    if (!view) return
    setSaving(true); setError(""); setSaved(false)
    try {
      const entries = view.functions.functions.flatMap(fn => draft[fn.id] === undefined || draft[fn.id] === "" ? [] : [{ functionId: fn.id, actionIndex: Number(draft[fn.id]) }])
      const response = await fetch(endpoint, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sourceRevision: view.sourceRevision, entries }) })
      const data = await response.json()
      if (!response.ok) { setError(data.error === "bindings_stale" ? stale : th ? "บันทึกไม่สำเร็จ ตรวจสอบ Function และ Action ที่เลือก" : "Could not save. Review the selected Functions and Actions."); return }
      apply(data); setSaved(true)
    } catch { setError(th ? "บันทึกไม่สำเร็จ กรุณาลองอีกครั้ง" : "Could not save. Please try again.") }
    finally { setSaving(false) }
  }
  const groups = [{ kind: "help", label: th ? "ช่วยเล่น" : "Help" }, { kind: "troll", label: th ? "แกล้ง" : "Troll" }, { kind: "neutral", label: th ? "ทั่วไป" : "General" }]
  return (
    <section data-testid="preset-bindings-editor" className="rounded-xl border border-accent/20 bg-bg-base p-4 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div><h3 className="font-medium">{th ? "จับคู่ Functions" : "Map Functions"}</h3><p className="text-sm text-text-muted break-all">{view?.preset.filename}</p></div>
        <button type="button" onClick={onClose} className="text-sm text-text-muted">{th ? "ปิด" : "Close"}</button>
      </div>
      <p className="text-xs text-text-muted">{th ? "เลือก Action ให้แต่ละ Function โดยดูชื่อทริกเกอร์และปุ่มกด หลาย Function ใช้ Action เดียวกันได้" : "Choose an Action for each Function using its trigger and keys. Several Functions may use the same Action."}</p>
      {loading && <p role="status" className="text-sm text-text-muted">{th ? "กำลังโหลด…" : "Loading…"}</p>}
      {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
      {view?.bindingError && <p role="alert" className="text-sm text-amber-400">{th ? "การจับคู่เดิมใช้กับไฟล์ปัจจุบันไม่ได้ กรุณาเลือกใหม่ก่อนบันทึก" : "The saved bindings do not match this file. Choose the mappings again before saving."}</p>}
      {view && groups.map(group => {
        const functions = view.functions.functions.filter(fn => fn.kind === group.kind)
        if (!functions.length) return null
        return <div key={group.kind} className="space-y-2">
          <h4 className="text-sm font-medium">{group.label}</h4>
          {functions.map(fn => <div key={fn.id} className="grid grid-cols-1 lg:grid-cols-2 items-center gap-3 border border-accent/10 rounded-lg p-3">
            <div className="flex items-center gap-3 min-w-0">
              {fn.imageUrl ? <img src={fn.imageUrl} alt={th ? "รูป Function" : "Function artwork"} className="w-10 h-10 object-contain shrink-0" /> : <span className="w-10 h-10 bg-bg-card rounded-lg shrink-0" />}
              <div className="min-w-0"><p className="text-sm font-medium break-words">{(th ? fn.labelTh || fn.labelEn : fn.labelEn || fn.labelTh) || fn.key}</p>
                <div className="flex items-center gap-1.5 text-xs text-text-muted">
                  {fn.giftImageUrl && <img src={fn.giftImageUrl} alt={th ? "รูปของขวัญ" : "Gift artwork"} className="w-6 h-6 object-contain" />}
                  <span>{fn.giftName || (th ? "ใช้ทริกเกอร์เดิมของ Action" : "Use the Action’s original trigger")}{fn.giftName && fn.triggerThreshold ? " ×" + fn.triggerThreshold : ""}</span>
                </div>
              </div>
            </div>
            <label className="text-xs text-text-muted min-w-0">{th ? "เลือก Action" : "Choose Action"}
              <select data-testid={`preset-binding-${fn.id}`} value={draft[fn.id] || ""} disabled={saving}
                onChange={event => { setDraft({ ...draft, [fn.id]: event.target.value }); setSaved(false) }}
                className="mt-1 w-full min-w-0 rounded-lg border border-accent/20 bg-bg-card px-3 py-2 text-sm text-text-base">
                <option value="">{th ? "ยังไม่จับคู่" : "Not mapped"}</option>
                {view.actions.map(action => <option key={action.index} value={String(action.index)} disabled={!action.supported}>
                  {`#${action.index + 1} ${action.name} · ${action.triggerLabel || ""} · ${action.keys.map(key => [...key.modifiers, key.key.toUpperCase()].join("+")).join(" → ") || "—"}${action.supported ? "" : th ? " (ไม่รองรับ)" : " (unsupported)"}`}
                </option>)}
              </select>
            </label>
          </div>)}
        </div>
      })}
      {view && !view.functions.functions.length && <p className="text-sm text-text-muted">{th ? "เพิ่ม Functions ในแท็บ Functions ก่อน แล้วกลับมาจับคู่" : "Add Functions in the Functions tab, then return here to map them."}</p>}
      {view && <button data-testid="preset-bindings-save" type="button" onClick={save} disabled={saving} className="rounded-lg bg-accent px-4 py-2 text-sm text-white disabled:opacity-50">{saving ? th ? "กำลังบันทึก…" : "Saving…" : th ? "บันทึกการจับคู่" : "Save bindings"}</button>}
      {saved && <p role="status" className="text-xs text-text-muted">{th ? "บันทึกแล้ว โปรไฟล์ Tikkies เดิมจะเก็บการแก้ไขไว้จนกว่าจะเลือกใช้ค่าเริ่มต้นใหม่" : "Saved. Existing Tikkies profiles keep their edits until new defaults are applied."}</p>}
    </section>
  )
}
