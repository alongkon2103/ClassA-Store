import assert from "node:assert/strict"
const service = require("../lib/integrations/tikkiesGameDefaults")
const id = "11111111-1111-4111-8111-111111111111"
let defaults: any = null, integration: any = null, failDefaults = false
const copy = (value: any) => value == null ? value : JSON.parse(JSON.stringify(value))
const db: any = {
  $transaction: async (fn: any) => { const before = [copy(defaults), copy(integration)]; try { return await fn(db) } catch (error) { [defaults, integration] = before; throw error } },
  $queryRaw: async (sql: TemplateStringsArray) => { const q = sql.join("?"); return q.includes("FOR UPDATE") ? [{ id }] : q.includes("product_tikkies_integrations") ? integration ? [copy(integration)] : [] : defaults ? [copy(defaults)] : [] },
  $executeRaw: async (sql: TemplateStringsArray, productId: string, config: string, revision: string) => { assert.equal(productId, id); const row = { config: JSON.parse(config), revision }; if (sql.join("?").includes("product_tikkies_integrations")) integration = row; else { if (failDefaults) throw Error("write_failed"); defaults = row } return 1 },
  products: { findFirst: async () => ({ id, type: "roblox_whitelist", program_key: null }) },
  product_functions: { findMany: async () => [] }, product_presets: { findMany: async () => [] },
}
const empty = { schemaVersion: 1, platform: "roblox", effects: [], actions: [] }
const api = { schemaVersion: 1, mode: "api", protocol: "roblox-interactive-v1", placeIds: ["12345"], universeId: null }
async function run() {
  const first = await service.readAdminGameDefaults(db, id, "https://aclassstore.com")
  assert.equal(first.integration?.mode, "keyboard", "new products default to Keyboard")
  const saved = await service.saveAdminGameDefaults(db, id, { expectedRevision: first.revision, expectedIntegrationRevision: first.integrationRevision, integration: api, document: empty }, "https://aclassstore.com")
  assert.equal(saved.integration.mode, "api", "API mode persists even with no Actions")
  assert.deepEqual(Object.keys(saved.document).sort(), ["actions", "effects", "platform", "schemaVersion"], "v1 envelope is unchanged")
  await assert.rejects(() => service.saveAdminGameDefaults(db, id, { expectedRevision: saved.revision, expectedIntegrationRevision: first.integrationRevision, integration: api, document: empty }, "https://aclassstore.com"), /integration_changed/)
  const oldClient = await service.saveAdminGameDefaults(db, id, { expectedRevision: saved.revision, document: empty }, "https://aclassstore.com")
  assert.deepEqual(oldClient.integration, api, "legacy saves retain connection metadata")
  const next = { ...api, universeId: "987" }, changed = { ...empty, effects: [{ id: "22222222-2222-4222-8222-222222222222", key: "Meteor", name: "Meteor", imageUrl: null, category: "neutral", responses: [{ type: "robloxEvent", event: "Meteor" }] }] }
  failDefaults = true
  await assert.rejects(() => service.saveAdminGameDefaults(db, id, { expectedRevision: saved.revision, expectedIntegrationRevision: saved.integrationRevision, integration: next, document: changed }, "https://aclassstore.com"), /write_failed/)
  failDefaults = false
  assert.deepEqual((await service.readAdminGameDefaults(db, id, "https://aclassstore.com")).integration, api, "metadata and defaults roll back together")
  console.log("PASS integration storage: independent revision, conflict, old save retention, atomic rollback and empty API")
}
run().catch(error => { console.error(error); process.exitCode = 1 })
