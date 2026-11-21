import assert from "node:assert/strict"
const service = require("../lib/integrations/tikkiesGameDefaults")
assert.equal(typeof service.saveAdminGameDefaults, "function", "defaults save is one product-scoped transaction")
const gameId = "11111111-1111-4111-8111-111111111111", effectId = "22222222-2222-4222-8222-222222222222"
let stored: any = null, failWrite = false, legacyWrites = 0
const copy = (value: any) => value === null ? null : JSON.parse(JSON.stringify(value))
const db: any = {
  $transaction: async (fn: any) => { const before = copy(stored); try { return await fn(db) } catch (error) { stored = before; throw error } },
  $queryRaw: async (sql: TemplateStringsArray, id: string) => { assert.equal(id, gameId); return sql.join("?").includes("FOR UPDATE") ? [{ id }] : sql.join("?").includes("product_tikkies_integrations") ? [] : stored ? [copy(stored)] : [] },
  $executeRaw: async (_sql: TemplateStringsArray, id: string, config: string, revision: string, previous: string | null, previousRevision: string | null) => { assert.equal(id, gameId); if (failWrite) throw Error("write_failed"); stored = { config: JSON.parse(config), revision, previous_config: previous ? JSON.parse(previous) : null, previous_revision: previousRevision }; return 1 },
  products: { findFirst: async () => ({ id: gameId, type: "roblox_whitelist", program_key: null }) },
  product_functions: { findMany: async () => [], update: async () => { legacyWrites++; throw Error("legacy_write") }, deleteMany: async () => { legacyWrites++; throw Error("legacy_write") } },
  product_presets: { findMany: async () => [], updateMany: async () => { legacyWrites++; throw Error("legacy_write") } },
}
const document = { schemaVersion: 1, platform: "roblox", effects: [{ id: effectId, key: "gacha", name: "Gacha", imageUrl: null, category: "neutral", responses: [{ type: "keypress", key: "g", modifiers: [], holdMs: 50 }] }], actions: [{ id: "heart-me", effectId, name: "Gacha", enabled: true, cooldownSec: 0, trigger: { type: "gift", giftId: "7934", giftName: "Heart Me", repeatCombo: true } }] }
async function run() {
  const before = await service.readAdminGameDefaults(db, gameId, "https://aclassstore.com")
  assert.equal(before.published, false); assert.equal(before.source, "empty")
  const first = await service.saveAdminGameDefaults(db, gameId, { expectedRevision: before.revision, document }, "https://aclassstore.com")
  assert.equal(first.published, true); assert.equal(first.document.effects.length, 1); assert.notEqual(first.revision, before.revision)
  const malformed = copy(first.document); malformed.effects[0].category = ["neutral"]
  await assert.rejects(() => service.saveAdminGameDefaults(db, gameId, { expectedRevision: first.revision, document: malformed }, "https://aclassstore.com"), /invalid_defaults/)
  assert.equal(stored.revision, first.revision, "malformed enum arrays never reach the published row")
  await assert.rejects(() => service.saveAdminGameDefaults(db, gameId, { expectedRevision: before.revision, document }, "https://aclassstore.com"), /defaults_changed/)
  assert.equal((await service.readAdminGameDefaults(db, gameId, "https://aclassstore.com")).revision, first.revision)
  const next = copy(first.document); next.effects[0].name = "New Gacha"
  failWrite = true
  await assert.rejects(() => service.saveAdminGameDefaults(db, gameId, { expectedRevision: first.revision, document: next }, "https://aclassstore.com"), /write_failed/)
  failWrite = false; assert.equal((await service.readAdminGameDefaults(db, gameId, "https://aclassstore.com")).document.effects[0].name, "Gacha", "failed writes leave published defaults intact")
  const second = await service.saveAdminGameDefaults(db, gameId, { expectedRevision: first.revision, document: next }, "https://aclassstore.com")
  assert.equal(stored.previous_revision, first.revision); assert.equal(stored.previous_config.effects[0].name, "Gacha")
  await service.saveAdminGameDefaults(db, gameId, { expectedRevision: second.revision, document: next }, "https://aclassstore.com")
  assert.equal(stored.previous_revision, first.revision, "an unchanged retry must retain the real rollback snapshot")
  const preview = await service.importAdminGameDefaults(db, gameId, { preset: first.document }, "https://aclassstore.com")
  assert.equal(preview.document.effects[0].name, "Gacha"); assert.equal(stored.revision, second.revision, "imports never publish")
  assert.equal(legacyWrites, 0, "Functions/customer mappings/purchased presets are read-only compatibility data")
  assert.equal((await service.saveAdminGameDefaults(db, gameId, { expectedRevision: second.revision, document: { schemaVersion: 1, platform: "roblox", effects: [], actions: [] } }, "https://aclassstore.com")).document.actions.length, 0, "explicit empty defaults stay empty")
  console.log("PASS canonical storage: atomic save, revision conflicts, rollback, previous snapshot, preview-only imports, explicit empty and no legacy writes")
}
run().catch(error => { console.error(error); process.exitCode = 1 })
