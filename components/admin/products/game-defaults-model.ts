import type { GameCommandInput, GameDefaultAction, GameEffect } from "@/lib/tikkiesGameDefaults"
import { isGameCommandInput, MINECRAFT_COMMANDS } from "@/lib/tikkiesGameDefaults"

export const buttonClass = "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-accent/20 px-3 py-2 text-[13px] font-medium transition hover:bg-accent/10 disabled:cursor-not-allowed disabled:opacity-40"
export const primaryClass = `${buttonClass} border-accent bg-accent text-white hover:bg-accent/90`
export const inputClass = "min-h-10 w-full min-w-0 rounded-lg border border-accent/20 bg-bg-base px-3 py-2 text-[13px] text-text-base outline-none focus:border-accent disabled:opacity-50"
export const copy = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T
export function newId() {
  const values = crypto.getRandomValues(new Uint8Array(16))
  values[6] = (values[6] & 15) | 64; values[8] = (values[8] & 63) | 128
  const hex = Array.from(values, value => value.toString(16).padStart(2, "0")).join("")
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}
export const newTrigger = (type: string): Record<string, unknown> => type === "gift"
  ? { type, giftId: null, giftName: "", minDiamonds: 0, minRepeat: 0, repeatCombo: true, triggerThreshold: 1, waitForCombo: false }
  : type === "like" ? { type, likeThreshold: 10, likeMode: "perUser" }
  : type === "chat" ? { type, keyword: "", chatMatchMode: "contains" } : { type }
export const triggerNames = (th: boolean): Record<string, string> => ({ gift: th ? "ของขวัญ" : "Gift", chat: th ? "แชท" : "Chat", like: th ? "ไลก์" : "Like", follow: th ? "ติดตาม" : "Follow", share: th ? "แชร์" : "Share", member: th ? "เข้าห้อง" : "Join", subscribe: th ? "สมัครสมาชิก" : "Subscribe", hotkey: th ? "ปุ่มลัด" : "Hotkey", wheelResult: th ? "ผลวงล้อ" : "Wheel result", randomWheelResult: th ? "ผลวงล้อสุ่ม" : "Random wheel result", topChange: th ? "เปลี่ยนอันดับ" : "Top change", goalReached: th ? "ครบเป้าหมาย" : "Goal reached" })
export function triggerSummary(action: GameDefaultAction, th: boolean) {
  const trigger = action.trigger, type = String(trigger.type), names = triggerNames(th)
  if (type === "gift") return `${String(trigger.giftName || (th ? "ของขวัญใดก็ได้" : "Any gift"))} × ${trigger.triggerThreshold || trigger.minRepeat || 1}`
  if (type === "like") return `${trigger.likeThreshold} ${names.like} · ${trigger.likeMode === "perUser" ? th ? "รายคน" : "per viewer" : th ? "รวมทุกคน" : "total"}`
  if (type === "chat") return `${names.chat} · ${String(trigger.keyword || (th ? "ข้อความใดก็ได้" : "any message"))}`
  return `${names[type] || type}${trigger.accelerator ? ` · ${trigger.accelerator}` : trigger.prize ? ` · ${trigger.prize}` : ""}`
}
export const gameCommandInputLabel = (input: GameCommandInput, th: boolean) => input === "robloxUsername"
  ? th ? "ชื่อผู้ใช้ Roblox จากแชท" : "Roblox username from chat"
  : th ? "ข้อความแชท" : "Chat text"

export function responseSummary(effect: GameEffect, th: boolean) {
  return effect.responses.map(step => {
    if (step.type === "keypress") return [...(Array.isArray(step.modifiers) ? step.modifiers : []), String(step.key || "?").toUpperCase()].join(" + ") + (Number(step.holdMs) ? ` (${step.holdMs} ms)` : "")
    if (step.type === "delay") return `${th ? "รอ" : "Wait"} ${step.ms} ms`
    if (step.type === "winCounter") return `${th ? "นับชนะ" : "Wins"} ${step.wcCmd || "add"} ${step.wcAmount || 0}`
    if (step.type === "gameEffect") return MINECRAFT_COMMANDS.find(command => command.key === step.event)?.name || String(step.event)
    if (step.type === "robloxEvent") return String(step.event) + (isGameCommandInput(step.input) ? ` · ${gameCommandInputLabel(step.input, th)}` : "")
    return String(step.type)
  }).join(" → ")
}
export function capturedKey(event: KeyboardEvent) {
  if (event.metaKey) return null
  if (/^Key[A-Z]$/.test(event.code)) return event.code.slice(3).toLowerCase()
  if (/^Digit\d$/.test(event.code)) return event.code.slice(5)
  if (/^Numpad\d$/.test(event.code)) return "num" + event.code.slice(6)
  const names: Record<string, string> = { Space: "space", ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right", Backspace: "delete", Delete: "forwarddelete", Enter: "enter", Tab: "tab", Home: "home", End: "end", PageUp: "pageup", PageDown: "pagedown", Insert: "insert", Minus: "minus", Equal: "equal", BracketLeft: "bracketleft", BracketRight: "bracketright", Backslash: "backslash", Semicolon: "semicolon", Quote: "quote", Comma: "comma", Period: "period", Slash: "slash", Backquote: "backquote", NumpadDecimal: "numdec", NumpadMultiply: "nummult", NumpadAdd: "numadd", NumpadDivide: "numdiv", NumpadEnter: "numenter", NumpadSubtract: "numsub" }
  return names[event.code] || (/^F(?:[1-9]|1[0-2])$/.test(event.key) ? event.key.toLowerCase() : null)
}
export function safeImage(value: string) {
  if (!value) return true
  if (value.length > 2048 || /[\s\\\u0000-\u001f]/.test(value) || value.includes("..")) return false
  if (value.startsWith("/uploads/") && !value.includes("?" ) && !value.includes("#")) return true
  try { const url = new URL(value); return url.protocol === "https:" && !url.username && !url.password } catch { return false }
}
