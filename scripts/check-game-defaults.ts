import assert from "node:assert/strict"
const model = require("../lib/tikkiesGameDefaults")
assert.equal(typeof model.validateGameDefaults, "function", "canonical defaults validator is available")
const event = "11111111-1111-4111-8111-111111111111"
const other = "22222222-2222-4222-8222-222222222222"
const config = {
  schemaVersion: 1, platform: "roblox",
  effects: [{ id: event, key: "gacha", name: "Gacha", imageUrl: null, category: "neutral", responses: [{ type: "keypress", key: "g", modifiers: [], holdMs: 50 }] }],
  actions: [
    { id: "heart-me", effectId: event, name: "Gacha", enabled: true, trigger: { type: "gift", giftId: "7934", giftName: "Heart Me", repeatCombo: true }, cooldownSec: 0 },
    { id: "slow-motion", effectId: event, name: "Gacha", enabled: true, trigger: { type: "gift", giftId: "19448", giftName: "Slow motion", repeatCombo: true }, cooldownSec: 0 },
  ],
}
const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value))
const validate = (value: unknown) => model.validateGameDefaults(value)
assert.equal(validate(config).effects.length, 1, "two gifts share one logical event")
assert.equal(validate(config).actions.length, 2)
const sharedKey = copy(config)
sharedKey.effects.push({ ...sharedKey.effects[0], id: other, name: "Different logical event" })
assert.equal(validate(sharedKey).effects.length, 2, "same keyboard key does not collapse distinct events")
const duplicateEvent = copy(config); duplicateEvent.effects.push({ ...duplicateEvent.effects[0], id: other })
assert.throws(() => validate(duplicateEvent), /duplicate_effect/, "identical logical events are reused rather than duplicated")
const duplicate = copy(config); duplicate.actions.push({ ...duplicate.actions[0], id: "duplicate" })
assert.throws(() => validate(duplicate), /duplicate_action/, "exact binding copies cannot double-fire")
assert.throws(() => validate({ ...config, unexpected: true }), /invalid_defaults/)
const broken = copy(config); broken.actions[0].effectId = other
assert.throws(() => validate(broken), /invalid_defaults/)
const unsupported = copy(config); unsupported.effects[0].responses = [{ type: "webhook", url: "https://example.test" }] as any
assert.throws(() => validate(unsupported), /unsupported_response/, "imports cannot silently lose output")
const badImage = copy(config); badImage.effects[0].imageUrl = "javascript:alert(1)" as any
assert.throws(() => validate(badImage), /invalid_defaults/)
const controls = copy(config); controls.effects[0].name = "Bad\nName"
assert.throws(() => validate(controls), /invalid_defaults/)
const prototype = JSON.parse(JSON.stringify(config).replace('"schemaVersion":1', '"schemaVersion":1,"__proto__":{}'))
assert.throws(() => validate(prototype), /invalid_defaults/)
const maximum = copy(config); maximum.actions = Array.from({ length: 201 }, (_, n) => ({ ...maximum.actions[0], id: "id-" + n }))
assert.throws(() => validate(maximum), /invalid_defaults/)
for (const malformed of [
  { ...config, platform: ["roblox"] },
  { ...config, effects: [{ ...config.effects[0], category: ["neutral"] }] },
  { ...config, actions: [{ ...config.actions[0], trigger: { type: "like", likeThreshold: 10, likeMode: ["perUser"] } }] },
  { ...config, actions: [{ ...config.actions[0], trigger: { type: "chat", chatMatchMode: ["contains"] } }] },
  { ...config, actions: [{ ...config.actions[0], trigger: { type: "goalReached", goal: ["likes"] } }] },
  { ...config, effects: [{ ...config.effects[0], responses: [{ type: "winCounter", wcCmd: ["add"], wcAmount: 1 }] }] },
]) assert.throws(() => validate(malformed), /invalid_defaults|unsupported_response/, "enum arrays cannot publish an unreadable wire document")
const overlapping = copy(config); overlapping.actions.push({ ...overlapping.actions[1], id: "different-timing", trigger: { ...overlapping.actions[1].trigger, repeatCombo: false } })
assert.throws(() => validate(overlapping), /overlapping_action/, "ambiguous overlapping gift bindings cannot be published")
assert.equal(model.validateGameDefaults(overlapping, { allowOverlappingActions: true }).actions.length, 3, "a draft may retain conflicting imported originals for resolution")
const modes = copy(config); modes.actions[0].trigger = { type: "like", likeThreshold: 10, likeMode: "perUser" } as any
assert.equal(validate(modes).actions[0].trigger.likeMode, "perUser")
const waiting = copy(config); (waiting.actions[0].trigger as any).waitForCombo = true
assert.equal(validate(waiting).actions[0].trigger.waitForCombo, true)
const mc = { schemaVersion: 1, platform: "minecraft", effects: [{ ...config.effects[0], key: "spin", responses: [{ type: "gameEffect", event: "spin" }] }], actions: config.actions }
assert.equal(validate(mc).effects[0].responses[0].event, "spin")
assert.throws(() => validate({ ...mc, effects: [{ ...mc.effects[0], responses: [{ type: "gameEffect", event: "op" }] }] }), /unsupported_response/)
console.log("PASS canonical defaults: unique logical events, multiple triggers, duplicate prevention, bounds, timing, safe output and Minecraft allowlist")
