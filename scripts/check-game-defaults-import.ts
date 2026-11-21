import assert from "node:assert/strict"
const { importGameDefaults } = require("../lib/integrations/tikkiesGameDefaultsImport")
assert.equal(typeof importGameDefaults, "function", "legacy import produces canonical game defaults")
const first = "11111111-1111-4111-8111-111111111111", second = "22222222-2222-4222-8222-222222222222"
const raw = (name: string, giftId: number, id: string) => ({ id, name, enabled: true, cooldownSec: 0, trigger: { type: "gift", giftId, giftName: ({ 7934: "Heart Me", 19448: "Slow motion" } as Record<number, string>)[giftId] || String(giftId), repeatCombo: true }, responses: [{ type: "keypress", key: "g", modifiers: [], holdMs: 0 }] })
const input = { platform: "roblox", preset: { app: "tikkies-tools", type: "actions", version: 1, actions: [raw("Gacha", 7934, "source-one"), raw("Gacha 2", 19448, "source-two")] },
  functions: [{ id: first, key: "gacha", labelEn: "Gacha", kind: "neutral", giftId: "7934", giftName: "Heart Me", triggerThreshold: 1 }, { id: second, key: "gacha", labelEn: "Gacha 2", kind: "neutral", giftId: "19448", giftName: "Slow motion", triggerThreshold: 1 }],
  bindings: { entries: [{ functionId: first, actionIndex: 0 }, { functionId: second, actionIndex: 0 }] } }
const result = importGameDefaults(input)
assert.equal(result.document.effects.length, 1, "shared Gacha output is one picker event")
assert.equal(result.document.actions.length, 2, "retained source gift cannot double fire with a Function binding")
assert.equal(result.document.actions[0].id, "store-function-" + first, "stable legacy row identity is retained")
assert.ok(result.warnings.length > 0, "duplicate source removal is reported")
assert.deepEqual(importGameDefaults(input), result, "migration is deterministic and repeatable")
const ambiguous = JSON.parse(JSON.stringify(input)); delete ambiguous.preset.actions[1].trigger.repeatCombo
const review = importGameDefaults(ambiguous)
assert.equal(review.document.actions.length, 3, "different repetition behavior remains available for explicit resolution")
assert.ok(review.warnings.some((warning: string) => warning.includes("ต้องตรวจสอบ")), "overlap blocks automatic publication")
assert.throws(() => require("../lib/tikkiesGameDefaults").validateGameDefaults(review.document), /overlapping_action/)
const distinct = importGameDefaults({ platform: "roblox", preset: [raw("Rui", 5655, "one"), raw("Doma", 8913, "two")] })
assert.equal(distinct.document.effects.length, 2, "unrelated same-key events stay distinct")
const oldFollow = importGameDefaults({ platform: "roblox", preset: [{ ...raw("Follow", 5655, "welcome"), trigger: { type: "follow" } }], functions: [{ id: first, key: "follow", trigger: { type: "like", likeThreshold: 15 } }], bindings: { entries: [{ functionId: first, actionIndex: 0 }] } })
assert.equal(oldFollow.document.actions[0].trigger.type, "follow", "unsupported old pseudo-gift defaults do not replace the effective preset trigger")
const named = [raw("Wheel", 5655, "named-rose"), raw("Wheel", 8913, "named-lion")].map((row, index) => ({ ...row, trigger: { type: "gift", giftName: index ? "Lion" : "Rose", repeatCombo: true } }))
assert.equal(importGameDefaults({ platform: "roblox", preset: named }).document.actions.length, 2, "name-only gift selectors must not be merged")
const bad = raw("Bad", 5655, "bad"); bad.responses = [{ type: "webhook", url: "https://example.test" }] as any
assert.throws(() => importGameDefaults({ platform: "roblox", preset: [bad] }), /unsupported_response/)
const mc = importGameDefaults({ platform: "minecraft", functions: [{ id: first, key: "gacha", giftId: "7934", giftName: "Heart Me" }, { id: second, key: "Gacha 2", giftId: "19448", giftName: "Slow motion" }] })
assert.equal(mc.document.effects.filter((effect: any) => effect.key === "spin").length, 1)
assert.equal(mc.document.actions.length, 2)
assert.deepEqual(importGameDefaults({ platform: "minecraft", preset: mc.document }).document, mc.document, "canonical exports round-trip")
const wrong = { ...mc.document, platform: "roblox" }
assert.throws(() => importGameDefaults({ platform: "minecraft", preset: wrong }), /platform_mismatch/)
console.log("PASS canonical imports: shared bindings, exact duplicate removal, stable identities, distinct same-key effects, unsupported outputs and Minecraft export round-trip")
