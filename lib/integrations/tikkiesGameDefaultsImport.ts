import type { GameDefaultsPlatform, GameDefaultsDocument } from "../tikkiesGameDefaults"
import { createHash } from "node:crypto"
import { defaultsRecord, GameDefaultsError, gameActionIdentity, gameActionsOverlap, MINECRAFT_COMMANDS, validateGameDefaults, validateGameResponses, validateGameTrigger, type GameDefaultAction, type GameEffect } from "../tikkiesGameDefaults"
export type LegacyGameFunction = {
  id: string; key: string; labelTh?: string | null; labelEn?: string | null; imageUrl?: string | null
  kind?: string; giftId?: string | null; giftName?: string | null; triggerThreshold?: number | null
  trigger?: Record<string, unknown> | null
}
export type GameDefaultsImportInput = {
  platform: GameDefaultsPlatform; preset?: unknown; functions?: LegacyGameFunction[]
  bindings?: { entries: { functionId: string; actionIndex: number }[] } | null
}

const normalized = (value: string) => value.normalize("NFKC").toLowerCase().replace(/[\s_-]+/g, "")
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const spinAlias = (name: string) => /^(?:gacha|spin|prizespin|spinthewheel)\d*$/.test(normalized(name))
const logicalName = (name: string) => spinAlias(name) ? "spin" : normalized(name)
export function stableGameId(seed: string): string {
  const hash = createHash("sha256").update(seed).digest("hex")
  return [hash.slice(0, 8), hash.slice(8, 12), "5" + hash.slice(13, 16), "8" + hash.slice(17, 20), hash.slice(20, 32)].join("-")
}
const caption = (fn: LegacyGameFunction | undefined, fallback: string) => fn?.labelTh?.trim() || fn?.labelEn?.trim() || fallback
function command(key: string): string | undefined {
  return spinAlias(key) ? "spin" : MINECRAFT_COMMANDS.find(row => [row.key, row.name].some(name => normalized(name) === normalized(key)))?.key
}
function oldTrigger(raw: unknown): Record<string, unknown> {
  if (!defaultsRecord(raw)) throw new GameDefaultsError("invalid_defaults")
  // Old exports defaulted to total likes / a single gift action. Preserve it.
  return validateGameTrigger({ ...raw, ...(raw.type === "like" && raw.likeMode === undefined ? { likeMode: "total" } : {}), ...(raw.type === "gift" && raw.repeatCombo === undefined ? { repeatCombo: false } : {}) })
}
function bindingTrigger(fn: LegacyGameFunction, source?: Record<string, unknown>): Record<string, unknown> | null {
  // v1 Function metadata only overrode real gifts; Like/Follow pseudo-gifts
  // were not exported. Preserve the effective preset rather than reinterpret them.
  if (fn.trigger?.type === "gift") return validateGameTrigger({ ...fn.trigger, repeatCombo: source?.repeatCombo ?? true, waitForCombo: source?.waitForCombo ?? false })
  if (fn.giftId) return validateGameTrigger({ type: "gift", giftId: fn.giftId, giftName: fn.giftName || "", minDiamonds: 0, minRepeat: 1, repeatCombo: source?.type === "gift" ? source.repeatCombo === true : true, waitForCombo: source?.type === "gift" ? source.waitForCombo === true : false, triggerThreshold: fn.triggerThreshold || 1 })
  return source ? oldTrigger(source) : null
}
export function importGameDefaults(input: GameDefaultsImportInput): { document: GameDefaultsDocument; warnings: string[] } {
  const { platform } = input, warnings: string[] = [], functions = input.functions || []
  if (input.preset && defaultsRecord(input.preset) && input.preset.schemaVersion === 1 && "effects" in input.preset) {
    if (input.preset.platform !== platform) throw new GameDefaultsError("platform_mismatch")
    const document = validateGameDefaults(input.preset, { allowOverlappingActions: true })
    for (let i = 0; i < document.actions.length; i++) for (let j = i + 1; j < document.actions.length; j++) if (gameActionsOverlap(document.actions[i], document.actions[j])) warnings.push("Action ที่ต้องตรวจสอบ: " + document.actions[j].name)
    return { document, warnings }
  }
  const effects: GameEffect[] = [], actions: GameDefaultAction[] = [], identities = new Set<string>()
  let duplicates = 0
  function add(action: GameDefaultAction) {
    const identity = gameActionIdentity(action)
    if (identities.has(identity)) { duplicates++; return }
    identities.add(identity); actions.push(action)
  }
  if (platform === "minecraft" && input.preset === undefined) {
    for (const fn of functions) if (!command(fn.key)) warnings.push("อีเวนต์เดิมที่ต้องตรวจสอบ: " + fn.key)
    for (const entry of MINECRAFT_COMMANDS) {
      const matching = functions.filter(fn => command(fn.key) === entry.key), first = matching[0]
      const effect: GameEffect = { id: first && uuid.test(first.id) ? first.id.toLowerCase() : stableGameId("minecraft:" + entry.key), key: entry.key, name: caption(first, entry.name), imageUrl: first?.imageUrl || null, category: ["help", "troll"].includes(first?.kind || "") ? first!.kind as "help" | "troll" : "neutral", responses: [{ type: "gameEffect", event: entry.key }] }
      effects.push(effect)
      for (const fn of matching) {
        const trigger = bindingTrigger(fn)
        if (trigger) add({ id: "store-" + fn.id, effectId: effect.id, name: caption(fn, effect.name), enabled: true, trigger, cooldownSec: 0 })
      }
    }
    for (const fn of functions) if (!command(fn.key)) warnings.push("อีเวนต์เดิมที่ต้องตรวจสอบ: " + fn.key.slice(0, 120))
  } else {
    const preset = input.preset, source = Array.isArray(preset) ? preset : defaultsRecord(preset) && Array.isArray(preset.actions) ? preset.actions : null
    if (!source || source.length > 200) throw new GameDefaultsError("invalid_defaults")
    const entries = input.bindings?.entries || [], selected = new Set(entries.map(entry => entry.actionIndex)), sourceEffects = new Map<number, GameEffect>(), signatureEffects = new Map<string, GameEffect>()
    const fnById = new Map(functions.map(fn => [fn.id.toLowerCase(), fn]))
    const parsed = source.map((raw, index) => {
      if (!defaultsRecord(raw) || typeof raw.name !== "string") throw new GameDefaultsError("invalid_defaults")
      const responses = validateGameResponses(raw.responses, platform), trigger = oldTrigger(raw.trigger)
      const name = raw.name.trim().slice(0, 200) || "Action " + (index + 1)
      return { raw, name, responses, trigger, index }
    })
    // Explicitly shared source bindings are canonical before unmatched source rows.
    const indices = [...new Set([...entries.map(entry => entry.actionIndex), ...parsed.map(row => row.index)])]
    for (const index of indices) {
      const item = parsed[index]
      if (!item) throw new GameDefaultsError("bindings_invalid")
      const bound = entries.filter(entry => entry.actionIndex === index).map(entry => fnById.get(entry.functionId.toLowerCase()))
      if (bound.some(fn => !fn)) throw new GameDefaultsError("bindings_invalid")
      const first = bound[0] || functions.find(fn => [fn.key, fn.labelTh, fn.labelEn].some(name => name && normalized(name) === normalized(item.name)))
      const name = caption(first, item.name), signature = JSON.stringify([logicalName(first?.key || item.name), item.responses])
      let effect = signatureEffects.get(signature)
      if (!effect) {
        effect = { id: first && uuid.test(first.id) ? first.id.toLowerCase() : stableGameId("preset:" + signature), key: first?.key || item.name.slice(0, 120), name, imageUrl: first?.imageUrl || (typeof item.raw.imageUrl === "string" ? item.raw.imageUrl : null), category: ["help", "troll"].includes(first?.kind || String(item.raw.category)) ? (first?.kind || item.raw.category) as "help" | "troll" : "neutral", responses: item.responses }
        // Different source groups can reuse Function metadata; output identity stays distinct.
        if (effects.some(row => row.id === effect!.id)) effect.id = stableGameId("distinct:" + signature)
        effects.push(effect); signatureEffects.set(signature, effect)
      }
      sourceEffects.set(index, effect)
    }
    for (const entry of entries) {
      const item = parsed[entry.actionIndex], fn = fnById.get(entry.functionId.toLowerCase())!
      const trigger = bindingTrigger(fn, item.trigger)
      if (!trigger) continue
      const effect = sourceEffects.get(entry.actionIndex)!
      add({ id: "store-function-" + fn.id.toLowerCase(), effectId: effect.id, name: caption(fn, item.name), enabled: item.raw.enabled !== false, trigger, cooldownSec: typeof item.raw.cooldownSec === "number" ? item.raw.cooldownSec : 0 })
    }
    for (const item of parsed) if (!selected.has(item.index)) {
      const rawId = item.raw.id, id = typeof rawId === "string" && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,119}$/.test(rawId) ? rawId : "source-" + stableGameId(JSON.stringify([item.index, item.name, item.trigger, item.responses]))
      add({ id, effectId: sourceEffects.get(item.index)!.id, name: item.name, enabled: item.raw.enabled !== false, trigger: item.trigger, cooldownSec: typeof item.raw.cooldownSec === "number" ? item.raw.cooldownSec : 0 })
    }
  }
  if (duplicates) warnings.push("รวมรายการซ้ำ " + duplicates + " รายการแล้ว")
  const document = validateGameDefaults({ schemaVersion: 1, platform, effects, actions }, { allowOverlappingActions: true })
  for (let i = 0; i < actions.length; i++) for (let j = i + 1; j < actions.length; j++) if (gameActionsOverlap(actions[i], actions[j])) warnings.push("Action ที่ต้องตรวจสอบ: " + actions[j].name)
  return { document, warnings }
}
