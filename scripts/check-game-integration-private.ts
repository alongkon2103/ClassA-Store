import assert from "node:assert/strict"
import { createHash, createHmac } from "node:crypto"
import { stableDefaultsJson } from "../lib/tikkiesGameDefaults"
const service = require("../lib/integrations/tikkiesGameDefaults")
const libraryService = require("../lib/integrations/tikkiesLibrary")
assert.equal(typeof service.readTikkiesInteractiveConfig, "function", "entitled private config must be available")
const id = "11111111-1111-4111-8111-111111111111", secret = "test-host-secret-".repeat(4)
const integration = { schemaVersion: 1, mode: "api", protocol: "roblox-interactive-v1", placeIds: ["12345"], universeId: "6789" }
const document = { schemaVersion: 1, platform: "roblox", effects: [{ id: "22222222-2222-4222-8222-222222222222", key: "Meteor", name: "Meteor", imageUrl: null, category: "neutral", responses: [{ type: "robloxEvent", event: "Meteor.Fall" }] }], actions: [] }
const row = (config: any) => ({ config, revision: createHash("sha256").update(stableDefaultsJson(config)).digest("hex") })
let status = "paid", empty = false, configured = true
let storedIntegration: any = integration
const product = { id, slug: "second", name_th: "Second", name_en: "Second", description_th: "", description_en: "", type: "roblox_whitelist", info_page_url: null as string | null, roblox_place_ids: [], product_images: [] }
const db: any = {
  $transaction: async (fn: any) => fn(db),
  $queryRaw: async (sql: TemplateStringsArray) => sql.join("?").includes("FROM users") ? [{ id: "buyer", nativeStatus: "ACTIVE" }] : sql.join("?").includes("product_tikkies_integrations") ? [row(storedIntegration)] : configured ? [row(empty ? { ...document, effects: [] } : document)] : [],
  products: { findMany: async () => [product], findFirst: async () => product },
  orders: { findMany: async () => [{ product_id: id, status, paid_at: new Date(), whitelist_status: "whitelisted", whitelisted_username: "Viewer", expires_at: null }] },
  user_whitelist_access: { findMany: async () => [{ product_id: id, ign: "Viewer", expires_at: new Date("9999-01-01") }] },
  user_program_access: { findMany: async () => [] }, point_redemptions: { findMany: async () => [] }, product_functions: { findMany: async () => [] }, product_gifts: { findMany: async () => [] },
}
async function run() {
  const env = { TIKKIES_GAME_CREDENTIAL_SECRET: secret }
  const result = await service.readTikkiesInteractiveConfig(db, { email: "buyer@example.com", productId: id }, "https://aclassstore.com", env)
  assert.deepEqual(result.integration, integration); assert.deepEqual(result.commands, ["Meteor.Fall"])
  const credential = createHmac("sha256", secret).update("tikkies:game:" + id).digest("base64url")
  assert.equal(result.credentialHash, createHash("sha256").update(credential).digest("hex"))
  const credentialService = require("../lib/integrations/gameIntegrationStorage")
  assert.notEqual(credentialService.gameMapCredentialHash("33333333-3333-4333-8333-333333333333", env), result.credentialHash, "another product cannot reuse the map credential")
  assert.equal(credentialService.gameMapCredential("ABCDEFAB-1111-4111-8111-111111111111", env), credentialService.gameMapCredential("abcdefab-1111-4111-8111-111111111111", env), "UUID spelling does not rotate a product credential")
  assert.equal(credentialService.gameMapCredentialHash("CE4EB329-7AE9-43D4-BF6A-CFDE0FE3CEE7", {}), null, "legacy Magnet uses its existing receiver key")
  const publicView = await libraryService.readTikkiesLibrary(db, "buyer@example.com", new Date(), "https://aclassstore.com")
  assert.deepEqual(publicView.games[0].integration, integration)
  assert.deepEqual(publicView.games[0].launch, { placeId: "12345" }, "a new API product launches using connection settings alone")
  product.info_page_url = "https://www.roblox.com/games/12345/Test?privateServerLinkCode=allowed&launchData=hello"
  assert.deepEqual((await libraryService.readTikkiesLibrary(db, "buyer@example.com", new Date(), "https://aclassstore.com")).games[0].launch, { placeId: "12345", linkCode: "allowed", launchData: "hello" }, "allowed legacy launch details survive")
  product.info_page_url = "https://www.roblox.com/games/999/Test?privateServerLinkCode=outside"
  assert.deepEqual((await libraryService.readTikkiesLibrary(db, "buyer@example.com", new Date(), "https://aclassstore.com")).games[0].launch, { placeId: "12345" }, "out-of-scope legacy launch details cannot select another game")
  storedIntegration = { schemaVersion: 1, mode: "keyboard", protocol: null, placeIds: [], universeId: null }
  assert.deepEqual((await libraryService.readTikkiesLibrary(db, "buyer@example.com", new Date(), "https://aclassstore.com")).games[0].launch, { placeId: "999", linkCode: "outside" }, "Keyboard retains its legacy launch source")
  storedIntegration = integration
  assert.equal(JSON.stringify(publicView).includes(result.credentialHash), false)
  assert.equal(JSON.stringify(publicView).includes(credential), false)
  empty = true
  assert.deepEqual((await service.readTikkiesInteractiveConfig(db, { email: "buyer@example.com", productId: id }, "https://aclassstore.com", env)).commands, [], "published removal of final command retains private identity for paid replay")
  empty = false
  configured = false
  await assert.rejects(() => service.readTikkiesInteractiveConfig(db, { email: "buyer@example.com", productId: id }, "https://aclassstore.com", env), (error: any) => error.code === "defaults_not_configured" && error.status === 409, "unpublished API is unavailable for binding")
  configured = true
  status = "refunded"
  await assert.rejects(() => service.readTikkiesInteractiveConfig(db, { email: "buyer@example.com", productId: id }, "https://aclassstore.com", env), /game_not_owned/)
  const denied = await libraryService.readTikkiesLibrary(db, "buyer@example.com", new Date(), "https://aclassstore.com")
  assert.equal(denied.games[0].integration, undefined, "metadata delivery is entitlement scoped")
  assert.equal(denied.games[0].launch, null, "locked API products never expose a launch")
  console.log("PASS private projection: current entitlement, HMAC product credential, exact allowlist and no public secrets")
}
run().catch(error => { console.error(error); process.exitCode = 1 })
