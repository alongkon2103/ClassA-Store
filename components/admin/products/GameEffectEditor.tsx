"use client"

import { useEffect, useId, useRef, useState } from "react"
import { Check, Keyboard, Loader2, Upload, X } from "lucide-react"
import type { GameDefaultsPlatform, GameEffect } from "@/lib/tikkiesGameDefaults"
import { GAME_COMMAND_INPUTS, isGameCommandInput, MINECRAFT_COMMANDS, validateGameResponses } from "@/lib/tikkiesGameDefaults"
import { buttonClass, capturedKey, copy, gameCommandInputLabel, inputClass, newId, primaryClass, responseSummary, safeImage } from "./game-defaults-model"

export default function GameEffectEditor({ effect, platform, th, onKeep, onCancel, inModal = false, interactive = false }: { effect: GameEffect | null; platform: GameDefaultsPlatform; th: boolean; onKeep: (effect: GameEffect) => void; onCancel: () => void; inModal?: boolean; interactive?: boolean }) {
  const prefix = useId()
  const editor = useRef<HTMLElement>(null)
  const [draft, setDraft] = useState<GameEffect>(() => effect ? copy(effect) : { id: newId(), key: "", name: "", imageUrl: null, category: "neutral", responses: platform === "minecraft" ? [{ type: "gameEffect", event: "addmobs" }] : interactive ? [{ type: "robloxEvent", event: "" }] : [{ type: "keypress", key: "", modifiers: [], holdMs: 0 }] })
  const initial = useRef(JSON.stringify(draft))
  const [recording, setRecording] = useState(false), [uploading, setUploading] = useState(false), [error, setError] = useState("")
  const simple = draft.responses.length === 1 && draft.responses[0]?.type === (platform === "minecraft" ? "gameEffect" : interactive ? "robloxEvent" : "keypress")
  const first = draft.responses[0] || {}, modifiers = Array.isArray(first.modifiers) ? first.modifiers as string[] : []
  const patchResponse = (patch: Record<string, unknown>) => setDraft(current => ({ ...current, responses: [{ ...current.responses[0], ...patch }] }))
  const patchInput = (input: string) => setDraft(current => {
    const { input: _prior, ...response } = current.responses[0]
    return { ...current, responses: [{ ...response, ...(isGameCommandInput(input) ? { input } : {}) }] }
  })
  useEffect(() => {
    if (!recording) return
    const visible = () => !!editor.current && editor.current.getClientRects().length > 0 && !editor.current.closest("[hidden]") && getComputedStyle(editor.current).visibility !== "hidden"
    const record = (event: KeyboardEvent) => {
      if (!visible()) { setRecording(false); return }
      event.preventDefault(); event.stopPropagation()
      if (event.key === "Escape") { setRecording(false); return }
      if (["Control", "Alt", "Shift", "Meta"].includes(event.key)) return
      const key = capturedKey(event)
      if (!key) { setError(th ? "ปุ่มนี้ไม่รองรับ เลือกปุ่มอื่น" : "This key is unavailable. Choose another key."); return }
      setDraft(current => ({ ...current, responses: [{ ...current.responses[0], key, modifiers: [...(event.ctrlKey ? ["ctrl"] : []), ...(event.altKey ? ["alt"] : []), ...(event.shiftKey ? ["shift"] : [])] }] }))
      setError(""); setRecording(false)
    }
    const visibility = new MutationObserver(() => { if (!visible()) setRecording(false) })
    for (let element: HTMLElement | null = editor.current; element; element = element.parentElement) visibility.observe(element, { attributes: true, attributeFilter: ["hidden", "style", "class"] })
    window.addEventListener("keydown", record, true)
    return () => { window.removeEventListener("keydown", record, true); visibility.disconnect() }
  }, [recording, th])
  const upload = async (file: File) => {
    if (!["image/png", "image/jpeg", "image/webp", "image/gif"].includes(file.type) || file.size > 5 * 1024 * 1024) { setError(th ? "ใช้รูป PNG, JPG, WebP หรือ GIF ไม่เกิน 5 MB" : "Choose a PNG, JPG, WebP or GIF up to 5 MB."); return }
    setUploading(true); setError("")
    try {
      const body = new FormData(); body.append("file", file); body.append("type", "image")
      const response = await fetch("/api/admin/upload", { method: "POST", body }), result = await response.json()
      if (!response.ok || typeof result.url !== "string" || !safeImage(result.url)) throw Error()
      setDraft(current => ({ ...current, imageUrl: result.url }))
    } catch { setError(th ? "อัปโหลดรูปไม่สำเร็จ ลองอีกครั้ง" : "Image upload failed. Please try again.") } finally { setUploading(false) }
  }
  const keep = () => {
    if (!draft.name.trim()) { setError(th ? "กรุณาตั้งชื่ออีเวนต์เกม" : "Enter a game event name."); return }
    if (!safeImage(draft.imageUrl || "")) { setError(th ? "ใช้ URL รูป HTTPS หรือรูปที่อัปโหลด" : "Use an HTTPS image URL or an uploaded image."); return }
    if (simple && platform === "roblox" && !interactive && (!String(first.key || "").trim() || !Number.isInteger(first.holdMs ?? 0) || Number(first.holdMs || 0) < 0 || Number(first.holdMs || 0) > 10000)) { setError(th ? "เลือกปุ่มและระยะเวลากด 0–10000 ms" : "Choose a key and a hold duration from 0–10000 ms."); return }
    try { validateGameResponses(draft.responses, platform) } catch { setError(th ? "ตรวจสอบปุ่มหรือคำสั่งในเกมก่อน" : "Check the keyboard shortcut or game command."); return }
    onKeep({ ...draft, key: draft.key || (platform === "minecraft" || interactive ? String(first.event) : draft.name.trim().slice(0, 120)), name: draft.name.trim(), imageUrl: draft.imageUrl?.trim() || null })
  }
  const cancel = () => {
    if (JSON.stringify(draft) !== initial.current && !confirm(th ? "ยกเลิกการแก้ไขอีเวนต์นี้?" : "Discard changes to this game event?")) return
    onCancel()
  }
  return <section ref={editor} className={`min-w-0 space-y-4 bg-bg-card p-5 ${inModal ? "" : "rounded-xl border border-accent/30"}`} aria-label={th ? "แก้ไขอีเวนต์เกม" : "Game event editor"}>
    <div className={`flex items-center justify-between gap-3 ${inModal ? "sticky top-0 z-10 -mx-5 -mt-5 border-b border-accent/15 bg-bg-card px-5 py-4" : ""}`}><h3 className="font-semibold">{effect ? th ? "แก้ไขอีเวนต์เกม" : "Edit game event" : th ? "เพิ่มอีเวนต์เกม" : "Add game event"}</h3><button type="button" data-editor-close className={buttonClass} disabled={uploading} onClick={cancel} aria-label={th ? "ปิด" : "Close"}><X size={16} /></button></div>
    <div><label htmlFor={`${prefix}-name`} className="mb-1.5 block text-[12px] text-text-muted">{th ? "ชื่ออีเวนต์เกม" : "Game event name"}</label><input id={`${prefix}-name`} data-testid="effect-name" autoFocus maxLength={200} className={inputClass} value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })} /></div>
    <div className="flex min-w-0 flex-wrap items-end gap-2"><div className="min-w-0 flex-1"><label htmlFor={`${prefix}-image`} className="mb-1.5 block text-[12px] text-text-muted">{th ? "รูปอีเวนต์ (ไม่บังคับ)" : "Event image (optional)"}</label><input id={`${prefix}-image`} type="url" maxLength={2048} className={inputClass} value={draft.imageUrl || ""} placeholder="https://…" onChange={event => setDraft({ ...draft, imageUrl: event.target.value })} /></div><label className={`${buttonClass} cursor-pointer`}>{uploading ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}{th ? "อัปโหลดรูป" : "Upload image"}<input className="sr-only" type="file" accept="image/png,image/jpeg,image/webp,image/gif" disabled={uploading} onChange={event => { const file = event.target.files?.[0]; if (file) void upload(file); event.target.value = "" }} /></label></div>
    {!simple ? <div className="space-y-3 rounded-lg border border-accent/15 bg-bg-base p-3"><p className="text-[13px] font-medium">{th ? "เก็บลำดับคำสั่งที่นำเข้าไว้" : "Imported sequence preserved"}</p><p className="break-words text-[12px] text-text-muted">{responseSummary(draft, th)}</p><p className="text-[12px] text-text-muted">{th ? "เปลี่ยนชื่อหรือรูปได้โดยไม่เปลี่ยนลำดับคำสั่ง" : "Editing the name or image keeps every step unchanged."}</p><button type="button" className={buttonClass} onClick={() => { if (confirm(th ? "แทนที่ลำดับคำสั่งทั้งหมดของอีเวนต์นี้?" : "Replace every step in this game event?")) setDraft({ ...draft, responses: platform === "minecraft" ? [{ type: "gameEffect", event: "addmobs" }] : interactive ? [{ type: "robloxEvent", event: "" }] : [{ type: "keypress", key: "", modifiers: [], holdMs: 0 }] }) }}>{th ? "แทนที่ลำดับคำสั่ง" : "Replace sequence"}</button></div>
      : interactive ? <div className="space-y-3"><div><label htmlFor={`${prefix}-command`} className="mb-1.5 block text-[12px] text-text-muted">{th ? "รหัสคำสั่ง API" : "API command key"}</label><input id={`${prefix}-command`} data-testid="roblox-event" className={inputClass} maxLength={80} autoCapitalize="none" autoCorrect="off" spellCheck={false} value={String(first.event || "")} placeholder="Meteor.Fall" onChange={event => patchResponse({ event: event.target.value })} /><p className="mt-2 text-[12px] text-text-muted">{th ? "ใช้รหัสตรงกับตัวรับในเกม ตัวพิมพ์เล็กและใหญ่ต้องตรงกัน ชื่อและรูปไม่เปลี่ยนการทำงานในเกม" : "Match the receiver command exactly, including letter case. The name and artwork do not change gameplay."}</p></div><div><label htmlFor={`${prefix}-input`} className="mb-1.5 block text-[12px] text-text-muted">{th ? "ข้อมูลจากแชท (ไม่บังคับ)" : "Chat input (optional)"}</label><select id={`${prefix}-input`} data-testid="roblox-input" className={inputClass} value={String(first.input || "")} onChange={event => patchInput(event.target.value)}><option value="">{th ? "ไม่มี" : "None"}</option>{GAME_COMMAND_INPUTS.map(input => <option key={input} value={input}>{gameCommandInputLabel(input, th)}</option>)}</select></div></div>
      : platform === "minecraft" ? <div><label htmlFor={`${prefix}-command`} className="mb-1.5 block text-[12px] text-text-muted">{th ? "คำสั่งในเกม" : "Game command"}</label><select id={`${prefix}-command`} data-testid="minecraft-command" className={inputClass} value={String(first.event || "")} onChange={event => patchResponse({ event: event.target.value })}>{MINECRAFT_COMMANDS.map(command => <option key={command.key} value={command.key}>{command.name}</option>)}</select></div>
      : <div className="space-y-3 rounded-lg border border-accent/15 bg-bg-base p-3"><div className="flex flex-wrap items-center gap-3"><button type="button" data-testid="record-key" className={buttonClass} aria-pressed={recording} onClick={() => { setRecording(!recording); setError("") }}><Keyboard size={16} />{recording ? th ? "กดปุ่มที่ต้องการ… (Esc ยกเลิก)" : "Press a key… (Esc cancels)" : th ? "บันทึกปุ่ม" : "Record key"}</button><kbd className="break-all rounded border border-accent/20 px-3 py-2 text-[13px]">{[...modifiers, String(first.key || (th ? "ยังไม่เลือก" : "No key"))].join(" + ").toUpperCase()}</kbd></div><div className="flex flex-wrap items-center gap-4">{["ctrl", "alt", "shift"].map(modifier => <label key={modifier} className="flex items-center gap-2 text-[12px]"><input type="checkbox" checked={modifiers.includes(modifier)} onChange={event => patchResponse({ modifiers: event.target.checked ? [...modifiers, modifier] : modifiers.filter(item => item !== modifier) })} />{modifier.toUpperCase()}</label>)}<label className="flex items-center gap-2 text-[12px]">{th ? "กดค้าง (ms)" : "Hold (ms)"}<input data-testid="key-hold" aria-label={th ? "ระยะเวลากดค้าง" : "Hold duration"} type="number" min={0} max={10000} step={1} className={`${inputClass} !w-24`} value={Number(first.holdMs || 0)} onChange={event => patchResponse({ holdMs: Number(event.target.value) })} /></label></div></div>}
    {error && <p role="alert" className="text-[13px] text-red-400">{error}</p>}
    <div className={`flex justify-between gap-2 ${inModal ? "sticky bottom-0 z-10 -mx-5 -mb-5 border-t border-accent/15 bg-bg-card px-5 py-4" : ""}`}><button type="button" className={buttonClass} disabled={uploading} onClick={cancel}>{th ? "ยกเลิก" : "Cancel"}</button><button type="button" className={primaryClass} disabled={uploading || recording} onClick={keep}><Check size={15} />{th ? "เก็บอีเวนต์" : "Keep event"}</button></div>
  </section>
}
