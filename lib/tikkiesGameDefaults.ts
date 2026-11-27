// Product-scoped Tikkies defaults. Legacy storefront Functions stay independent.
export type GameDefaultsPlatform = "roblox" | "minecraft"
export const GAME_COMMAND_INPUTS = ["robloxUsername", "chatText"] as const
export type GameCommandInput = typeof GAME_COMMAND_INPUTS[number]
export const isGameCommandInput = (value: unknown): value is GameCommandInput => GAME_COMMAND_INPUTS.some(input => input === value)
export type GameEffect = {
  id: string
  key: string
  name: string
  imageUrl: string | null
  category: "help" | "troll" | "neutral"
  responses: Record<string, unknown>[]
}
export type GameDefaultAction = {
  id: string
  effectId: string
  name: string
  enabled: boolean
  trigger: Record<string, unknown>
  cooldownSec: number
}
export type GameDefaultsDocument = {
  schemaVersion: 1
  platform: GameDefaultsPlatform
  effects: GameEffect[]
  actions: GameDefaultAction[]
}
export type GameDefaultsView = {
  ok: true
  gameId: string
  platform: GameDefaultsPlatform
  revision: string
  published: boolean
  source: "published" | "legacy" | "empty"
  document: GameDefaultsDocument
  warnings: string[]
  presets: { id: string; filename: string }[]
  integration: import("./gameIntegration").GameIntegration
  integrationRevision: string
}

export const MINECRAFT_COMMANDS = [
  ["addmobs", "Mob Rain"], ["shrink", "Shrink"], ["growisland", "Island Grows"], ["cage", "Caged"],
  ["zombie", "Zombie Raid"], ["babyswarm", "Baby Swarm"], ["blackout", "Blackout"], ["subtime", "Time Penalty"],
  ["jailbreak", "Jailbreak"], ["removemobs", "Mob Purge"], ["giant", "Giant"], ["shrinkisland", "Island Shrinks"],
  ["golem", "Golem Ally"], ["meteor", "Mega Herd"], ["addtime", "Time Bonus"], ["freeze", "Freeze"],
  ["magnet", "Magnet"], ["lockdown", "Pen Locked"], ["purify", "Purify"], ["fly", "Fly"], ["spin", "Spin"],
].map(([key, name]) => ({ key, name }))

export const AC_MAGNET_PRODUCT_ID = "ce4eb329-7ae9-43d4-bf6a-cfde0fe3cee7"
// Compatibility export; generic API validation/editing uses published command keys.
export { MAGNET_GAME_EVENTS as ROBLOX_INTERACTIVE_EVENTS } from "./magnetGameEvents"

export class GameDefaultsError extends Error {
  constructor(public code: string, public status = 400, public field?: string) { super(code) }
}
const invalid = (field?: string): never => { throw new GameDefaultsError("invalid_defaults", 400, field) }
const unsupported = (): never => { throw new GameDefaultsError("unsupported_response") }
export const defaultsRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value))
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const actionId = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,119}$/
const integer = (value: unknown, min: number, max: number): value is number => Number.isSafeInteger(value) && (value as number) >= min && (value as number) <= max
const text = (value: unknown, max: number, empty = false): value is string => typeof value === "string" && value.length <= max && !/[\x00-\x1f\x7f]/.test(value) && (empty || !!value.trim())
const only = (value: Record<string, unknown>, fields: string[]) => { if (Object.keys(value).some(key => !fields.includes(key))) invalid() }
function safe(value: unknown, depth = 0): boolean {
  if (depth > 12) return false
  if (value === null || typeof value === "boolean") return true
  if (typeof value === "string") return value.length <= 65536
  if (typeof value === "number") return Number.isFinite(value)
  if (Array.isArray(value)) return value.length <= 1000 && value.every(item => safe(item, depth + 1))
  return defaultsRecord(value) && Object.keys(value).length <= 200 && Object.entries(Object.getOwnPropertyDescriptors(value)).every(([key, descriptor]) => !["__proto__", "constructor", "prototype"].includes(key) && "value" in descriptor && safe(descriptor.value, depth + 1))
}
function image(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null
  if (!text(value, 2048) || /[\s\\]/.test(value)) return invalid("imageUrl")
  if (value.startsWith("/uploads/") && !/[?#%]/.test(value) && !value.split("/").includes("..")) return value
  try { const url = new URL(value); if (url.protocol !== "https:" || url.username || url.password) return invalid("imageUrl"); return url.href } catch { return invalid("imageUrl") }
}

export function validateGameTrigger(value: unknown): Record<string, unknown> {
  if (!defaultsRecord(value) || !text(value.type, 30)) return invalid("trigger")
  const fields: Record<string, string[]> = { gift: ["giftId", "giftName", "minDiamonds", "minRepeat", "repeatCombo", "triggerThreshold", "waitForCombo"], chat: ["keyword", "chatMatchMode"], like: ["likeThreshold", "likeMode"], follow: [], share: [], subscribe: [], member: [], hotkey: ["accelerator"], wheelResult: ["prize"], randomWheelResult: ["prize"], topChange: [], goalReached: ["goal"] }
  if (!Object.hasOwn(fields, value.type)) return invalid("trigger.type")
  only(value, ["type", ...fields[value.type]])
  const out: Record<string, unknown> = { type: value.type }
  if (value.type === "gift") {
    if (value.giftId !== undefined && value.giftId !== null && value.giftId !== "" && value.giftId !== 0) {
      if (!["string", "number"].includes(typeof value.giftId) || typeof value.giftId === "number" && !Number.isSafeInteger(value.giftId) || !/^[1-9]\d{0,19}$/.test(String(value.giftId))) return invalid("giftId")
      out.giftId = String(value.giftId)
    }
    if (value.giftName !== undefined && !text(value.giftName, 300, true)) return invalid("giftName")
    out.giftName = value.giftName || ""
    for (const [key, min, max, fallback] of [["minDiamonds", 0, 1e9, 0], ["minRepeat", 0, 10000, 0], ["triggerThreshold", 1, 10000, 1]] as const) {
      if (value[key] !== undefined && !integer(value[key], min, max)) return invalid(key)
      out[key] = value[key] ?? fallback
    }
    for (const [key, fallback] of [["repeatCombo", true], ["waitForCombo", false]] as const) {
      if (value[key] !== undefined && typeof value[key] !== "boolean") return invalid(key)
      out[key] = value[key] ?? fallback
    }
  } else if (value.type === "like") {
    if (!integer(value.likeThreshold, 1, 1000000) || value.likeMode !== undefined && (typeof value.likeMode !== "string" || !["total", "perUser"].includes(value.likeMode))) return invalid("likeThreshold")
    out.likeThreshold = value.likeThreshold; out.likeMode = value.likeMode || "perUser"
  } else if (value.type === "chat") {
    if (value.keyword !== undefined && !text(value.keyword, 200, true) || value.chatMatchMode !== undefined && (typeof value.chatMatchMode !== "string" || !["contains", "startsWith"].includes(value.chatMatchMode))) return invalid("keyword")
    out.keyword = value.keyword || ""; out.chatMatchMode = value.chatMatchMode || "contains"
  } else if (value.type === "hotkey") {
    if (!text(value.accelerator, 100) || !/^[A-Za-z0-9+ ,.-]+$/.test(value.accelerator)) return invalid("accelerator")
    out.accelerator = value.accelerator
  } else if (value.type === "goalReached") {
    if (value.goal !== undefined && (typeof value.goal !== "string" || !["", "likes", "diamonds", "followers"].includes(value.goal))) return invalid("goal")
    if (value.goal !== undefined) out.goal = value.goal
  } else if (["wheelResult", "randomWheelResult"].includes(value.type)) {
    if (value.prize !== undefined && !text(value.prize, 300, true)) return invalid("prize")
    if (value.prize !== undefined) out.prize = value.prize
  }
  return out
}

const keys = new Set("space enter return tab escape delete up down left right insert forwarddelete home end pageup pagedown numdec nummult numadd numdiv numenter numsub minus equal bracketleft bracketright backslash semicolon quote comma period slash backquote".split(" "))
export function gameActionIdentity(action: GameDefaultAction): string {
  const trigger = { ...action.trigger }
  // Names are real fallback selectors even with an ID; only normalize as runtime does.
  if (trigger.type === "gift") { trigger.giftName = String(trigger.giftName || "").trim().replace(/\s+/g, " ").toLowerCase(); if (Number(trigger.minRepeat) <= 1) trigger.minRepeat = 0 }
  return JSON.stringify([action.effectId, Object.entries(trigger).sort(([a], [b]) => a.localeCompare(b)), action.enabled, action.cooldownSec])
}
export function gameActionsOverlap(a: GameDefaultAction, b: GameDefaultAction): boolean {
  if (a.effectId !== b.effectId || !a.enabled || !b.enabled || a.trigger.type !== "gift" || b.trigger.type !== "gift") return false
  const id = (action: GameDefaultAction) => String(action.trigger.giftId || "")
  const name = (action: GameDefaultAction) => String(action.trigger.giftName || "").trim().replace(/\s+/g, " ").toLowerCase()
  return !id(a) && !name(a) || !id(b) && !name(b) || !!id(a) && id(a) === id(b) || !!name(a) && name(a) === name(b)
}
export function validateGameResponses(value: unknown, platform: GameDefaultsPlatform): Record<string, unknown>[] {
  if (!Array.isArray(value) || !value.length || value.length > 32) return unsupported()
  return value.map(row => {
    if (!defaultsRecord(row)) return unsupported()
    if (platform === "minecraft") {
      if (row.type !== "gameEffect" || Object.keys(row).some(key => !["type", "event"].includes(key)) || !MINECRAFT_COMMANDS.some(command => command.key === row.event)) return unsupported()
      return { type: "gameEffect", event: row.event }
    }
    if (row.type === "robloxEvent") {
      if (Object.keys(row).some(key => !["type", "event", "input"].includes(key)) || typeof row.event !== "string" || !/^[A-Za-z][A-Za-z0-9_.:-]{0,79}$/.test(row.event) || Object.hasOwn(row, "input") && !isGameCommandInput(row.input)) return unsupported()
      return { type: "robloxEvent", event: row.event, ...(isGameCommandInput(row.input) ? { input: row.input } : {}) }
    }
    if (row.type === "keypress") {
      if (Object.keys(row).some(key => !["type", "key", "modifiers", "holdMs"].includes(key)) || !text(row.key, 24)) return unsupported()
      const key = row.key.trim().toLowerCase(), modifiers = row.modifiers ?? [], holdMs = row.holdMs ?? 0
      if (!/^[a-z0-9]$/.test(key) && !/^f(?:[1-9]|1[0-2])$/.test(key) && !/^num[0-9]$/.test(key) && !keys.has(key) || !Array.isArray(modifiers) || modifiers.length > 4 || !integer(holdMs, 0, 10000)) return unsupported()
      const mods: string[] = []
      for (const raw of modifiers) {
        if (!text(raw, 12)) return unsupported()
        const mod = raw.trim().toLowerCase().replace(/^control$/, "ctrl").replace(/^option$/, "alt")
        if (!["ctrl", "alt", "shift"].includes(mod)) return unsupported()
        if (!mods.includes(mod)) mods.push(mod)
      }
      return { type: "keypress", key, modifiers: ["ctrl", "alt", "shift"].filter(mod => mods.includes(mod)), holdMs }
    }
    if (row.type === "delay" && Object.keys(row).every(key => ["type", "ms"].includes(key)) && integer(row.ms, 0, 10000)) return { type: "delay", ms: row.ms }
    if (row.type === "winCounter" && Object.keys(row).every(key => ["type", "wcCmd", "wcAmount"].includes(key)) && (row.wcCmd === undefined || typeof row.wcCmd === "string" && ["add", "set", "reset"].includes(row.wcCmd)) && integer(row.wcAmount ?? 0, -1000000, 1000000)) return { type: "winCounter", wcCmd: row.wcCmd || "add", wcAmount: row.wcAmount ?? 0 }
    return unsupported()
  })
}

// Normalize property order for stable revisions and semantic duplicate detection.
export function stableDefaultsJson(value: unknown): string {
  if (Array.isArray(value)) return "[" + value.map(stableDefaultsJson).join(",") + "]"
  if (defaultsRecord(value)) return "{" + Object.keys(value).sort().map(key => JSON.stringify(key) + ":" + stableDefaultsJson(value[key])).join(",") + "}"
  return JSON.stringify(value)
}
export function defaultActionIdentity(action: GameDefaultAction): string {
  return gameActionIdentity(action)
}
export function gameEffectIdentity(effect: GameEffect): string {
  if (effect.responses.length === 1 && effect.responses[0].type === "robloxEvent") return stableDefaultsJson(["robloxEvent", effect.responses[0].event])
  const normalized = (value: string) => value.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase()
  return stableDefaultsJson([normalized(effect.key), normalized(effect.name), effect.responses])
}
export function validateGameDefaults(value: unknown, options: { allowOverlappingActions?: boolean } = {}): GameDefaultsDocument {
  if (!safe(value) || !defaultsRecord(value) || new TextEncoder().encode(JSON.stringify(value)).byteLength > 2 * 1024 * 1024) return invalid()
  only(value, ["schemaVersion", "platform", "effects", "actions"])
  if (value.schemaVersion !== 1 || typeof value.platform !== "string" || !["roblox", "minecraft"].includes(value.platform) || !Array.isArray(value.effects) || value.effects.length > 200 || !Array.isArray(value.actions) || value.actions.length > 200) return invalid()
  const platform = value.platform as GameDefaultsPlatform, ids = new Set<string>(), effectIdentities = new Set<string>(), commandInputs = new Map<string, unknown>()
  const effects: GameEffect[] = value.effects.map(row => {
    if (!defaultsRecord(row)) return invalid("effects")
    only(row, ["id", "key", "name", "imageUrl", "category", "responses"])
    if (!text(row.id, 36) || !uuid.test(row.id) || ids.has(row.id.toLowerCase()) || !text(row.key, 120) || !text(row.name, 200) || typeof row.category !== "string" || !["help", "troll", "neutral"].includes(row.category)) return invalid("effects")
    ids.add(row.id.toLowerCase())
    const effect = { id: row.id.toLowerCase(), key: row.key, name: row.name, imageUrl: image(row.imageUrl), category: row.category as GameEffect["category"], responses: validateGameResponses(row.responses, platform) }
    for (const response of effect.responses) if (response.type === "robloxEvent") {
      const command = response.event as string
      if (commandInputs.has(command) && commandInputs.get(command) !== response.input) throw new GameDefaultsError("conflicting_command_input", 400, command)
      commandInputs.set(command, response.input)
    }
    const identity = gameEffectIdentity(effect)
    if (effectIdentities.has(identity)) throw new GameDefaultsError("duplicate_effect", 400, row.id)
    effectIdentities.add(identity)
    return effect
  })
  const actionIds = new Set<string>(), matches = new Set<string>()
  const actions: GameDefaultAction[] = value.actions.map(row => {
    if (!defaultsRecord(row)) return invalid("actions")
    only(row, ["id", "effectId", "name", "enabled", "trigger", "cooldownSec"])
    if (!text(row.id, 120) || !actionId.test(row.id) || actionIds.has(row.id) || !text(row.effectId, 36) || !ids.has(row.effectId.toLowerCase()) || !text(row.name, 200, true) || typeof row.enabled !== "boolean" || typeof row.cooldownSec !== "number" || !Number.isFinite(row.cooldownSec) || row.cooldownSec < 0 || row.cooldownSec > 3600) return invalid("actions")
    actionIds.add(row.id)
    const action = { id: row.id, effectId: row.effectId.toLowerCase(), name: row.name, enabled: row.enabled, trigger: validateGameTrigger(row.trigger), cooldownSec: row.cooldownSec }
    const identity = gameActionIdentity(action)
    if (matches.has(identity)) throw new GameDefaultsError("duplicate_action", 400, row.id)
    matches.add(identity)
    return action
  })
  if (!options.allowOverlappingActions) for (let i = 0; i < actions.length; i++) for (let j = i + 1; j < actions.length; j++) if (gameActionsOverlap(actions[i], actions[j])) throw new GameDefaultsError("overlapping_action", 400, actions[j].id)
  return { schemaVersion: 1, platform, effects, actions }
}
