import { TikkiesError } from "./integrations/tikkies"

export type TikkiesBindings = { schemaVersion: 1; sourceRevision: string; entries: { functionId: string; actionIndex: number }[] }
export type PresetKey = { key: string; modifiers: string[]; holdMs: number }
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const namedKeys = new Set("space enter return tab escape delete up down left right insert forwarddelete home end pageup pagedown numdec nummult numadd numdiv numenter numsub minus equal bracketleft bracketright backslash semicolon quote comma period slash backquote".split(" "))
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value)
const integer = (value: unknown, min: number, max: number): value is number => Number.isInteger(value) && (value as number) >= min && (value as number) <= max
const text = (value: unknown, max: number) => typeof value === "string" ? value.replace(/[\x00-\x1f\x7f]/g, "").trim().slice(0, max) : ""
function keypress(value: Record<string, unknown>): PresetKey | null {
  if (Object.keys(value).some(key => !["type", "key", "modifiers", "holdMs"].includes(key)) || typeof value.key !== "string" || value.key.length > 24 || /[\x00-\x1f\x7f]/.test(value.key)) return null
  const key = value.key.trim().toLowerCase(), mods = value.modifiers ?? [], holdMs = value.holdMs ?? 0
  if (!/^[a-z0-9]$/.test(key) && !/^f(?:[1-9]|1[0-2])$/.test(key) && !/^num[0-9]$/.test(key) && !namedKeys.has(key)) return null
  if (!Array.isArray(mods) || mods.length > 4 || !integer(holdMs, 0, 10000)) return null
  const modifiers: string[] = []
  for (const raw of mods) {
    if (typeof raw !== "string" || raw.length > 12 || /[\x00-\x1f\x7f]/.test(raw)) return null
    const normalized = raw.trim().toLowerCase(), modifier = normalized === "control" ? "ctrl" : normalized === "option" ? "alt" : normalized
    if (!["ctrl", "alt", "shift"].includes(modifier)) return null
    if (!modifiers.includes(modifier)) modifiers.push(modifier)
  }
  return { key, modifiers, holdMs }
}
function triggerLabel(value: unknown) {
  if (!record(value)) return "Unsupported trigger"
  if (value.type === "gift") {
    const name = text(value.giftName, 100) || "Any gift", id = /^(?:[1-9]\d{0,19})$/.test(String(value.giftId)) ? String(value.giftId) : ""
    return "Gift: " + name + (id ? " (#" + id + ")" : "")
  }
  if (value.type === "like") return "Like" + (integer(value.likeThreshold, 1, 1000000) ? " ×" + value.likeThreshold : "")
  if (value.type === "chat") return "Chat" + (text(value.keyword, 80) ? ": " + text(value.keyword, 80) : "")
  return ({ follow: "Follow", share: "Share", subscribe: "Subscribe", member: "Member" } as Record<string, string>)[String(value.type)] || "Unsupported trigger"
}
export function describePresetActions(actions: unknown[]) {
  return actions.map((raw, index) => {
    const action = record(raw) ? raw : {}, keys: PresetKey[] = []
    let supported = Array.isArray(action.responses) && action.responses.length > 0 && action.responses.length <= 32
    if (Array.isArray(action.responses)) for (const value of action.responses.slice(0, 33)) {
      if (!record(value)) { supported = false; continue }
      if (value.type === "keypress") { const key = keypress(value); if (key) keys.push(key); else supported = false }
      else if (value.type === "delay") { if (Object.keys(value).some(key => !["type", "ms"].includes(key)) || !integer(value.ms, 0, 10000)) supported = false }
      else if (value.type === "winCounter") { if (Object.keys(value).some(key => !["type", "wcCmd", "wcAmount"].includes(key)) || !["add", "set", "reset"].includes(String(value.wcCmd || "add")) || !integer(value.wcAmount ?? 0, -1000000, 1000000)) supported = false }
      else supported = false
    }
    return { index, name: text(action.name, 200) || "Action " + (index + 1), keys, supported: supported && keys.length > 0, triggerLabel: triggerLabel(action.trigger) }
  })
}
export function validateTikkiesBindings(value: unknown, sourceRevision: string, actions: unknown[], functions: { id: string }[]): TikkiesBindings {
  const fail = (): never => { throw new TikkiesError("bindings_invalid", 400) }
  if (!record(value) || Object.keys(value).some(key => !["schemaVersion", "sourceRevision", "entries"].includes(key)) || value.schemaVersion !== 1 || typeof value.sourceRevision !== "string" || !/^[a-f0-9]{64}$/.test(value.sourceRevision) || !Array.isArray(value.entries) || value.entries.length > 200) return fail()
  if (value.sourceRevision !== sourceRevision) throw new TikkiesError("bindings_stale", 409)
  const known = new Set(functions.map(row => row.id.toLowerCase())), seen = new Set<string>(), available = describePresetActions(actions)
  const entries = value.entries.map(entry => {
    if (!record(entry) || Object.keys(entry).some(key => !["functionId", "actionIndex"].includes(key)) || typeof entry.functionId !== "string" || !UUID.test(entry.functionId) || !integer(entry.actionIndex, 0, 199)) return fail()
    const functionId = entry.functionId.toLowerCase()
    if (seen.has(functionId) || !known.has(functionId) || !available[entry.actionIndex]?.supported) return fail()
    seen.add(functionId)
    return { functionId, actionIndex: entry.actionIndex }
  })
  return { schemaVersion: 1, sourceRevision, entries }
}
