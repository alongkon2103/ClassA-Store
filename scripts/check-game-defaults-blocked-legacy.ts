import assert from "node:assert/strict"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { readAdminGameDefaults, saveAdminGameDefaults } from "../lib/integrations/tikkiesGameDefaults"
const id = "11111111-1111-4111-8111-111111111111", effect = "22222222-2222-4222-8222-222222222222"
const source = { app: "tikkies-tools", type: "actions", version: 1, actions: [{ id: "source", name: "Gacha", enabled: true, trigger: { type: "gift", giftId: "7934", giftName: "Heart Me", repeatCombo: true }, responses: [{ type: "keypress", key: "g" }] }] }
let rows: any[] = [], stored: any = null
const db: any = {
  $transaction: async (fn: any) => fn(db),
  $queryRaw: async (sql: TemplateStringsArray) => sql.join("?").includes("FOR UPDATE") ? [{ id }] : sql.join("?").includes("product_tikkies_integrations") ? [] : stored ? [stored] : [],
  $executeRaw: async (_sql: unknown, _id: string, config: string, revision: string) => { stored = { config: JSON.parse(config), revision }; return 1 },
  products: { findFirst: async () => ({ id, type: "roblox_whitelist", program_key: null }) }, product_functions: { findMany: async () => [] }, product_presets: { findMany: async () => rows },
}
async function run() {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), "aclass-blocked-defaults-")), folder = path.join(temp, "presets")
  try {
    await fs.mkdir(folder); await fs.writeFile(path.join(folder, "fallback.tikkies"), JSON.stringify(source))
    rows = [{ id: "33333333-3333-4333-8333-333333333333", filename: "missing.tikkies", url: "/uploads/presets/missing.tikkies", tikkies_bindings: { schemaVersion: 1, sourceRevision: "1".repeat(64), entries: [] } }, { id: "44444444-4444-4444-8444-444444444444", filename: "fallback.tikkies", url: "/uploads/presets/fallback.tikkies", tikkies_bindings: null }]
    const options = { uploadRoot: temp }, origin = "https://aclassstore.com"
    const blocked = await readAdminGameDefaults(db, id, origin, options)
    assert.equal(blocked.document.actions.length, 0, "an unreadable bound default never becomes a lower-priority unrelated preset")
    assert.ok(blocked.warnings.some(warning => warning.includes("preset_bindings_stale")))
    assert.match(blocked.revision, /^[a-f0-9]{64}$/)
    await fs.writeFile(path.join(folder, "unsupported.tikkies"), JSON.stringify({ ...source, actions: [{ ...source.actions[0], responses: [{ type: "webhook", url: "https://example.test" }] }] }))
    rows = [{ ...rows[1], filename: "unsupported.tikkies", url: "/uploads/presets/unsupported.tikkies" }]
    const unreadable = await readAdminGameDefaults(db, id, origin, options)
    assert.equal(unreadable.document.actions.length, 0); assert.ok(unreadable.warnings.some(warning => warning.includes("unsupported_response")))
    const replacement = { schemaVersion: 1, platform: "roblox", effects: [{ id: effect, key: "fixed", name: "Fixed", imageUrl: null, category: "neutral", responses: [{ type: "keypress", key: "g" }] }], actions: [{ id: "fixed", name: "Fixed", effectId: effect, enabled: true, cooldownSec: 0, trigger: { type: "follow" } }] }
    const published = await saveAdminGameDefaults(db, id, { expectedRevision: unreadable.revision, document: replacement }, origin, options)
    assert.equal(published.document.actions.length, 1, "blocked legacy input does not prevent an intentional valid replacement")
    console.log("PASS blocked legacy drafts: no preset fallback, revision-bearing warnings, unsupported-output recovery and intentional valid replacement")
  } finally { await fs.rm(temp, { recursive: true, force: true }) }
}
run().catch(error => { console.error(error); process.exitCode = 1 })
