import assert from "node:assert/strict"
import { createHash, randomBytes } from "node:crypto"
import type { Prisma } from "@prisma/client"
import { NextRequest } from "next/server"

const cdn = process.argv.includes("--cdn")
process.env.NEXT_PUBLIC_BASE_URL_IMG = cdn ? "https://images.example/assets" : ""
const { readTikkiesLibrary } = require("../lib/integrations/tikkiesLibrary")
const id = "11111111-1111-4111-8111-111111111111", imageId = "22222222-2222-4222-8222-222222222222"
const otherImageId = "33333333-3333-4333-8333-333333333333"
const now = new Date("2026-11-19T00:00:00Z"), future = new Date("2027-01-01Z")
let owned = true, kicked = false, platform = "desktop_program", imageReads = 0, productReads = 0
let rows = [
  { id: imageId, url: "/uploads/bonus.png", filename: " Bonus art.png ", sort_order: 0 },
  { id: otherImageId, url: "https://cdn.example/second.webp", filename: null, sort_order: 0 },
]
const db = {
  $queryRaw: async (query: TemplateStringsArray, ...values: unknown[]) => {
    if (query.join().includes("product_tikkies_integrations")) return []
    if (query.join().includes("INSERT")) return [values[0], values[1]].map(key_hash => ({ key_hash, count: 1, reset_at: new Date(Date.now() + 60000) }))
    assert.equal(values[0], "buyer@example.com")
    return [{ id: "customer", nativeStatus: kicked ? "KICKED" : "ACTIVE" }]
  },
  $executeRaw: async () => 0,
  products: { findMany: async (query: { where: { id?: string } }) => { productReads++; assert.ok(query.where.id === undefined || query.where.id === id); return [{ id, slug: "game", name_th: "เกม", name_en: "Game", description_th: "", description_en: "", type: platform, info_page_url: "", roblox_place_ids: [], product_images: [] }] } },
  orders: { findMany: async () => owned ? [{ product_id: id, status: "paid", paid_at: now, whitelist_status: "whitelisted", whitelisted_username: "Player_A", expires_at: future }] : [] },
  point_redemptions: { findMany: async () => [] }, user_whitelist_access: { findMany: async () => [{ product_id: id, ign: "player_a", expires_at: future }] },
  user_program_access: { findMany: async () => owned ? [{ product_id: id, status: "ACTIVE", expires_at: future }] : [] },
  product_functions: { findMany: async () => [] },
  product_gifts: { findMany: async (query: { where: { product_id: string }; take: number; orderBy: unknown }) => {
    imageReads++; assert.equal(query.where.product_id, id); assert.equal(query.take, 201)
    assert.deepEqual(query.orderBy, [{ sort_order: { sort: "asc", nulls: "last" } }, { id: "asc" }])
    return rows
  } },
  $transaction: async (fn: (tx: unknown) => unknown) => fn(db),
} as unknown as Prisma.TransactionClient
const read = (productId?: string) => readTikkiesLibrary(db, "buyer@example.com", now, "https://store.example", productId)

async function main() {
  let result = await read()
  assert.equal("imageAssets" in result.games[0], false); assert.equal(imageReads, 0, "Catalog requests never query or expose bonus images")
  result = await read(id)
  assert.deepEqual(result.games[0].imageAssets, [
    { id: imageId, name: "Bonus art.png", url: cdn ? "https://images.example/assets/uploads/bonus.png" : "https://store.example/uploads/bonus.png" },
    { id: otherImageId, name: "Image", url: "https://cdn.example/second.webp" },
  ], "Scoped owned games expose normalized assets with stable row identity and display names")
  platform = "roblox_whitelist"
  assert.equal((await read(id)).games[0].imageAssets.length, 2, "Roblox and desktop products share the image contract")
  owned = false; const before = imageReads
  assert.equal("imageAssets" in (await read(id)).games[0], false); assert.equal(imageReads, before, "Unowned games never query their bonus files")
  owned = true; kicked = true
  assert.equal("imageAssets" in (await read(id)).games[0], false); assert.equal(imageReads, before)
  kicked = false
  rows = [{ id: imageId, url: "http://unsafe.example/image.png", filename: "Unsafe", sort_order: 0 },
    { id: otherImageId, url: "https://user:secret@cdn.example/image.png", filename: "Credentials", sort_order: 1 }]
  assert.deepEqual((await read(id)).games[0].imageAssets, [], "Invalid URLs never reach the desktop")
  rows = [{ id: imageId, url: "https://cdn.example/" + "x".repeat(2048), filename: "Long", sort_order: 0 }]
  assert.deepEqual((await read(id)).games[0].imageAssets, [])
  rows = [{ id: imageId, url: "https://cdn.example/image.png", filename: "x".repeat(301), sort_order: 0 }]
  assert.equal((await read(id)).games[0].imageAssets[0].name.length, 300)
  rows = Array.from({ length: 201 }, () => rows[0])
  await assert.rejects(() => read(id), /image_capacity_exceeded/)
  rows = []
  assert.deepEqual((await read(id)).games[0].imageAssets, [])

  const token = randomBytes(48).toString("base64url")
  process.env.TIKKIES_API_KEY_SHA256 = createHash("sha256").update(token).digest("hex")
  process.env.TIKKIES_API_ENABLED = "true"
  const file = require.resolve("../lib/prisma")
  require.cache[file] = { id: file, filename: file, loaded: true, exports: { prisma: db } } as NodeModule
  const { POST } = require("../app/api/integrations/tikkies/library/route")
  const request = (credential: string | null = token, suffix = "") => new NextRequest("https://store.example/api/integrations/tikkies/library" + suffix, {
    method: "POST", headers: { "content-type": "application/json", ...(credential ? { authorization: "Bearer " + credential } : {}) }, body: JSON.stringify({ email: "buyer@example.com", productId: id }),
  })
  const count = productReads
  assert.equal((await POST(request(null))).status, 401); assert.equal(productReads, count)
  assert.equal((await POST(request(token, "?email=other@example.com"))).status, 400); assert.equal(productReads, count)
  const response = await POST(request())
  assert.equal(response.status, 200); assert.match(response.headers.get("cache-control")!, /no-store/)
  assert.deepEqual((await response.json()).games[0].imageAssets, [])
  console.log(`PASS scoped game images (${cdn ? "configured image base" : "store origin"}): ownership, both platforms, bounds, safe URLs, stable ordering and private route`)
}
main().catch(error => { console.error(error); process.exitCode = 1 })
