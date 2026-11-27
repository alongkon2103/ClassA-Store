import assert from "node:assert/strict"
import fs from "node:fs"

assert.ok(fs.existsSync("lib/giftCatalogSync.ts"), "Gift alignment needs a non-destructive reviewed plan")
const { planGiftSync, planPigDefaults } = require("../lib/giftCatalogSync")
const image = "https://cdn.example/gift.webp"
const canonical = [{ id: 5655, name: "Rose", coins: 1, image }, { id: 5487, name: "Finger Heart", coins: 5, image }, { id: 5338, name: "Unicorn Fantasy", coins: 5000, image }, { id: 6942, name: "Unicorn Fantasy", coins: 5000, image }]
const gift = (id: number, name: string, trigger_type = "Gift", is_active = true) => ({ id, name, trigger_type, is_active, diamonds: 1, image_url: image, sort_order: 0 })
const old = [gift(1, "Rose"), gift(5655, "Finger Heart"), gift(9, "Unicorn Fantasy"), gift(1203, "Like", "like"), gift(1204, "Follow", "follow")]
const plan = planGiftSync(canonical, old)
assert.equal(plan.canonicalCount, 4)
assert.equal(plan.duplicateNames.length, 1, "Different canonical IDs retain the exact same name")
assert.deepEqual(plan.referenceRemaps.map((item: { oldId: number; newId: number }) => [item.oldId, item.newId]), [[1, 5655], [5655, 5487]])
assert.deepEqual(plan.deactivateIds, [1], "Only a redundant legacy ID is archived, never a canonical ID or custom trigger")
assert.ok(plan.unresolved.some((item: { id: number }) => item.id === 9), "Ambiguous legacy names keep their original rows and references")
assert.equal(plan.blockers.length, 0)
assert.ok(!plan.giftUpserts.some((item: { id: number }) => [1203, 1204].includes(item.id)))
assert.throws(() => planGiftSync([...canonical, canonical[0]], old), /duplicate_canonical_id/)
assert.ok(planGiftSync([{ id: 1203, name: "Canonical gift", coins: 1, image }], old).blockers.some((item: { code: string }) => item.code === "custom_trigger_id_collision"))
const settled = canonical.map(row => ({ ...gift(row.id, row.name), diamonds: row.coins }))
assert.equal(planGiftSync(canonical, settled).giftUpserts.length, 0, "An aligned catalog is an idempotent no-op")
const ids = { product: "f739c2ea-c359-498f-823d-22a9e922dd0a" }
const names = ["mob purge", "giant", "freeze", "island shrinks", "mega herd", "mob rain", "shrink", "baby swarm", "island grows", "jailbreak", "caged", "gacha"]
const functions = names.map((name, index) => ({ id: "function-" + index, product_id: ids.product, name, category: null, image_url: "/uploads/original.webp", label_th: "เดิม", label_en: "Original", default_gift_id: null, default_trigger_threshold: null, sort_order: index }))
const seed = planPigDefaults(functions)
assert.equal(seed.creates.length, 0, "The existing Gacha ID and artwork are reused for Spin")
assert.equal(seed.bindings.length, 12)
assert.deepEqual(seed.bindings.map((row: { giftId: number }) => row.giftId), [5655, 5487, 8913, 5658, 5566, 6064, 19447, 9947, 5879, 5585, 13000, 7934])
assert.ok(seed.updates.every((row: { data: Record<string, unknown> }) => !["name", "label_th", "label_en", "image_url"].some(key => key in row.data)), "Seeding cannot rename functions or replace existing labels/artwork")
assert.equal(seed.blockers.length, 0)
assert.equal(planPigDefaults(functions.filter(row => row.name !== "gacha")).creates[0].name, "spin", "Create Spin only when no existing alias represents it")
const otherProduct = "other-game"
const categoryAudit = planPigDefaults([...functions,
  { ...functions[0], id: "other-up", product_id: otherProduct, name: "up2" },
  { ...functions[0], id: "other-down", product_id: otherProduct, name: "down2" },
  { ...functions[0], id: "other-signed", product_id: otherProduct, name: "9", label_en: "- 10 WIN", label_th: "-10" },
  { ...functions[0], id: "other-unknown", product_id: otherProduct, name: "Naruto" },
  { ...functions[0], id: "other-explicit", product_id: otherProduct, name: "up3", category: "troll" },
  { ...functions[0], id: "other-neutral", product_id: otherProduct, name: "up4", category: "neutral" },
])
assert.deepEqual(categoryAudit.categoryCounts.find((row: { productId: string }) => row.productId === otherProduct), { productId: otherProduct, total: 6, help: 1, troll: 3, neutral: 1, unclassified: 1 })
assert.ok(categoryAudit.updates.filter((row: { productId: string }) => row.productId === otherProduct).every((row: { data: Record<string, unknown> }) => Object.keys(row.data).every(key => key === "category")), "Other game category backfills cannot change their gift defaults")
console.log("PASS gift/seed planning: exact duplicate names, ID/FK remaps, ambiguous preservation, custom triggers, idempotency, all 12 defaults and existing Gacha preservation")
