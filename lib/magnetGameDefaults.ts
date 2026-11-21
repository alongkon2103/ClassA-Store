import { createHash } from "node:crypto"
import { AC_MAGNET_PRODUCT_ID, ROBLOX_INTERACTIVE_EVENTS, validateGameDefaults } from "./tikkiesGameDefaults"
type Gift = { id: number; name: string }
const giftIds: Record<string, number> = { Rose: 5655, Roses: 8913, Friendship: 9947, Donut: 5879, Bear: 5566, HeartMe: 7934, GoatBusker: 626064 }
function id(key: string) {
  const digest = createHash("sha256").update(`${AC_MAGNET_PRODUCT_ID}:${key}`).digest("hex")
  return `${digest.slice(0, 8)}-${digest.slice(8, 12)}-4${digest.slice(13, 16)}-8${digest.slice(17, 20)}-${digest.slice(20, 32)}`
}
export function createMagnetDefaults(gifts: Gift[]) {
  const effects = ROBLOX_INTERACTIVE_EVENTS.map(event => ({ id: id(event.key), key: event.key, name: event.name, imageUrl: null, category: ["Friendship", "Remove", "Speed", "Range", "Storm", "Shrink", "HelpGacha", "WinAdd"].includes(event.key) ? "help" : ["Rose", "Roses", "Bear", "Donut", "GoatBusker", "WinRemove"].includes(event.key) ? "troll" : "neutral", responses: [{ type: "robloxEvent", event: event.key }] }))
  const actions = Object.entries(giftIds).map(([event, giftId]) => {
    const gift = gifts.find(g => g.id === giftId)
    if (!gift) throw new Error(`Missing gift ${giftId}; refusing to invent a gift binding`)
    return { id: `magnet-${event.toLowerCase()}`, effectId: id(event), name: gift.name, enabled: true, cooldownSec: 0, trigger: { type: "gift", giftId: String(gift.id), giftName: gift.name, repeatCombo: true, waitForCombo: false, triggerThreshold: 1 } }
  })
  return validateGameDefaults({ schemaVersion: 1, platform: "roblox", effects, actions: [...actions,
    { id: "magnet-follow", effectId: id("Follow"), name: "Follow", enabled: true, cooldownSec: 0, trigger: { type: "follow" } },
    { id: "magnet-likes", effectId: id("Likes"), name: "150 Likes", enabled: true, cooldownSec: 0, trigger: { type: "like", likeThreshold: 150, likeMode: "total" } },
  ] })
}
