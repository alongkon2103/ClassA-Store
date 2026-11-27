import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { validateGameDefaults, validateGameResponses, stableDefaultsJson } from "../lib/tikkiesGameDefaults"
import { importGameDefaults } from "../lib/integrations/tikkiesGameDefaultsImport"
import { responseSummary } from "../components/admin/products/game-defaults-model"
import { readAdminGameConnection, readTikkiesInteractiveConfig } from "../lib/integrations/tikkiesGameDefaults"

const gameId = "11111111-1111-4111-8111-111111111111"
const join = { type: "robloxEvent", event: "JoinDance", input: "robloxUsername" }
const chat = { type: "robloxEvent", event: "ChatDance", input: "chatText" }
const aura = { type: "robloxEvent", event: "DanceAura1" }
const effect = (index: number, responses: Record<string, unknown>[]) => ({ id: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`, key: `effect-${index}`, name: `Effect ${index}`, imageUrl: null, category: "neutral" as const, responses })
const document = (effects: ReturnType<typeof effect>[]) => ({ schemaVersion: 1, platform: "roblox", effects, actions: [] })
let failures = 0
async function check(name: string, run: () => void | Promise<void>) {
  try { await run(); console.log("PASS " + name) } catch (error) { failures++; console.error("FAIL " + name); console.error(error) }
}

async function run() {
  await check("typed Roblox input survives canonical normalization and round-trip", () => {
    assert.deepEqual(validateGameResponses([join, aura, chat], "roblox"), [join, aura, chat])
    assert.throws(() => validateGameDefaults(document([effect(1, [join, { ...chat, event: join.event }])])), /conflicting_command_input/)
    const normalized = validateGameDefaults(document([effect(1, [join]), effect(2, [aura]), effect(3, [chat])]))
    assert.deepEqual(normalized.effects[0].responses, [join])
    assert.deepEqual(normalized.effects[2].responses, [chat])
    assert.deepEqual(validateGameDefaults(JSON.parse(JSON.stringify(normalized))), normalized)
    assert.deepEqual(importGameDefaults({ platform: "roblox", preset: normalized }).document, normalized)
  })
  await check("input accepts only the exact enum and only on Roblox API responses", () => {
    for (const input of [null, "", "none", "RobloxUsername", "username", {}, [], true, 1]) {
      assert.throws(() => validateGameResponses([{ ...join, input }], "roblox"), /unsupported_response/)
    }
    assert.throws(() => validateGameResponses([{ ...join, extra: true }], "roblox"), /unsupported_response/)
    assert.throws(() => validateGameResponses([{ type: "keypress", key: "g", input: "robloxUsername" }], "roblox"), /unsupported_response/)
    assert.throws(() => validateGameResponses([{ type: "gameEffect", event: "spin", input: "robloxUsername" }], "minecraft"), /unsupported_response/)
  })
  await check("one command cannot have both required-input and absent-input rules anywhere in a document", () => {
    const bareJoin = { type: "robloxEvent", event: "JoinDance" }
    for (const responses of [[join, bareJoin], [bareJoin, join]]) {
      assert.throws(() => validateGameDefaults(document([effect(1, responses)])), /conflicting_command_input/)
      assert.throws(() => validateGameDefaults(document([effect(1, [responses[0], aura]), effect(2, [responses[1]])])), /conflicting_command_input/)
      assert.throws(() => validateGameDefaults(document([effect(1, [responses[0]]), effect(2, [responses[1]])])), /conflicting_command_input/)
    }
    assert.equal(validateGameDefaults(document([effect(1, [join, aura]), effect(2, [join, { type: "delay", ms: 20 }])])).effects.length, 2)
    assert.equal(validateGameDefaults(document([effect(1, [join]), effect(2, [{ type: "robloxEvent", event: "joindance" }])])).effects.length, 2, "commands remain case sensitive")
  })
  await check("canonical and legacy imports cannot hide conflicting command input rules", () => {
    const conflict = document([effect(1, [join, aura]), effect(2, [{ type: "robloxEvent", event: "JoinDance" }])])
    assert.throws(() => importGameDefaults({ platform: "roblox", preset: conflict }), /conflicting_command_input/)
    const actions = [join, { type: "robloxEvent", event: "JoinDance" }].map((response, i) => ({ id: `source-${i}`, name: `Source ${i}`, enabled: true, cooldownSec: 0, trigger: { type: "chat" }, responses: [response] }))
    assert.throws(() => importGameDefaults({ platform: "roblox", preset: actions }), /conflicting_command_input/)
    const imported = importGameDefaults({ platform: "roblox", preset: [actions[0]] })
    assert.deepEqual(imported.document.effects[0].responses, [join])
  })
  await check("legacy responses keep the exact absent-field JSON and summary", () => {
    const legacy = [{ type: "robloxEvent", event: "Rose" }]
    assert.equal(JSON.stringify(validateGameResponses(legacy, "roblox")), '[{"type":"robloxEvent","event":"Rose"}]')
    assert.equal(responseSummary(effect(1, legacy), false), "Rose")
    assert.match(responseSummary(effect(1, [join]), false), /Roblox username from chat/)
    assert.match(responseSummary(effect(1, [join]), true), /แชท/)
    assert.equal(responseSummary(effect(1, [chat]), false), "ChatDance · Chat text")
    assert.match(responseSummary(effect(1, [chat]), true), /ข้อความแชท/)
  })
  await check("private and admin config emit only nonempty product-scoped commandInputs", async () => {
    const integration = { schemaVersion: 1, mode: "api", protocol: "roblox-interactive-v1", placeIds: ["127000121986100"], universeId: "10778802249" }
    let config = document([effect(1, [join]), effect(2, [aura]), effect(3, [chat])])
    const row = (value: unknown) => ({ config: value, revision: createHash("sha256").update(stableDefaultsJson(value)).digest("hex") })
    const product = { id: gameId, slug: "test-dance", name_th: "Dance", name_en: "Dance", description_th: "", description_en: "", type: "roblox_whitelist", info_page_url: null, roblox_place_ids: [], product_images: [] }
    const db: any = {
      $transaction: async (fn: any) => fn(db),
      $queryRaw: async (sql: TemplateStringsArray) => sql.join("?").includes("FROM users") ? [{ id: "buyer", nativeStatus: "ACTIVE" }] : sql.join("?").includes("product_tikkies_integrations") ? [row(integration)] : [row(config)],
      products: { findMany: async () => [product], findFirst: async () => product },
      orders: { findMany: async () => [{ product_id: gameId, status: "paid", paid_at: new Date(), whitelist_status: "whitelisted", whitelisted_username: "Viewer", expires_at: null }] },
      user_whitelist_access: { findMany: async () => [{ product_id: gameId, ign: "Viewer", expires_at: new Date("9999-01-01") }] },
      user_program_access: { findMany: async () => [] }, point_redemptions: { findMany: async () => [] }, product_functions: { findMany: async () => [] }, product_gifts: { findMany: async () => [] }, product_presets: { findMany: async () => [] },
    }
    const env = { TIKKIES_GAME_CREDENTIAL_SECRET: "test-secret-".repeat(6) }
    const privateView = await readTikkiesInteractiveConfig(db, { email: "buyer@example.com", productId: gameId }, "https://aclassstore.com", env)
    const adminView = await readAdminGameConnection(db, gameId, "https://aclassstore.com", env)
    assert.deepEqual((privateView as any).commandInputs, { JoinDance: "robloxUsername", ChatDance: "chatText" })
    assert.deepEqual((adminView as any).commandInputs, { JoinDance: "robloxUsername", ChatDance: "chatText" })
    assert.deepEqual(privateView.commands, ["JoinDance", "DanceAura1", "ChatDance"])
    config = document([effect(1, [aura])])
    for (const view of [await readTikkiesInteractiveConfig(db, { email: "buyer@example.com", productId: gameId }, "https://aclassstore.com", env), await readAdminGameConnection(db, gameId, "https://aclassstore.com", env)]) {
      assert.equal(Object.hasOwn(view, "commandInputs"), false, "legacy/no-input products omit the field")
    }
    config = document([])
    assert.equal(Object.hasOwn(await readTikkiesInteractiveConfig(db, { email: "buyer@example.com", productId: gameId }, "https://aclassstore.com", env), "commandInputs"), false, "removed final input rule omits metadata")
  })
  if (failures) process.exitCode = 1
}
run().catch(error => { console.error(error); process.exitCode = 1 })
