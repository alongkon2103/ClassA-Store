import { createHash } from "node:crypto"
import { AC_MAGNET_PRODUCT_ID, GameDefaultsError, defaultsRecord, validateGameDefaults, type GameDefaultsDocument, type GameEffect } from "./tikkiesGameDefaults"
import { MAGNET_GAME_EVENTS, type MagnetGameEvent } from "./magnetGameEvents"
type Gift = { id: number; name: string }
const giftIds: Record<string, number> = { Rose: 5655, Roses: 8913, Friendship: 9947, Donut: 5879, Bear: 5566, HeartMe: 7934, GoatBusker: 626064 }
export function magnetEffectId(key: string) {
  const digest = createHash("sha256").update(`${AC_MAGNET_PRODUCT_ID}:${key}`).digest("hex")
  return `${digest.slice(0, 8)}-${digest.slice(8, 12)}-4${digest.slice(13, 16)}-8${digest.slice(17, 20)}-${digest.slice(20, 32)}`
}
function magnetEffect(event: MagnetGameEvent): GameEffect {
  return { id: magnetEffectId(event.key), key: event.key, name: event.name, imageUrl: null, category: event.category, responses: [{ type: "robloxEvent", event: event.key }] }
}
export function createMagnetDefaults(gifts: Gift[]) {
  const effects = MAGNET_GAME_EVENTS.map(magnetEffect)
  const actions = Object.entries(giftIds).map(([event, giftId]) => {
    const gift = gifts.find(g => g.id === giftId)
    if (!gift) throw new Error(`Missing gift ${giftId}; refusing to invent a gift binding`)
    return { id: `magnet-${event.toLowerCase()}`, effectId: magnetEffectId(event), name: gift.name, enabled: true, cooldownSec: 0, trigger: { type: "gift", giftId: String(gift.id), giftName: gift.name, repeatCombo: true, waitForCombo: false, triggerThreshold: 1 } }
  })
  return validateGameDefaults({ schemaVersion: 1, platform: "roblox", effects, actions: [...actions,
    { id: "magnet-follow", effectId: magnetEffectId("Follow"), name: "Follow", enabled: true, cooldownSec: 0, trigger: { type: "follow" } },
    { id: "magnet-likes", effectId: magnetEffectId("Likes"), name: "150 Likes", enabled: true, cooldownSec: 0, trigger: { type: "like", likeThreshold: 150, likeMode: "total" } },
  ] })
}

export function reconcileMagnetGameDefaults(value: unknown) {
  if (defaultsRecord(value) && value.platform !== "roblox") throw new GameDefaultsError("platform_mismatch", 409)
  validateGameDefaults(value)
  // Validate without normalizing away optional fields in existing Actions/bindings.
  const document = JSON.parse(JSON.stringify(value)) as GameDefaultsDocument
  const ids = new Set(document.effects.map(effect => effect.id.toLowerCase()))
  const standalone = new Set<string>(), addedCommands: string[] = [], renamedCommands: string[] = []
  for (const effect of document.effects) {
    const response = effect.responses.length === 1 ? effect.responses[0] : null
    if (response?.type !== "robloxEvent" || typeof response.event !== "string") continue
    standalone.add(response.event)
    const event = MAGNET_GAME_EVENTS.find(item => item.key === response.event)
    if (event?.legacyDefaultName && effect.name === event.legacyDefaultName) { effect.name = event.name; renamedCommands.push(event.key) }
  }
  for (const event of MAGNET_GAME_EVENTS) {
    if (standalone.has(event.key)) continue
    const effect = magnetEffect(event)
    if (ids.has(effect.id)) throw new GameDefaultsError("magnet_effect_id_conflict", 409, event.key)
    document.effects.push(effect); ids.add(effect.id); addedCommands.push(event.key)
  }
  validateGameDefaults(document)
  return { document, addedCommands, renamedCommands, changed: addedCommands.length > 0 || renamedCommands.length > 0 }
}
