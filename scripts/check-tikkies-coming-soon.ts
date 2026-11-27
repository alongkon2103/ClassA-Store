import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { buildBundleCatalog } from "../lib/bundleCatalog"
import { parseLibraryRequest, readTikkiesLibrary } from "../lib/integrations/tikkiesLibrary"
import { readTikkiesGameDefaults, readTikkiesInteractiveConfig } from "../lib/integrations/tikkiesGameDefaults"
import { stableDefaultsJson } from "../lib/tikkiesGameDefaults"

const activeId = "11111111-1111-4111-8111-111111111111"
const draftId = "22222222-2222-4222-8222-222222222222"
const hiddenId = "33333333-3333-4333-8333-333333333333"
const origin = "https://aclassstore.com"
const env = { TIKKIES_GAME_CREDENTIAL_SECRET: "test-secret-".repeat(6) }
const integration = { schemaVersion: 1, mode: "api", protocol: "roblox-interactive-v1", placeIds: ["1234"], universeId: "5678" }
const defaults = { schemaVersion: 1, platform: "roblox", effects: [], actions: [] }
const storageRow = (config: unknown) => ({ config, revision: createHash("sha256").update(stableDefaultsJson(config)).digest("hex") })
const active = { id: activeId, slug: "owned-game", name_th: "Owned", name_en: "Owned", type: "roblox_whitelist", is_active: true, description_th: "", description_en: "", info_page_url: null, roblox_place_ids: [], product_images: [] }
const draft = { ...active, id: draftId, slug: "private-draft", is_active: false, info_page_url: "https://www.roblox.com/games/1234/Private?privateServerLinkCode=secret" }
const hidden = { ...draft, id: hiddenId }
const users: Record<string, { id: string; role: string; nativeStatus: string }> = {
  admin: { id: "admin", role: "admin", nativeStatus: "ACTIVE" },
  member: { id: "member", role: "user", nativeStatus: "ACTIVE" },
}
const identity = (provider: string, providerAccountId: string) => [{ provider, providerAccountId }] as Parameters<typeof readTikkiesLibrary>[5]
let savedDefaults = true
let corruptDefaults = false
let storedIntegration: unknown = integration
let includeEligibleAccounts = true
let whitelistExpiry = new Date("9999-01-01")
const order = (product_id: string, whitelisted_username: string, status = "paid") => ({ product_id, whitelisted_username, status, paid_at: new Date(), whitelist_status: "whitelisted", expires_at: null })
const purchases = [order(activeId, "Valid_Player"), order(activeId, "Refunded_Player", "refunded"), order(activeId, "Missing_Grant"), order(draftId, "Draft_Grant")]
const grants = [{ product_id: activeId, ign: "valid_player" }, { product_id: activeId, ign: "refunded_player" }, { product_id: draftId, ign: "draft_grant" }]
const db: any = {
  $transaction: async (fn: any) => fn(db),
  $queryRaw: async (sql: TemplateStringsArray) => {
    const query = sql.join("?")
    if (query.includes("FROM users")) return [users.admin]
    if (query.includes("product_tikkies_integrations")) return storedIntegration ? [storageRow(storedIntegration)] : []
    if (query.includes("product_tikkies_defaults")) return savedDefaults ? [storageRow(defaults)] : []
    throw Error("Unexpected query")
  },
  users: { findUnique: async ({ where }: any) => users[where.id] ?? null },
  accounts: { findMany: async ({ where }: any) => where.OR.flatMap((account: any) => users[account.provider_account_id] ? [{ user_id: account.provider_account_id }] : []) },
  products: {
    findMany: async ({ where }: any) => [active, draft, hidden]
      .filter(product => product.is_active === where.is_active && (typeof where.id === "string" ? product.id === where.id : !where.id?.in || where.id.in.includes(product.id)))
      .map(product => ({ ...product, product_tikkies_defaults: savedDefaults ? { ...storageRow(defaults), ...(corruptDefaults ? { revision: "0".repeat(64) } : {}) } : null })),
    findFirst: async ({ where }: any) => [active, draft, hidden].find(product => product.id === where.id),
  },
  orders: { findMany: async ({ where }: any) => (includeEligibleAccounts ? purchases : purchases.slice(-1)).filter(order => where.product_id.in.includes(order.product_id)) },
  user_whitelist_access: { findMany: async ({ where }: any) => grants.filter(grant => where.product_id.in.includes(grant.product_id)).map(grant => ({ ...grant, expires_at: whitelistExpiry })) },
  user_program_access: { findMany: async () => [] }, point_redemptions: { findMany: async () => [] },
  product_functions: { findMany: async () => [] }, product_gifts: { findMany: async ({ where }: any) => where.product_id === draftId ? [{ id: "asset", url: "/uploads/draft.png", filename: "Draft art" }] : [] },
}
const email = "admin@example.test"
const read = (identities?: Parameters<typeof readTikkiesLibrary>[5], productId?: string) => readTikkiesLibrary(db, email, new Date(), origin, productId, identities)
const privateInput = (identities?: Parameters<typeof readTikkiesLibrary>[5]) => ({ email, productId: draftId, identities })
const denied = async (identities?: Parameters<typeof readTikkiesLibrary>[5]) => {
  await assert.rejects(() => readTikkiesGameDefaults(db, privateInput(identities), origin), /game_not_owned/)
  await assert.rejects(() => readTikkiesInteractiveConfig(db, privateInput(identities), origin, env), /game_not_owned/)
}

async function main() {
  delete process.env.TIKKIES_COMING_SOON_PRODUCT_IDS
  assert.deepEqual((await read()).games.map(game => game.id), [activeId])
  process.env.TIKKIES_COMING_SOON_PRODUCT_IDS = draftId
  for (const identities of [undefined, identity("google", "member"), identity("discord", "member"), identity("google", "forged-admin")]) {
    const view = await read(identities)
    assert.deepEqual(view.games.map(game => game.id), [activeId, draftId], "Only the explicitly enabled inactive game is listed")
    const comingSoon = view.games.find(game => game.id === draftId)
    assert.ok(comingSoon)
    assert.equal((comingSoon as any).comingSoon, true)
    assert.equal(comingSoon.access, "locked")
    assert.equal(comingSoon.launch, null)
    assert.deepEqual(comingSoon.purchasedAccounts, [])
    assert.equal("integration" in comingSoon || "preview" in comingSoon || "functionDefaults" in comingSoon, false)
    assert.equal("imageAssets" in (await read(identities, draftId)).games[0], false)
    await denied(identities)
  }
  assert.throws(() => parseLibraryRequest({ email, admin: true }), /invalid_input/)
  assert.throws(() => parseLibraryRequest({ email, preview: true }), /invalid_input/)
  assert.throws(() => parseLibraryRequest({ email, robloxUsername: "Arbitrary_Player" }), /invalid_input/)
  await assert.rejects(() => read([...identity("google", "admin")!, ...identity("discord", "member")!]), /identity_conflict/)
  for (const provider of ["google", "discord"]) {
    const identities = identity(provider, "admin")
    const view = await read(identities, draftId)
    assert.equal(view.games.length, 1)
    const comingSoon = view.games[0]
    assert.equal(comingSoon.access, "locked")
    assert.equal((comingSoon as any).comingSoon, true)
    assert.equal((comingSoon as any).preview, true)
    assert.deepEqual(comingSoon.purchasedAccounts, ["Valid_Player"])
    assert.deepEqual(comingSoon.launch, { placeId: "1234", linkCode: "secret" })
    assert.deepEqual(comingSoon.integration, integration)
    assert.deepEqual((comingSoon as any).imageAssets, [{ id: "asset", url: "https://aclassstore.com/uploads/draft.png", name: "Draft art" }])
    assert.equal("imageAssets" in (await read(identities)).games.find(game => game.id === draftId)!, false)
    assert.equal((await readTikkiesGameDefaults(db, privateInput(identities), origin) as any).preview, true)
    assert.equal((await readTikkiesInteractiveConfig(db, privateInput(identities), origin, env) as any).preview, true)
    const purchased = (await read(identities, activeId)).games[0]
    assert.equal(purchased.access, "owned")
    assert.equal("comingSoon" in purchased || "preview" in purchased, false)
  }
  const admin = identity("google", "admin")
  includeEligibleAccounts = false
  assert.equal("preview" in (await read(admin, draftId)).games[0], false)
  await denied(admin)
  includeEligibleAccounts = true
  whitelistExpiry = new Date("2000-01-01")
  await denied(admin)
  whitelistExpiry = new Date("9999-01-01")
  users.admin.nativeStatus = "KICKED"
  await denied(admin)
  users.admin.nativeStatus = "ACTIVE"
  users.admin.role = "partnership"
  await denied(admin)
  users.admin.role = "admin"
  for (const candidate of [null, { schemaVersion: 1, mode: "keyboard", protocol: null, placeIds: [], universeId: null }]) {
    storedIntegration = candidate
    assert.deepEqual((await read(admin, draftId)).games, [])
  }
  storedIntegration = integration
  savedDefaults = false
  assert.deepEqual((await read(admin, draftId)).games, [])
  savedDefaults = true
  corruptDefaults = true
  assert.deepEqual((await read(admin, draftId)).games, [])
  corruptDefaults = false

  for (const file of ["app/api/Products/route.ts", "app/api/Products/StoreLive/route.ts", "app/[locale]/products/[slug]/page.tsx"]) {
    assert.match(readFileSync(file, "utf8"), /is_active:\s*true/, file + " keeps its active storefront filter")
  }
  const variant = { id: "variant", price: 100, is_active: true, duration_type: "permanent" }
  const activeSecond = { ...active, id: hiddenId, slug: "another-game" }
  const bundle = { ...active, id: "bundle", type: "bundle", product_variants: [variant], bundle_all_ac_games: true }
  assert.deepEqual(buildBundleCatalog([bundle], [active, activeSecond, draft])[0].games.map(game => game.id), [activeId, hiddenId])
  console.log("PASS opt-in coming soon, verified admin preview, shop and Bundle isolation, and active game access")
}
main().catch(error => { console.error(error); process.exitCode = 1 })
