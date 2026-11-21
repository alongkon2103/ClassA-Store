"use client"

import { useEffect, useRef, useState } from "react"
import Image from "next/image"
import { useLocale } from "next-intl"
import type { gifts as Gift } from "@prisma/client"
import { ArrowRight, Check, Download, Gamepad2, Gift as GiftIcon, GripVertical, Heart, Keyboard, Loader2, MessageSquare, Pencil, Plus, RefreshCw, Share2, Star, Target, Trash2, Upload, UserPlus, Users, X } from "lucide-react"
import type { GameDefaultAction, GameDefaultsDocument, GameDefaultsView, GameEffect } from "@/lib/tikkiesGameDefaults"
import { gameActionIdentity, gameEffectIdentity, validateGameDefaults, validateGameResponses, validateGameTrigger } from "@/lib/tikkiesGameDefaults"
import { validateGameIntegration, validateGameIntegrationResponses, type GameIntegration } from "@/lib/gameIntegration"
import { getImageUrl } from "@/lib/getImageUrl"
import GameDefaultActionEditor from "./GameDefaultActionEditor"
import GameEffectEditor from "./GameEffectEditor"
import GameDefaultsDialog from "./GameDefaultsDialog"
import useGameDefaultsReorder from "./useGameDefaultsReorder"
import { buttonClass, copy, inputClass, primaryClass, responseSummary, triggerNames, triggerSummary } from "./game-defaults-model"

type Notice = { text: string; error?: boolean }
type ApiError = { error?: string; code?: string; field?: string; warnings?: string[]; message?: string }
const MAX_IMPORT_BYTES = 2 * 1024 * 1024
const triggerIcons: Record<string, typeof GiftIcon> = { like: Heart, chat: MessageSquare, follow: UserPlus, share: Share2, member: Users, subscribe: Star, hotkey: Keyboard, goalReached: Target }

export default function GameDefaultsManager({ productId, allGifts = [] }: { productId: string; allGifts?: Gift[] }) {
  const th = useLocale() === "th", names = triggerNames(th), endpoint = `/api/admin/products/${productId}/game-defaults`, cacheKey = `aclass-game-defaults:${productId}`
  const [view, setView] = useState<GameDefaultsView | null>(null), [document, setDocument] = useState<GameDefaultsDocument | null>(null)
  const [integration, setIntegration] = useState<GameIntegration>({ schemaVersion: 1, mode: "keyboard", protocol: null, placeIds: [], universeId: null }), [integrationRevision, setIntegrationRevision] = useState("")
  const [receiverSetup, setReceiverSetup] = useState<string | null>(null), [setupBusy, setSetupBusy] = useState(false)
  const [baseline, setBaseline] = useState(""), [revision, setRevision] = useState(""), [loading, setLoading] = useState(true), [busy, setBusy] = useState(false)
  const [unsupported, setUnsupported] = useState(false), [notice, setNotice] = useState<Notice | null>(null), [conflict, setConflict] = useState(false)
  const [tab, setTab] = useState<"actions" | "effects">("actions"), [actionEditor, setActionEditor] = useState<string | null>(null), [effectEditor, setEffectEditor] = useState<string | null>(null)
  const [showImport, setShowImport] = useState(false), [presetId, setPresetId] = useState(""), [importFile, setImportFile] = useState<{ name: string; preset: unknown } | null>(null)
  const [warnings, setWarnings] = useState<string[]>([]), [importBusy, setImportBusy] = useState(false)
  const [returnFocus, setReturnFocus] = useState<HTMLElement | null>(null)
  const mounted = useRef(true), serial = useRef(0), setupGeneration = useRef(0), sortRoot = useRef<HTMLDivElement>(null)
  const hideReceiverSetup = () => { setupGeneration.current++; setReceiverSetup(null); setSetupBusy(false) }
  const dirty = !!document && JSON.stringify({ document, integration }) !== baseline, editing = actionEditor !== null || effectEditor !== null || showImport
  const locked = loading || busy || importBusy
  const reorder = useGameDefaultsReorder({ root: sortRoot, disabled: locked || editing, th, onReorder: (kind, id, to) => setDocument(current => {
    if (!current) return current
    const items = [...current[kind]], from = items.findIndex(item => item.id === id)
    if (from < 0 || to < 0 || to >= items.length || from === to) return current
    const [item] = items.splice(from, 1); items.splice(to, 0, item)
    return { ...current, [kind]: items }
  }) })
  const clearCache = () => { try { sessionStorage.removeItem(cacheKey) } catch { /* Storage may be unavailable in private sessions. */ } }
  const errorText = (data: ApiError, status?: number) => {
    const code = data.error || data.code
    if (code === "duplicate_action") return th ? "มี Action ที่ใช้เหตุการณ์และอีเวนต์เกมนี้เหมือนกันแล้ว" : "An Action with this trigger and game event already exists."
    if (code === "duplicate_effect") return th ? "มีอีเวนต์เกมนี้แล้ว เลือกใช้อีเวนต์เดิมใน Action ได้เลย" : "This game event already exists. Use the existing game event in your Action."
    if (code === "overlapping_action") return th ? "ของขวัญนี้สั่งอีเวนต์เกมเดียวกันซ้ำ เลือกไว้เพียง Action เดียว หรือปิด Action ที่ซ้ำ" : "This gift triggers the same game event more than once. Keep one Action or disable the extra one."
    if (code === "integration_response_mismatch") return th ? "แก้ไขคำสั่งอีเวนต์ให้ตรงกับโหมดที่เลือกก่อนบันทึก" : "Update the game event responses to match the selected connection mode before saving."
    if (code === "game_commands_capacity_exceeded") return th ? "เกม API รองรับรหัสคำสั่งที่ไม่ซ้ำกันได้ไม่เกิน 200 คำสั่ง" : "API games support up to 200 unique command keys."
    if (code === "game_credential_unavailable") return th ? "โฮสต์ยังไม่ได้ตั้งค่าคีย์สำหรับตัวรับเกม" : "The host has not configured game receiver credentials."
    if (status === 413) return th ? "ไฟล์ใหญ่เกิน 2 MB" : "The file exceeds 2 MB."
    if (code?.includes("unsupported") || code?.includes("incompatible")) return th ? "ไฟล์มีเหตุการณ์หรือคำสั่งที่ยังไม่รองรับ ค่าเดิมยังอยู่ครบ" : "This file contains an unsupported trigger or response. Your draft is unchanged."
    if (code?.includes("invalid")) return th ? "ตรวจสอบข้อมูล แล้วลองอีกครั้ง" : "Check the input and try again."
    if (status === 403) return th ? "บัญชีนี้ไม่มีสิทธิ์แก้ไขค่าเริ่มต้น" : "This account cannot edit defaults."
    return th ? "บันทึกหรือโหลดข้อมูลไม่สำเร็จ ลองอีกครั้ง ข้อมูลที่แก้ยังอยู่" : "Could not load or save defaults. Please try again. Your draft is retained."
  }
  const load = async (recover = false) => {
    const request = ++serial.current
    setLoading(true); setNotice(null)
    try {
      const response = await fetch(endpoint, { cache: "no-store" }), data = await response.json()
      if (!mounted.current || request !== serial.current) return
      if (!response.ok) {
        if (response.status === 409 && /(?:not_supported|unsupported)/.test(data.error || "")) setUnsupported(true)
        else setNotice({ text: errorText(data, response.status), error: true })
        return
      }
      const next = data as GameDefaultsView
      if (!next.ok || !next.document || !["roblox", "minecraft"].includes(next.platform)) { setNotice({ text: errorText({}), error: true }); return }
      const savedIntegration = next.integration || { schemaVersion: 1 as const, mode: "keyboard" as const, protocol: null, placeIds: [], universeId: null }
      let draft = next.document, draftIntegration = savedIntegration, expectedRevision = next.revision, expectedIntegrationRevision = next.integrationRevision || "", recovered = false
      if (recover) {
        try {
          const stored = JSON.parse(sessionStorage.getItem(cacheKey) || "null")
          if (stored?.document?.schemaVersion === 1 && stored.document.platform === next.platform && Array.isArray(stored.document.effects) && Array.isArray(stored.document.actions) && typeof stored.revision === "string") {
            draft = stored.document; expectedRevision = stored.revision
            // Recover incomplete forms too: entering Place IDs is a separate step from selecting API.
            const connection = stored.integration
            if (connection?.schemaVersion === 1 && ["keyboard", "api"].includes(connection.mode) && Array.isArray(connection.placeIds) && connection.placeIds.length <= 50 && connection.placeIds.every((id: unknown) => typeof id === "string") && (connection.universeId === null || typeof connection.universeId === "string")) draftIntegration = { schemaVersion: 1, mode: connection.mode, protocol: connection.mode === "api" ? "roblox-interactive-v1" : null, placeIds: connection.mode === "api" ? connection.placeIds : [], universeId: connection.mode === "api" ? connection.universeId : null }
            expectedIntegrationRevision = typeof stored.integrationRevision === "string" ? stored.integrationRevision : expectedIntegrationRevision; recovered = true
          }
        } catch { /* A damaged or unavailable local draft does not block loading. */ }
      } else clearCache()
      setView(next); setDocument(copy(draft)); setIntegration(copy(draftIntegration)); setIntegrationRevision(expectedIntegrationRevision); hideReceiverSetup(); setBaseline(JSON.stringify({ document: next.document, integration: savedIntegration })); setRevision(expectedRevision); setWarnings(next.warnings || [])
      setUnsupported(false); setConflict(recovered && (expectedRevision !== next.revision || expectedIntegrationRevision !== (next.integrationRevision || ""))); setActionEditor(null); setEffectEditor(null)
      if (recovered) setNotice({ text: th ? "กู้คืนฉบับที่ยังไม่ได้บันทึกแล้ว" : "Your unsaved draft has been restored." })
    } catch { if (mounted.current && request === serial.current) setNotice({ text: errorText({}), error: true }) }
    finally { if (mounted.current && request === serial.current) setLoading(false) }
  }
  useEffect(() => {
    mounted.current = true
    setupGeneration.current++
    const timer = window.setTimeout(() => void load(true), 0)
    return () => { mounted.current = false; window.clearTimeout(timer) }
    // Product identity owns this editor and its recoverable draft.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId])
  useEffect(() => {
    if (!document || loading) return
    try { if (dirty) sessionStorage.setItem(cacheKey, JSON.stringify({ revision, document, integration, integrationRevision })); else sessionStorage.removeItem(cacheKey) } catch { /* The editor still works when browser storage is unavailable. */ }
  }, [cacheKey, document, dirty, loading, revision, integration, integrationRevision])
  useEffect(() => {
    if (!dirty && !editing) return
    const protect = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = "" }
    window.addEventListener("beforeunload", protect)
    return () => window.removeEventListener("beforeunload", protect)
  }, [dirty, editing])
  const save = async () => {
    if (!document || locked || editing) return
    try { validateGameDefaults(document); validateGameIntegration(integration); validateGameIntegrationResponses(integration, document) } catch (error) { setNotice({ text: errorText(error as ApiError), error: true }); return }
    setBusy(true); setNotice(null)
    try {
      const response = await fetch(endpoint, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ expectedRevision: revision, document, ...(integrationRevision ? { integration, expectedIntegrationRevision: integrationRevision } : {}) }) }), data = await response.json()
      if (!mounted.current) return
      if (!response.ok) { if (response.status === 409) setConflict(true); else setNotice({ text: errorText(data, response.status), error: true }); return }
      const next = data as GameDefaultsView
      if (!next.ok || !next.document) throw Error()
      const savedIntegration = next.integration || integration
      setView(next); setDocument(copy(next.document)); setIntegration(copy(savedIntegration)); setIntegrationRevision(next.integrationRevision || ""); hideReceiverSetup(); setBaseline(JSON.stringify({ document: next.document, integration: savedIntegration })); setRevision(next.revision); setWarnings(next.warnings || []); setConflict(false); clearCache()
      setNotice({ text: th ? "บันทึกค่าเริ่มต้นแล้ว" : "Defaults saved." })
    } catch { if (mounted.current) setNotice({ text: errorText({}), error: true }) } finally { if (mounted.current) setBusy(false) }
  }
  const reload = () => { if ((dirty || editing) && !confirm(th ? "โหลดค่าที่บันทึกล่าสุดและยกเลิกฉบับที่แก้ค้างไว้?" : "Reload saved defaults and discard your current draft?")) return; void load(false) }
  const openAction = (id: string) => { setReturnFocus(window.document.querySelector<HTMLElement>(`[data-testid="edit-action-${id}"]`) || window.document.activeElement as HTMLElement); setEffectEditor(null); setActionEditor(id); setShowImport(false); setNotice(null) }
  const openEffect = (id: string) => { setReturnFocus(window.document.querySelector<HTMLElement>(`[data-testid="edit-effect-${id}"]`) || window.document.activeElement as HTMLElement); setActionEditor(null); setEffectEditor(id); setShowImport(false); setNotice(null) }
  const keepEffect = (effect: GameEffect): boolean => {
    if (!document) return false
    const identity = gameEffectIdentity({ ...effect, responses: validateGameResponses(effect.responses, document.platform) })
    if (document.effects.some(item => item.id !== effect.id && gameEffectIdentity({ ...item, responses: validateGameResponses(item.responses, document.platform) }) === identity)) { setNotice({ text: errorText({ error: "duplicate_effect" }), error: true }); return false }
    setDocument(current => current ? { ...current, effects: current.effects.some(item => item.id === effect.id) ? current.effects.map(item => item.id === effect.id ? effect : item) : [...current.effects, effect] } : current)
    setNotice(null)
    return true
  }
  const keepAction = (action: GameDefaultAction) => {
    const identity = gameActionIdentity({ ...action, trigger: validateGameTrigger(action.trigger) })
    if (document?.actions.some(item => item.id !== action.id && gameActionIdentity({ ...item, trigger: validateGameTrigger(item.trigger) }) === identity)) { setNotice({ text: errorText({ error: "duplicate_action" }), error: true }); return }
    setDocument(current => current ? { ...current, actions: current.actions.some(item => item.id === action.id) ? current.actions.map(item => item.id === action.id ? action : item) : [...current.actions, action] } : current); setNotice(null); setActionEditor(null)
  }
  const removeAction = (action: GameDefaultAction) => {
    if (!confirm(th ? `ลบ Action “${action.name}”?` : `Delete Action “${action.name}”?`)) return
    setDocument(current => current ? { ...current, actions: current.actions.filter(item => item.id !== action.id) } : current)
  }
  const removeEffect = (effect: GameEffect) => {
    const count = document?.actions.filter(item => item.effectId === effect.id).length || 0
    if (count) { setNotice({ text: th ? `มี ${count} Actions ใช้อีเวนต์นี้อยู่ เปลี่ยนอีเวนต์ใน Actions ก่อนลบ` : `${count} Actions use this event. Remap those Actions before deleting it.`, error: true }); return }
    if (!confirm(th ? `ลบอีเวนต์ “${effect.name}”?` : `Delete game event “${effect.name}”?`)) return
    setDocument(current => current ? { ...current, effects: current.effects.filter(item => item.id !== effect.id) } : current)
  }
  const showReceiverSetup = async () => {
    const request = ++setupGeneration.current
    setSetupBusy(true); setReceiverSetup(null); setNotice(null)
    try {
      const response = await fetch(`${endpoint}/connection`, { method: "POST", cache: "no-store" }), data = await response.json()
      if (!mounted.current || request !== setupGeneration.current) return
      if (!response.ok) { setNotice({ text: errorText(data, response.status), error: true }); return }
      setReceiverSetup(JSON.stringify(data, null, 2))
    } catch { if (mounted.current && request === setupGeneration.current) setNotice({ text: errorText({}), error: true }) } finally { if (mounted.current && request === setupGeneration.current) setSetupBusy(false) }
  }
  const chooseFile = async (file: File) => {
    if (!/\.tikkies$/i.test(file.name) || file.size > MAX_IMPORT_BYTES) { setNotice({ text: th ? "เลือกไฟล์ .tikkies ไม่เกิน 2 MB" : "Choose a .tikkies file up to 2 MB.", error: true }); return }
    try { const preset: unknown = JSON.parse(await file.text()); setImportFile({ name: file.name, preset }); setPresetId(""); setNotice(null) }
    catch { setNotice({ text: th ? "อ่านไฟล์ไม่ได้ กรุณาเลือกไฟล์ .tikkies ที่ถูกต้อง" : "Could not read this file. Choose a valid .tikkies export.", error: true }) }
  }
  const importPreview = async () => {
    if ((!presetId && !importFile) || locked) return
    if (dirty && !confirm(th ? "แทนที่ฉบับที่ยังไม่ได้บันทึกด้วยไฟล์นำเข้า?" : "Replace your unsaved draft with the imported file?")) return
    setImportBusy(true); setNotice(null)
    try {
      const response = await fetch(`${endpoint}/import`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(importFile ? { preset: importFile.preset } : { presetId }) }), data = await response.json()
      if (!mounted.current) return
      if (!response.ok) { setNotice({ text: errorText(data, response.status), error: true }); return }
      if (!data.ok || !data.document || data.document.platform !== view?.platform) throw Error()
      const imported = validateGameDefaults(data.document, { allowOverlappingActions: true })
      setDocument(copy(imported)); setWarnings(data.warnings || []); setShowImport(false); setNotice({ text: th ? "นำเข้าฉบับร่างแล้ว ตรวจสอบก่อนบันทึก" : "Imported as a draft. Review it, then save defaults." })
    } catch (error) { if (mounted.current) setNotice({ text: errorText(error as ApiError), error: true }) } finally { if (mounted.current) setImportBusy(false) }
  }
  const exportDocument = () => {
    if (!document) return
    const url = URL.createObjectURL(new Blob([JSON.stringify(document, null, 2)], { type: "application/json" })), anchor = window.document.createElement("a")
    anchor.href = url; anchor.download = "game-actions.tikkies"; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  const grip = (kind: "actions" | "effects", id: string, name: string) => <button type="button" data-testid={`drag-${kind === "actions" ? "action" : "effect"}-${id}`} {...reorder.handle(kind, id, name)} title={th ? "ลากเพื่อเรียงลำดับ หรือกด Space แล้วใช้ลูกศร" : "Drag to reorder, or press Space and use arrow keys"} className="inline-flex h-10 w-8 touch-none shrink-0 cursor-grab items-center justify-center rounded-lg text-text-muted hover:bg-accent/10 hover:text-text-base focus-visible:outline-2 focus-visible:outline-accent active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-40"><GripVertical size={18} /></button>
  const marker = (kind: "actions" | "effects", id: string) => reorder.marker?.kind === kind && reorder.marker.id === id ? <span aria-hidden="true" className={`pointer-events-none absolute inset-x-0 z-10 h-0.5 bg-accent ${reorder.marker.after ? "bottom-0" : "top-0"}`} /> : null
  if (unsupported) return <div className="rounded-xl border border-accent/15 bg-bg-card p-5 text-[13px] text-text-muted">{th ? "สินค้านี้ยังไม่รองรับ Actions ค่าเริ่มต้น" : "Actions defaults are not available for this product."}</div>
  if (!document || !view) return <div className="rounded-xl border border-accent/15 bg-bg-card p-6">{loading ? <p role="status" className="flex items-center gap-2 text-[13px] text-text-muted"><Loader2 size={16} className="animate-spin" />{th ? "กำลังโหลดค่าเริ่มต้น…" : "Loading defaults…"}</p> : <><p role="alert" className="mb-3 text-[13px] text-red-400">{notice?.text}</p><button type="button" className={buttonClass} onClick={() => void load(true)}><RefreshCw size={15} />{th ? "ลองอีกครั้ง" : "Retry"}</button></>}</div>
  return <div ref={sortRoot} data-game-defaults-manager className="min-w-0 space-y-5">
    <p id={reorder.helpId} className="sr-only">{th ? "ลากเพื่อเรียงลำดับ หรือกด Space ใช้ลูกศรขึ้นลง แล้วกด Enter เพื่อวาง Esc เพื่อยกเลิก" : "Drag to reorder, or press Space, use up/down arrows, then Enter to drop. Escape cancels."}</p><p role="status" aria-live="polite" className="sr-only">{reorder.announcement}</p>
    {reorder.drag && !reorder.drag.keyboard && <div aria-hidden="true" className="pointer-events-none fixed z-50 w-56 rounded-lg border border-accent/35 bg-bg-card px-4 py-3 shadow-lg" style={{ left: `clamp(16px, ${reorder.drag.x + 16}px, calc(100vw - 240px))`, top: `clamp(16px, ${reorder.drag.y + 16}px, calc(100dvh - 80px))` }}><p className="truncate text-[13px] font-medium">{reorder.drag.label}</p><p className="mt-1 text-[11px] text-text-muted">{reorder.drag.to < 0 ? th ? "วางกลับในรายการ" : "Drop within the list" : th ? `วางที่อันดับ ${reorder.drag.to + 1}` : `Drop at position ${reorder.drag.to + 1}`}</p></div>}
    <header className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-[18px] font-semibold">{th ? "Actions ค่าเริ่มต้น" : "Actions defaults"}</h2><p className="mt-1 text-[13px] text-text-muted">{th ? "เลือกเหตุการณ์จากผู้ชม แล้วจับคู่กับอีเวนต์ในเกม" : "Choose a viewer trigger and the game event it runs."}</p><p className="mt-2 text-[12px] text-text-muted">{view.published ? th ? "มีค่าเริ่มต้นที่เผยแพร่แล้ว" : "Published defaults available" : th ? "ยังไม่ได้เผยแพร่ ตรวจสอบและบันทึกเพื่อใช้งาน" : "Not published. Review and save to make these available."}{dirty && <span data-testid="defaults-dirty" className="ml-2 text-amber-400">· {th ? "ยังไม่ได้บันทึก" : "Unsaved changes"}</span>}</p></div><div className="flex flex-wrap gap-2">{integration.mode !== "api" && <><button type="button" className={buttonClass} disabled={locked || editing} onClick={event => { setReturnFocus(event.currentTarget); setNotice(null); setShowImport(!showImport) }}><Upload size={15} />{th ? "นำเข้า" : "Import"}</button><button type="button" className={buttonClass} disabled={locked || editing} onClick={exportDocument}><Download size={15} />{th ? "ส่งออก" : "Export"}</button></>}<button type="button" data-testid="save-defaults" className={primaryClass} disabled={locked || editing || conflict || (!dirty && view.published)} onClick={save}>{busy ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}{busy ? th ? "กำลังบันทึก…" : "Saving…" : th ? "บันทึกค่าเริ่มต้น" : "Save defaults"}</button></div></header>
    {document.platform === "roblox" && <details data-testid="connection-settings" className="rounded-lg border border-accent/15 p-3" onToggle={event => { if (!event.currentTarget.open) hideReceiverSetup() }}><summary className="cursor-pointer text-[13px] font-medium">{th ? "การเชื่อมต่อเกม" : "Game connection"}<span className="ml-2 font-normal text-text-muted">{integration.mode === "api" ? "API" : "Keyboard"}</span></summary><div className="mt-4 space-y-4"><div><label htmlFor={`connection-mode-${productId}`} className="mb-1.5 block text-[12px] text-text-muted">{th ? "วิธีสั่งเกม" : "Connection mode"}</label><select id={`connection-mode-${productId}`} data-testid="connection-mode" className={inputClass} disabled={locked || editing} value={integration.mode} onChange={event => { hideReceiverSetup(); setIntegration(event.target.value === "api" ? { schemaVersion: 1, mode: "api", protocol: "roblox-interactive-v1", placeIds: [], universeId: null } : { schemaVersion: 1, mode: "keyboard", protocol: null, placeIds: [], universeId: null }) }}><option value="keyboard">Keyboard</option><option value="api">API</option></select></div>{integration.mode === "api" && <><div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><div><label htmlFor={`connection-places-${productId}`} className="mb-1.5 block text-[12px] text-text-muted">Roblox Place IDs</label><input id={`connection-places-${productId}`} data-testid="connection-places" className={inputClass} disabled={locked || editing} value={integration.placeIds.join(", ")} placeholder="123456789" maxLength={1100} onChange={event => { hideReceiverSetup(); setIntegration({ ...integration, placeIds: event.target.value.trim() ? event.target.value.split(",").map(id => id.trim()) : [] }) }} /><p className="mt-1 text-[11px] text-text-muted">{th ? "แยกหลาย Place ด้วยจุลภาค" : "Separate multiple places with commas."}</p></div><div><label htmlFor={`connection-universe-${productId}`} className="mb-1.5 block text-[12px] text-text-muted">{th ? "Universe ID (ไม่บังคับ)" : "Universe ID (optional)"}</label><input id={`connection-universe-${productId}`} data-testid="connection-universe" className={inputClass} disabled={locked || editing} value={integration.universeId || ""} maxLength={20} onChange={event => { hideReceiverSetup(); setIntegration({ ...integration, universeId: event.target.value || null }) }} /></div></div><p className="text-[12px] text-text-muted">{th ? "เพิ่มรหัสคำสั่งในอีเวนต์เกม แล้วใช้ตัวรับ Roblox บนเซิร์ฟเวอร์ของเกมที่มีคำสั่งเหล่านั้น" : "Enter command keys in game events. The Roblox server receiver must implement those commands."}</p><button type="button" data-testid="receiver-setup" className={buttonClass} disabled={locked || editing || dirty || !view.published || setupBusy} onClick={() => void showReceiverSetup()}>{setupBusy && <Loader2 size={15} className="animate-spin" />}{th ? "แสดงการตั้งค่าตัวรับเซิร์ฟเวอร์" : "Show server receiver setup"}</button>{dirty && <p className="text-[11px] text-text-muted">{th ? "บันทึกก่อนแสดงการตั้งค่าตัวรับ" : "Save changes before viewing receiver setup."}</p>}{receiverSetup && <div className="space-y-2"><p className="text-[12px] text-text-muted">{th ? "ใช้ใน LiveConfig ฝั่งเซิร์ฟเวอร์เท่านั้น เก็บ BridgeKey เป็นความลับ การปิดส่วนนี้จะซ่อนข้อมูล" : "Use receiverConfig in server-only LiveConfig. Keep BridgeKey private. Closing this section hides the setup."}</p><textarea data-testid="receiver-config" aria-label="Server receiver setup" className={`${inputClass} min-h-64 font-mono text-[12px]`} readOnly value={receiverSetup} /><button type="button" className={buttonClass} onClick={() => hideReceiverSetup()}>{th ? "ซ่อนการตั้งค่า" : "Hide setup"}</button></div>}</>}</div></details>}
    {notice && !editing && <p role={notice.error ? "alert" : "status"} className={`rounded-lg border p-3 text-[13px] ${notice.error ? "border-red-400/25 bg-red-500/5 text-red-400" : "border-accent/20 bg-accent/5 text-text-base"}`}>{notice.text}</p>}
    {conflict && <div data-testid="defaults-conflict" role="alert" className="space-y-3 rounded-lg border border-amber-400/30 bg-amber-400/5 p-4"><p className="text-[13px] text-amber-300">{th ? "มีค่าใหม่ถูกบันทึกแล้ว ฉบับที่คุณแก้ยังอยู่ โหลดค่าล่าสุดก่อนแก้ต่อ" : "Newer defaults were saved. Your draft is retained. Reload the saved version before continuing."}</p><button type="button" className={buttonClass} disabled={locked} onClick={reload}><RefreshCw size={15} />{th ? "โหลดค่าที่บันทึกล่าสุด" : "Reload saved defaults"}</button></div>}
    {warnings.length > 0 && <details className="rounded-lg border border-amber-400/20 p-3" open><summary className="cursor-pointer text-[12px] font-medium text-amber-300">{th ? "รายการที่ควรตรวจสอบ" : "Review notes"} ({warnings.length})</summary><ul className="mt-2 list-disc space-y-1 pl-4 text-[12px] text-text-muted">{warnings.map((warning, index) => <li key={`${index}-${warning}`}>{warning}</li>)}</ul></details>}
    {showImport && <GameDefaultsDialog returnFocus={returnFocus} label={th ? "นำเข้า Actions" : "Import Actions"} error={notice?.error ? notice.text : undefined}><section className="space-y-4 bg-bg-card p-5" aria-label={th ? "นำเข้า Actions" : "Import Actions"}><div className="flex items-center justify-between gap-2"><div><h3 className="text-[14px] font-semibold">{th ? "นำเข้า Actions" : "Import Actions"}</h3><p className="mt-1 text-[12px] text-text-muted">{th ? "นำเข้าเป็นฉบับร่างก่อน ไฟล์เดิมจะยังอยู่" : "Preview as a draft. Original downloads stay available."}</p></div><button type="button" className={buttonClass} disabled={locked} onClick={() => setShowImport(false)} data-editor-close aria-label={th ? "ปิดการนำเข้า" : "Close import"}><X size={15} /></button></div><div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2"><div><label htmlFor={`defaults-preset-${productId}`} className="mb-1.5 block text-[12px] text-text-muted">{th ? "ไฟล์ที่เคยอัปโหลด" : "Previously uploaded file"}</label><select id={`defaults-preset-${productId}`} data-testid="import-preset" className={inputClass} disabled={locked} value={presetId} onChange={event => { setPresetId(event.target.value); setImportFile(null) }}><option value="">{th ? "เลือกไฟล์…" : "Choose a file…"}</option>{view.presets.map(preset => <option key={preset.id} value={preset.id}>{preset.filename}</option>)}</select></div><label className={`${buttonClass} cursor-pointer`}><Upload size={15} />{th ? "เลือกไฟล์ .tikkies" : "Choose .tikkies file"}<input aria-label={th ? "เลือกไฟล์ .tikkies" : "Choose .tikkies file"} className="sr-only" type="file" accept=".tikkies,application/json" disabled={locked} onChange={event => { const file = event.target.files?.[0]; if (file) void chooseFile(file); event.target.value = "" }} /></label></div>{importFile && <p className="break-words text-[12px] text-text-muted">{importFile.name}</p>}<div className="flex justify-end"><button type="button" className={primaryClass} disabled={locked || (!presetId && !importFile)} onClick={importPreview}>{importBusy ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}{th ? "ดูตัวอย่างการนำเข้า" : "Preview import"}</button></div></section></GameDefaultsDialog>}
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-accent/15 pb-3"><div className="flex gap-1" role="tablist" aria-label={th ? "ค่าเริ่มต้นเกม" : "Game defaults"}><button type="button" role="tab" aria-label="Actions" aria-selected={tab === "actions"} className={`${buttonClass} ${tab === "actions" ? "border-accent/40 bg-accent/10 text-accent-light" : "border-transparent text-text-muted"}`} disabled={editing || locked} onClick={() => setTab("actions")}>{th ? "Actions" : "Actions"}<span className="text-[11px] text-text-muted">{document.actions.length}</span></button><button type="button" role="tab" aria-label={th ? "อีเวนต์เกม" : "Game events"} aria-selected={tab === "effects"} className={`${buttonClass} ${tab === "effects" ? "border-accent/40 bg-accent/10 text-accent-light" : "border-transparent text-text-muted"}`} disabled={editing || locked} onClick={() => setTab("effects")}>{th ? "อีเวนต์เกม" : "Game events"}<span className="text-[11px] text-text-muted">{document.effects.length}</span></button></div><button type="button" className={buttonClass} disabled={locked || editing || (tab === "actions" ? document.actions.length : document.effects.length) >= 200} onClick={() => tab === "actions" ? openAction("new") : openEffect("new")}><Plus size={15} />{tab === "actions" ? th ? "เพิ่ม Action" : "Add Action" : th ? "เพิ่มอีเวนต์เกม" : "Add game event"}</button></div>
    {actionEditor !== null && <GameDefaultsDialog returnFocus={returnFocus} label={actionEditor === "new" ? th ? "เพิ่ม Action" : "Add Action" : th ? "แก้ไข Action" : "Edit Action"} error={notice?.error ? notice.text : undefined}><GameDefaultActionEditor key={actionEditor} inModal interactive={integration.mode === "api"} action={document.actions.find(item => item.id === actionEditor) || null} effects={document.effects} gifts={allGifts} platform={document.platform} th={th} onCancel={() => setActionEditor(null)} onKeep={keepAction} onAddEffect={keepEffect} /></GameDefaultsDialog>}
    {effectEditor !== null && <GameDefaultsDialog returnFocus={returnFocus} label={effectEditor === "new" ? th ? "เพิ่มอีเวนต์เกม" : "Add game event" : th ? "แก้ไขอีเวนต์เกม" : "Edit game event"} error={notice?.error ? notice.text : undefined}><GameEffectEditor key={effectEditor} inModal interactive={integration.mode === "api"} effect={document.effects.find(item => item.id === effectEditor) || null} platform={document.platform} th={th} onCancel={() => setEffectEditor(null)} onKeep={effect => { if (keepEffect(effect)) setEffectEditor(null) }} /></GameDefaultsDialog>}
    {tab === "actions" ? <div className="overflow-hidden rounded-xl border border-accent/15 bg-bg-card">
      {!document.actions.length ? <div className="space-y-3 p-8 text-center"><Gamepad2 className="mx-auto text-text-muted" size={28} /><p className="text-[13px] text-text-muted">{th ? "เริ่มจากของขวัญ แชท หรือไลก์ แล้วเลือกอีเวนต์เกม" : "Start with a gift, chat or like, then choose a game event."}</p><button type="button" className={buttonClass} disabled={locked || editing} onClick={() => openAction("new")}><Plus size={15} />{th ? "เพิ่ม Action แรก" : "Add first Action"}</button></div> : <><div className="hidden grid-cols-[32px_minmax(0,1fr)_20px_minmax(0,1fr)_144px] gap-3 border-b border-accent/10 px-3 py-3 text-[11px] text-text-muted md:grid"><span /><span>{th ? "เหตุการณ์จากผู้ชม" : "Viewer trigger"}</span><span /><span>{th ? "อีเวนต์เกม" : "Game event"}</span><span className="text-right">{th ? "ใช้งาน / แก้ไข" : "Enabled / edit"}</span></div><div data-reorder-list="actions" className="divide-y divide-accent/10">{document.actions.map(action => {
        const TriggerIcon = triggerIcons[String(action.trigger.type)] || GiftIcon
        const effect = document.effects.find(item => item.id === action.effectId), gift = action.trigger.type === "gift" ? allGifts.find(item => String(item.id) === String(action.trigger.giftId)) : null
        return <article key={action.id} data-default-action={action.id} data-reorder-id={action.id} className={`relative grid min-w-0 grid-cols-[32px_minmax(0,1fr)] gap-3 px-3 py-4 md:grid-cols-[32px_minmax(0,1fr)_20px_minmax(0,1fr)_144px] md:items-center ${action.enabled ? "" : "opacity-55"} ${reorder.drag?.id === action.id ? "bg-accent/5 opacity-60" : ""}`}>
          {marker("actions", action.id)}<div className="row-span-3 md:row-span-1">{grip("actions", action.id, action.name)}</div>
          <div className="flex min-w-0 items-center gap-3">{gift?.image_url ? <Image src={getImageUrl(gift.image_url)} alt="" width={36} height={36} unoptimized className="h-9 w-9 shrink-0 object-contain" /> : <TriggerIcon size={24} className="shrink-0 text-text-muted" aria-hidden="true" />}<div className="min-w-0"><p className="break-words text-[13px] font-medium">{triggerSummary(action, th)}</p><p className="mt-0.5 text-[11px] text-text-muted">{names[String(action.trigger.type)] || String(action.trigger.type)}{action.trigger.type === "gift" ? action.trigger.waitForCombo ? th ? " · รอคอมโบจบ" : " · after combo" : th ? " · ทำงานทันที" : " · immediate" : ""}{action.cooldownSec ? ` · ${action.cooldownSec}s` : ""}</p></div></div>
          <ArrowRight size={16} className="hidden text-text-muted md:block" aria-hidden="true" />
          <div className="flex min-w-0 items-center gap-3">{effect?.imageUrl ? <Image src={getImageUrl(effect.imageUrl)} alt="" width={36} height={36} unoptimized className="h-9 w-9 shrink-0 rounded-lg object-contain" /> : <Gamepad2 size={24} className="shrink-0 text-text-muted" aria-hidden="true" />}<div className="min-w-0"><p className="break-words text-[13px] font-medium">{effect?.name || (th ? "ไม่พบอีเวนต์เกม" : "Game event unavailable")}</p><p className="mt-0.5 break-words text-[11px] text-text-muted">{effect && responseSummary(effect, th)}</p></div></div>
          <div className="flex items-center justify-end gap-2"><label className="relative mr-1 inline-flex h-10 cursor-pointer items-center"><input type="checkbox" role="switch" aria-label={`${th ? "เปิดใช้" : "Enable"} ${action.name}`} checked={action.enabled} disabled={locked || editing} onChange={event => setDocument({ ...document, actions: document.actions.map(item => item.id === action.id ? { ...item, enabled: event.target.checked } : item) })} className="peer sr-only" /><span aria-hidden="true" className="relative h-5 w-9 rounded-full bg-text-muted/30 peer-checked:bg-accent peer-focus-visible:outline-2 peer-focus-visible:outline-accent"><span className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${action.enabled ? "translate-x-4" : ""}`} /></span></label><button type="button" data-testid={`edit-action-${action.id}`} className={`${buttonClass} !h-10 !w-10 !p-0`} disabled={locked || editing} aria-label={`${th ? "แก้ไข" : "Edit"} ${action.name}`} title={th ? "แก้ไข Action" : "Edit Action"} onClick={() => openAction(action.id)}><Pencil size={16} /></button><button type="button" data-testid={`delete-action-${action.id}`} className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-text-muted hover:bg-red-400/10 hover:text-red-400 disabled:opacity-40" disabled={locked || editing} aria-label={`${th ? "ลบ" : "Delete"} ${action.name}`} title={th ? "ลบ Action" : "Delete Action"} onClick={() => removeAction(action)}><Trash2 size={16} /></button></div>
        </article>
      })}</div></>}
    </div> : <div data-reorder-list="effects" className="space-y-3"><p className="text-[12px] text-text-muted">{th ? "หนึ่งอีเวนต์เกมใช้กับหลาย Actions ได้" : "One game event can be used by several Actions."}</p>{!document.effects.length && <p className="rounded-xl border border-accent/15 bg-bg-card p-6 text-center text-[13px] text-text-muted">{th ? "เพิ่มอีเวนต์เกมเพื่อเลือกใช้ใน Actions" : "Add a game event to use in your Actions."}</p>}{document.effects.map(effect => {
      const count = document.actions.filter(action => action.effectId === effect.id).length
      return <article key={effect.id} data-default-effect={effect.id} data-reorder-id={effect.id} className={`relative flex min-w-0 flex-wrap items-center gap-3 rounded-xl border border-accent/15 bg-bg-card p-3 ${reorder.drag?.id === effect.id ? "opacity-60" : ""}`}>{marker("effects", effect.id)}{grip("effects", effect.id, effect.name)}{effect.imageUrl ? <Image src={getImageUrl(effect.imageUrl)} alt="" width={40} height={40} unoptimized className="h-10 w-10 shrink-0 rounded-lg object-contain" /> : <Gamepad2 size={24} className="shrink-0 text-text-muted" aria-hidden="true" />}<div className="min-w-0 flex-1"><h3 className="break-words text-[14px] font-medium">{effect.name}</h3><p className="mt-1 break-words text-[12px] text-text-muted">{responseSummary(effect, th)}</p><p className="mt-1 text-[11px] text-text-muted">{th ? `ใช้ใน ${count} Actions` : `Used by ${count} Actions`}</p></div><div className="ml-auto flex gap-2"><button type="button" data-testid={`edit-effect-${effect.id}`} className={`${buttonClass} !h-10 !w-10 !p-0`} disabled={locked || editing} aria-label={`${th ? "แก้ไข" : "Edit"} ${effect.name}`} onClick={() => openEffect(effect.id)}><Pencil size={16} /></button><button type="button" data-testid={`delete-effect-${effect.id}`} className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-text-muted hover:bg-red-400/10 hover:text-red-400 disabled:opacity-40" disabled={locked || editing} aria-label={`${th ? "ลบ" : "Delete"} ${effect.name}`} onClick={() => removeEffect(effect)}><Trash2 size={16} /></button></div></article>
    })}</div>}
  </div>
}
