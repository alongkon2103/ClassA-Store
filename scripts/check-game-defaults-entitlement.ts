import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { stableDefaultsJson, validateGameDefaults } from "../lib/tikkiesGameDefaults"
import { readTikkiesGameDefaults } from "../lib/integrations/tikkiesGameDefaults"
const id = "11111111-1111-4111-8111-111111111111", effectId = "22222222-2222-4222-8222-222222222222"
let platform = "roblox_whitelist", expiry = new Date(Date.now() + 60000), access = "paid", configured = true, blocked = false
const make = () => validateGameDefaults({ schemaVersion: 1, platform: platform === "roblox_whitelist" ? "roblox" : "minecraft", effects: [{ id: effectId, key: "spin", name: "Spin", imageUrl: "/uploads/spin.png", category: "neutral", responses: platform === "roblox_whitelist" ? [{ type: "keypress", key: "g" }] : [{ type: "gameEffect", event: "spin" }] }], actions: [{ id: "gift", effectId, name: "Spin", enabled: true, cooldownSec: 0, trigger: { type: "gift", giftId: "7934", giftName: "Heart Me" } }] })
const product = () => ({ id, slug: "game", name_th: "Game", name_en: "Game", description_th: "", description_en: "", type: platform, program_key: "ac_pig_panic", info_page_url: null, roblox_place_ids: ["123"], product_images: [] })
const db: any = {
  $transaction: async (fn: any) => fn(db),
  $queryRaw: async (sql: TemplateStringsArray) => sql.join("?").includes("FROM users") ? [{ id: "buyer", nativeStatus: blocked ? "KICKED" : "ACTIVE" }] : sql.join("?").includes("product_tikkies_integrations") ? [] : configured ? [{ config: make(), revision: createHash("sha256").update(stableDefaultsJson(make())).digest("hex") }] : [],
  products: { findMany: async () => [product()], findFirst: async () => product() },
  orders: { findMany: async () => [{ product_id: id, status: access, paid_at: new Date(), whitelist_status: "whitelisted", whitelisted_username: "Viewer", expires_at: expiry }] },
  user_program_access: { findMany: async () => [{ product_id: id, status: access === "paid" ? "ACTIVE" : "REVOKED", expires_at: expiry }] },
  user_whitelist_access: { findMany: async () => [{ product_id: id, ign: "Viewer", expires_at: expiry }] },
  point_redemptions: { findMany: async () => [] }, product_functions: { findMany: async () => [] }, product_gifts: { findMany: async () => [] },
}
const read = () => readTikkiesGameDefaults(db, { email: "buyer@example.com", productId: id }, "https://aclassstore.com")
async function run() {
  const owned = await read(); assert.equal(owned.document.platform, "roblox"); assert.equal(owned.document.effects[0].imageUrl, "https://aclassstore.com/uploads/spin.png")
  configured = false; await assert.rejects(read, /defaults_not_configured/)
  expiry = new Date(0); await assert.rejects(read, /game_access_expired/, "ownership is checked before default availability")
  expiry = new Date(Date.now() + 60000); configured = true; access = "refunded"; await assert.rejects(read, /game_not_owned/)
  access = "paid"; blocked = true; await assert.rejects(read, /game_not_owned/)
  blocked = false; platform = "desktop_program"; assert.equal((await read()).document.platform, "minecraft", "owned Minecraft uses the same entitlement contract")
  access = "revoked"; await assert.rejects(read, /game_not_owned/)
  console.log("PASS canonical entitlement: owned Roblox/Minecraft, private artwork origin, unpublished404, expired/refunded/blocked/revoked denials before delivery")
}
run().catch(error => { console.error(error); process.exitCode = 1 })
