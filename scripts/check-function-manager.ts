import assert from "node:assert/strict"
import { categoryOf, inferFunction, moveWithinCategory, normalizeName, validateFunction, validateImage, type FunctionDraft } from "../components/admin/products/function-manager-model"

assert.equal(categoryOf({ category: null }), "unclassified")
assert.equal(categoryOf({ category: "unknown" }), "unclassified")
assert.equal(categoryOf({ category: "neutral" }), "neutral")
assert.equal(normalizeName("  FULL　 Width  "), "full width")
const rows = [
  { id: "h1", category: "help", sort_order: 4, default_gift_id: 1 },
  { id: "t1", category: "troll", sort_order: 7, default_gift_id: 2 },
  { id: "h2", category: "help", sort_order: 12, default_gift_id: 3 },
  { id: "n1", category: null, sort_order: 16, default_gift_id: 4 },
]
const moved = moveWithinCategory(rows, "h2", -1)
assert.deepEqual(moved.map(row => row.id), ["h2", "t1", "h1", "n1"])
assert.deepEqual(moved.map(row => row.sort_order), [0, 1, 2, 3])
assert.equal(moved[1].default_gift_id, 2)
assert.equal(rows[0].sort_order, 4, "Reordering never mutates saved rows")
assert.deepEqual(moveWithinCategory(rows, "t1", -1), rows)
assert.deepEqual(inferFunction("01-Mob_Rain.png"), { name: "01-mob_rain", label_th: "01 Mob Rain", label_en: "01 Mob Rain" })
const form: FunctionDraft = { name: "MyCommand", label_th: "ช่วย", label_en: "Help", image_url: "/uploads/function.webp", category: "help", default_gift_id: 10, default_trigger_threshold: "30" }
const gifts = [{ id: 10, trigger_type: "Like" }, { id: 11, trigger_type: "gift" }]
assert.equal(validateFunction(form, gifts), null)
assert.equal(validateFunction({ ...form, default_trigger_threshold: "31" }, gifts), "thresholdLike")
assert.equal(validateFunction({ ...form, default_trigger_threshold: "30x" }, gifts), "thresholdInvalid")
assert.equal(validateFunction({ ...form, default_trigger_threshold: "" }, gifts), null)
assert.equal(validateFunction(form, gifts), null, "An existing key can be reused for another gift binding")
assert.equal(validateFunction(form, gifts), null)
const legacyDuplicates = [{ id: "one", name: "mycommand" }, { id: "two", name: "MyCommand" }, { id: "three", name: "Other action" }]
assert.equal(validateFunction({ ...form, category: "troll" }, gifts), null, "Existing duplicate keys remain classifiable without changing their name")
assert.equal(validateFunction({ ...form, name: "Other action" }, gifts), null, "Editing a different function to the same key is supported")
assert.equal(validateFunction({ ...form, default_gift_id: 11, default_trigger_threshold: "10001" }, gifts), "thresholdInvalid")
assert.equal(validateFunction({ ...form, default_gift_id: 11, default_trigger_threshold: "10000" }, gifts), null)
assert.equal(validateFunction({ ...form, default_gift_id: 999 }, gifts), "giftMissing")
assert.equal(validateFunction({ ...form, image_url: "javascript:alert(1)" }, gifts), "imageInvalid")
assert.equal(validateFunction({ ...form, image_url: "/../admin" }, gifts), "imageInvalid")
assert.equal(validateFunction({ ...form, image_url: "//foreign.example/icon.png" }, gifts), "imageInvalid")
assert.equal(validateFunction({ ...form, name: " " }, gifts), "nameRequired")
assert.equal(validateImage({ name: "icon.svg", type: "image/svg+xml", size: 100 }), "imageType")
assert.equal(validateImage({ name: "icon.png", type: "", size: 100 }), null)
assert.equal(validateImage({ name: "icon.png", type: "image/png", size: 6 * 1024 * 1024 }), "imageSize")
console.log("Function manager: category isolation, canonical IDs, duplicate/Like/image validation and filename staging OK")
