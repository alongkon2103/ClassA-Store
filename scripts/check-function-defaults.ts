import assert from "node:assert/strict"
import type { Prisma } from "@prisma/client"
import { readTikkiesLibrary } from "../lib/integrations/tikkiesLibrary"

const productId = "f739c2ea-c359-498f-823d-22a9e922dd0a", functionId = "11111111-1111-4111-8111-111111111111"
const now = new Date("2026-11-18T00:00:00Z")
let owned = true, functionReads = 0
const rows = [{ id: functionId, name: "Future Game Action", label_th: "ชื่อ", label_en: "Action", image_url: "/uploads/action.webp", category: "help", default_gift_id: 5655, default_trigger_threshold: 1,
  default_gift: { id: 5655, name: "Rose", diamonds: 1, image_url: "https://cdn.example/rose.webp", trigger_type: "Gift" } }]
const db = {
  $queryRaw: async () => [{ id: "customer", nativeStatus: "ACTIVE" }],
  products: { findMany: async () => [{ id: productId, slug: "future-game", name_th: "เกม", name_en: "Future game", description_th: "", description_en: "", type: "desktop_program", info_page_url: "", roblox_place_ids: [], product_images: [] }] },
  orders: { findMany: async () => [] }, point_redemptions: { findMany: async () => [] },
  user_program_access: { findMany: async () => owned ? [{ product_id: productId, status: "ACTIVE", expires_at: new Date("2027-01-01Z") }] : [] },
  product_functions: { findMany: async (query: { where: { product_id: string }; take: number }) => { functionReads++; assert.equal(query.where.product_id, productId); assert.ok(query.take <= 100); return rows } },
} as unknown as Prisma.TransactionClient
async function read(product?: string) {
  const result = await readTikkiesLibrary(db, "buyer@example.com", now, "https://store.example", product) as unknown as Record<string, any>
  assert.equal("functionDefaults" in result, false, "Function defaults belong to the requested game, not the catalog envelope")
  return result.games[0]
}
async function main() {
  let result = await read(); assert.equal("functionDefaults" in result, false); assert.equal(functionReads, 0, "The all-catalog response never reads or exposes defaults")
  result = await read(productId)
  assert.ok(result.functionDefaults, "An owned explicitly requested game exposes function defaults")
  assert.equal(result.functionDefaults.schemaVersion, 1)
  assert.match(result.functionDefaults.revision, /^[0-9a-f]{64}$/)
  assert.deepEqual(result.functionDefaults.functions[0], { id: functionId, key: "Future Game Action", labelTh: "ชื่อ", labelEn: "Action", imageUrl: "https://store.example/uploads/action.webp", kind: "help", giftId: "5655", giftName: "Rose", giftCoins: 1, giftImageUrl: "https://cdn.example/rose.webp", triggerThreshold: 1 })
  const oldRevision = result.functionDefaults.revision
  assert.equal((await read(productId)).functionDefaults.revision, oldRevision, "Unchanged metadata has a stable revision")
  rows[0].default_trigger_threshold = 2
  assert.notEqual((await read(productId)).functionDefaults.revision, oldRevision, "Changed gift defaults change the revision")
  rows[0].default_trigger_threshold = 10001
  result = await read(productId)
  assert.equal(result.functionDefaults.functions[0].giftId, null, "An unsupported legacy threshold must not become a gift binding with fallback threshold 1")
  assert.equal(result.functionDefaults.functions[0].triggerThreshold, null)
  assert.equal(result.functionDefaults.functions[0].giftName, null)
  assert.equal(result.functionDefaults.functions[0].giftCoins, null)
  assert.equal(result.functionDefaults.functions[0].giftImageUrl, null)
  rows[0].default_trigger_threshold = 2
  rows[0].image_url = "javascript:alert(1)"; rows[0].default_gift.image_url = "http://unsafe.example/a"
  result = await read(productId); assert.equal(result.functionDefaults.functions[0].imageUrl, null); assert.equal(result.functionDefaults.functions[0].giftImageUrl, null)
  rows[0].default_gift.trigger_type = "Like"
  result = await read(productId); assert.equal(result.functionDefaults.functions[0].giftId, null, "Custom Like/Follow rows cannot masquerade as TikTok gift IDs")
  rows[0].name = "gacha"; rows[0].label_en = "Gacha"; rows[0].default_gift_id = 7934
  rows[0].default_gift = { id: 7934, name: "Heart Me", diamonds: 1, image_url: "https://cdn.example/heart.webp", trigger_type: "Gift" }
  rows.push({ ...rows[0], id: "22222222-2222-4222-8222-222222222222", label_en: "Gacha 2", default_gift_id: 19448,
    default_gift: { id: 19448, name: "Slow motion", diamonds: 10, image_url: "https://cdn.example/slow.webp", trigger_type: "Gift" } })
  result = await read(productId)
  assert.equal(result.functionDefaults.functions.length, 2)
  assert.ok(result.functionDefaults.functions.every((item: { key: string }) => item.key === "gacha"))
  assert.notEqual(result.functionDefaults.functions[0].id, result.functionDefaults.functions[1].id)
  assert.deepEqual(result.functionDefaults.functions.map((item: { giftId: string }) => item.giftId), ["7934", "19448"], "Same-key bindings retain their independent gifts")
  owned = false; const count = functionReads
  result = await read(productId); assert.equal("functionDefaults" in result, false); assert.equal(functionReads, count, "Locked games never query their default bindings")
  console.log("PASS requested owned-game function defaults: catalog isolation, generic keys, bounded metadata, HTTPS images, custom-trigger safety and revision changes")
}
main().catch(error => { console.error(error); process.exitCode = 1 })
