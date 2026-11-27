import assert from "node:assert/strict"
import fs from "node:fs"
import type { Prisma } from "@prisma/client"

assert.ok(fs.existsSync("lib/integrations/tikkiesLibrary.ts"), "Our Game needs an email-matched store library")
const { parseLibraryRequest, readTikkiesLibrary, robloxLaunch, validateProductLink } = require("../lib/integrations/tikkiesLibrary")
const now = new Date("2026-11-17T12:00:00.000Z"), future = new Date("2026-12-01Z")
const id = "11111111-1111-4111-8111-111111111111", other = "22222222-2222-4222-8222-222222222222"
const product = { id, slug: "ac-fame", name_th: "เอซี เฟม", name_en: "AC Fame", description_th: "<p>เกม</p>", description_en: "A game", type: "roblox_whitelist", info_page_url: "https://www.roblox.com/th/games/97287232901840/AC-Fame", roblox_place_ids: [], product_images: [{ url: "/uploads/fame.png" }] }
let customers = [{ id: "customer", nativeStatus: "ACTIVE" }]
let orders = [{ product_id: id, status: "paid", paid_at: now, whitelist_status: "whitelisted", whitelisted_username: "Player_A", expires_at: future },
  { product_id: other, status: "paid", paid_at: now, whitelist_status: "whitelisted", whitelisted_username: "buyer@example.com", expires_at: future }]
let grants = [{ product_id: id, ign: "player_a", expires_at: future }]
let programs = [{ product_id: other, status: "ACTIVE", expires_at: future }]
let rewards: { result: unknown }[] = []
const db = {
  $queryRaw: async (query: TemplateStringsArray, ...values: unknown[]) => { if (query.join("?").includes("product_tikkies_integrations")) return []; assert.match(query.join("?"), /lower\(btrim\(email\)\)/); assert.equal(values[0], "buyer@example.com"); return customers },
  products: { findMany: async (q: { where: { is_active: boolean } }) => { assert.equal(q.where.is_active, true); return [product, { ...product, id: other, slug: "pig-panic", name_en: "AC Pig Panic", type: "desktop_program", info_page_url: "" }] } },
  orders: { findMany: async (q: { where: { user_id: string } }) => { assert.equal(q.where.user_id, "customer"); return orders } },
  user_whitelist_access: { findMany: async () => grants }, user_program_access: { findMany: async () => programs }, point_redemptions: { findMany: async () => rewards },
} as unknown as Prisma.TransactionClient
const read = () => readTikkiesLibrary(db, " Buyer@Example.com ", now, "https://aclassstore.com")

async function main() {
  assert.deepEqual(parseLibraryRequest({ email: " Buyer@Example.com " }), { email: "buyer@example.com" })
  assert.deepEqual(parseLibraryRequest({ email: null }), { email: null })
  for (const body of [{ email: "bad" }, { email: "a@b.com", url: "roblox://x" }, { email: "a@b.com", productId: "../bad" }]) assert.throws(() => parseLibraryRequest(body))
  assert.deepEqual(robloxLaunch(product.info_page_url, []), { placeId: "97287232901840" })
  assert.deepEqual(robloxLaunch("https://www.roblox.com/games/123/Test?privateServerLinkCode=abc123", []), { placeId: "123", linkCode: "abc123" })
  assert.deepEqual(robloxLaunch(null, ["456"]), { placeId: "456" })
  for (const link of ["https://www.roblox.com.evil.test/games/123", "javascript:alert(1)", "https://www.roblox.com/share?code=secret&type=Server", "https://www.roblox.com/games/123?privateServerLinkCode=bad%26value"]) assert.equal(robloxLaunch(link, ["456"]), null, "Never fall back to another public place for a supplied unsupported link")
  assert.equal(validateProductLink(" www.roblox.com/games/123 "), "https://www.roblox.com/games/123")
  assert.throws(() => validateProductLink("file:///C:/Windows/test.exe"))
  let result = await read()
  assert.equal(result.games.length, 2)
  assert.equal(result.games[0].access, "owned", "Store ownership does not require runtime mappings or resolved Roblox IDs")
  assert.equal(result.games[0].shopUrl, "https://aclassstore.com/th/products?slug=ac-fame")
  assert.equal(result.games[0].imageUrl, "https://aclassstore.com/uploads/fame.png")
  assert.equal(result.games[1].access, "owned"); assert.equal(result.games[1].launch, null)
  assert.deepEqual(result.games[1].purchasedAccounts, [], "Program order emails are not Roblox account names")
  assert.equal(JSON.stringify(result).includes("buyer@example.com"), false)
  const durableDb={...db,accounts:{findMany:async()=>[{user_id:'customer'}]},users:{findUnique:async()=>({id:'customer',nativeStatus:'ACTIVE'})}}
  for(const provider of ['google','discord'])assert.ok((await readTikkiesLibrary(durableDb as never,'historical@example.test',now,'https://aclassstore.com',undefined,[{provider,providerAccountId:'owned-subject'}])).games.every((g:any)=>g.access==='owned'))
  customers = []; result = await read(); assert.equal(result.customerLinked, false); assert.ok(result.games.every((g: { access: string }) => g.access === "locked"))
  customers = [{ id: "customer", nativeStatus: "KICKED" }]; assert.ok((await read()).games.every((g: { access: string }) => g.access === "revoked"))
  customers = [{ id: "customer", nativeStatus: "ACTIVE" }, { id: "duplicate", nativeStatus: "ACTIVE" }]; await assert.rejects(read, /identity_conflict/)
  customers.pop()
  for (const [status, want] of [["refunded", "refunded"], ["cancelled", "revoked"], ["pending", "pending"]]) {
    orders[0].status = status; assert.equal((await read()).games[0].access, want, "A matching global whitelist cannot revive an invalid order")
  }
  orders[0].status = "paid"; grants = []; assert.equal((await read()).games[0].access, "revoked")
  grants = [{ product_id: id, ign: "PLAYER_A", expires_at: future }]
  orders[0].expires_at = new Date("2026-11-16Z"); assert.equal((await read()).games[0].access, "expired")
  rewards = [{ result: { product_id: id, ign: "player_a", expires_at: future.toISOString() } }]; assert.equal((await read()).games[0].access, "owned")
  grants[0].expires_at = new Date("2026-11-16Z"); assert.equal((await read()).games[0].access, "expired", "Rewards cannot override revoked or expired current whitelist")
  orders = []; assert.equal((await read()).games[0].access, "locked", "Global whitelist alone is never customer ownership")
  programs[0].status = "REVOKED"; assert.equal((await read()).games[1].access, "revoked")
  programs[0].status = "ACTIVE"; programs[0].expires_at = new Date("2026-11-16Z"); assert.equal((await read()).games[1].access, "expired")
  console.log("PASS Our Game store library: email isolation, catalog, links, grants, revocation, expiry, rewards and program access")
}
main().catch(error => { console.error(error); process.exitCode = 1 })
