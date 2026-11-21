import assert from "node:assert/strict"
import { validateGameDefaults, validateGameResponses } from "../lib/tikkiesGameDefaults"
// A second product's published event is executable input, never a global catalog entry.
assert.deepEqual(validateGameResponses([{ type: "robloxEvent", event: "Meteor.Fall:v2" }], "roblox"), [{ type: "robloxEvent", event: "Meteor.Fall:v2" }])
const integration = require("../lib/gameIntegration")
const api = { schemaVersion: 1, mode: "api", protocol: "roblox-interactive-v1", placeIds: ["123456"], universeId: "98765" }
assert.deepEqual(integration.validateGameIntegration(api), api)
for (const event of ["", "1Meteor", "x y", "x;url", "A".repeat(81), "__proto__", 123]) assert.throws(() => validateGameResponses([{ type: "robloxEvent", event }], "roblox"), /unsupported_response/)
assert.equal(validateGameResponses([{ type: "robloxEvent", event: "rose" }], "roblox")[0].event, "rose", "spelling is case-sensitive")
assert.throws(() => integration.validateGameIntegration({ ...api, credentialHash: "secret" }), /invalid_integration/)
assert.throws(() => integration.validateGameIntegration({ ...api, placeIds: [] }), /invalid_integration/)
assert.throws(() => integration.validateGameIntegration({ ...api, universeId: "https://bad" }), /invalid_integration/)
assert.deepEqual(integration.defaultGameIntegration("11111111-1111-4111-8111-111111111111"), { schemaVersion: 1, mode: "keyboard", protocol: null, placeIds: [], universeId: null })
assert.equal(integration.defaultGameIntegration("ce4eb329-7ae9-43d4-bf6a-cfde0fe3cee7").mode, "api")
assert.deepEqual(integration.publishedGameCommands({ effects: [{ responses: [{ type: "robloxEvent", event: "Meteor.Fall:v2" }, { type: "robloxEvent", event: "rose" }, { type: "robloxEvent", event: "rose" }] }] }), ["Meteor.Fall:v2", "rose"])
assert.equal(typeof integration.validateGameIntegrationResponses, "function", "transport changes cannot reinterpret existing effects")
assert.throws(() => integration.validateGameIntegrationResponses(api, { platform: "roblox", effects: [{ responses: [{ type: "keypress", key: "g" }] }] }), /integration_response_mismatch/)
assert.throws(() => integration.validateGameIntegrationResponses({ mode: "keyboard" }, { platform: "roblox", effects: [{ responses: [{ type: "robloxEvent", event: "Meteor" }] }] }), /integration_response_mismatch/)
const event = { id: "11111111-1111-4111-8111-111111111111", key: "Meteor", name: "Meteor", imageUrl: null, category: "neutral", responses: [{ type: "robloxEvent", event: "Meteor" }] }
assert.throws(() => validateGameDefaults({ schemaVersion: 1, platform: "roblox", effects: [event, { ...event, id: "22222222-2222-4222-8222-222222222222", key: "Other label", name: "Other label" }], actions: [] }), /duplicate_effect/, "one API command is a reusable event even when labels differ")
assert.equal(validateGameDefaults({ schemaVersion: 1, platform: "roblox", effects: [event, { ...event, id: "22222222-2222-4222-8222-222222222222", key: "meteor", name: "Lowercase", responses: [{ type: "robloxEvent", event: "meteor" }] }], actions: [] }).effects.length, 2, "case-sensitive commands remain distinct")
function commandDocument(count: number) {
  const responses = Array.from({ length: count }, (_, i) => ({ type: "robloxEvent", event: `Command${i + 1}` }))
  return validateGameDefaults({ schemaVersion: 1, platform: "roblox", effects: Array.from({ length: Math.ceil(count / 32) }, (_, i) => ({ ...event, id: `00000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`, key: `batch-${i}`, name: `Batch ${i}`, responses: responses.slice(i * 32, (i + 1) * 32) })), actions: [] })
}
integration.validateGameIntegrationResponses(api, commandDocument(200))
assert.throws(() => integration.validateGameIntegrationResponses(api, commandDocument(201)), /game_commands_capacity_exceeded/, "multi-step API events cannot publish more than200 unique commands")
const repeats = commandDocument(200); repeats.effects.at(-1)!.responses.push({ type: "robloxEvent", event: "Command1" })
integration.validateGameIntegrationResponses(api, repeats)
console.log("PASS game integration: custom case-sensitive command, bounded identity, safe projection and legacy default")
