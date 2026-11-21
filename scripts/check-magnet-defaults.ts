import assert from "node:assert/strict"
import { validateGameDefaults, validateGameResponses } from "../lib/tikkiesGameDefaults"
import { createMagnetDefaults } from "../lib/magnetGameDefaults"
const effects = "Rose Roses Friendship Donut Bear HeartMe GoatBusker HelpGacha Follow Likes Remove Speed Range Storm Shrink WinAdd WinRemove".split(" ")
for (const event of effects) assert.deepEqual(validateGameResponses([{ type: "robloxEvent", event }], "roblox"), [{ type: "robloxEvent", event }])
for (const event of ["Unknown command", "__proto__", "Rose;http://evil.test", 123]) assert.throws(() => validateGameResponses([{ type: "robloxEvent", event }], "roblox"), /unsupported_response/)
assert.throws(() => validateGameResponses([{ type: "robloxEvent", event: "Rose", url: "https://evil.test" }], "roblox"), /unsupported_response/)
assert.throws(() => validateGameResponses([{ type: "robloxEvent", event: "Rose" }], "minecraft"), /unsupported_response/)
assert.equal(validateGameResponses([{ type: "keypress", key: "g", modifiers: [], holdMs: 0 }], "roblox")[0].key, "g")
const document = validateGameDefaults({ schemaVersion: 1, platform: "roblox", effects: effects.map((event, i) => ({ id: `00000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`, key: event, name: event, imageUrl: null, category: "neutral", responses: [{ type: "robloxEvent", event }] })), actions: [] })
assert.equal(document.effects.length, 17)
const seed = createMagnetDefaults([5655, 8913, 9947, 5879, 5566, 7934, 626064].map(id => ({ id, name: "Gift " + id })))
assert.equal(seed.actions.length, 9)
assert.deepEqual(seed.actions.find(action => action.trigger.type === "like")?.trigger, { type: "like", likeThreshold: 150, likeMode: "total" })
assert.equal(seed.actions.filter(action => action.trigger.type === "gift").every(action => action.trigger.repeatCombo && action.trigger.waitForCombo === false), true)
assert.throws(() => createMagnetDefaults([]), /Missing gift/, "Missing gift data must never produce guessed live mappings")
console.log("PASS AC Magnet defaults: seventeen preserved network events, bounded command identifiers, keyboard compatibility and Minecraft isolation")
