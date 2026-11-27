import assert from "node:assert/strict"
import fs from "node:fs"
import type { PrismaClient } from "@prisma/client"

assert.ok(fs.existsSync("lib/productFunctions.ts"), "Product functions need shared category, validation and atomic scoped writes")
const { inferFunctionCategory, normalizedFunctionName, parseFunctionInput, parseBulkFunctions, createFunctions, patchFunction, reorderFunctions } = require("../lib/productFunctions")
const productId = "11111111-1111-4111-8111-111111111111", foreign = "22222222-2222-4222-8222-222222222222"
const fid = "33333333-3333-4333-8333-333333333333", foreignFid = "44444444-4444-4444-8444-444444444444"
type Row = Record<string, unknown> & { id: string; product_id: string; name: string }
let rows: Row[] = [{ id: fid, product_id: productId, name: "Legacy action", category: "neutral", label_th: "เดิม", image_url: "/uploads/original.webp", default_gift_id: 5655, default_trigger_threshold: 1, sort_order: 0 }, { id: foreignFid, product_id: foreign, name: "Other", category: "troll", sort_order: 0 }]
let txActive = false, failAt = 0, writes = 0
const gifts = [{ id: 5655, trigger_type: "gift" }, { id: 1203, trigger_type: "like" }]
const db = {
  $queryRaw: async (_parts: TemplateStringsArray, id: string) => { assert.ok(txActive, "Product scope is locked within the write transaction"); return id === productId ? [{ id }] : [] },
  product_functions: {
    findMany: async ({ where }: { where: { product_id: string } }) => rows.filter(row => row.product_id === where.product_id),
    findFirst: async ({ where }: { where: { id: string; product_id: string } }) => rows.find(row => row.id === where.id && row.product_id === where.product_id) || null,
    create: async ({ data }: { data: Row }) => { if (++writes === failAt) throw Error("fixture_write_failed"); const row = { ...data, id: "new-" + writes }; rows.push(row); return row },
    update: async ({ where, data }: { where: { id: string }; data: Partial<Row> }) => { const row = rows.find(row => row.id === where.id)!; Object.assign(row, data); return row },
  },
  gifts: { findMany: async () => gifts },
  $transaction: async (fn: (tx: unknown) => Promise<unknown>) => { const before = structuredClone(rows); txActive = true; try { return await fn(db) } catch (error) { rows = before; throw error } finally { txActive = false } },
} as unknown as PrismaClient

async function main() {
  for (const [name, category] of [["Mob Purge", "help"], ["removemobs", "help"], ["mega herd", "help"], ["addmobs", "troll"], ["BLACK OUT", "troll"], ["Gacha", "neutral"], ["Future Unrelated Game Action", "neutral"]]) assert.equal(inferFunctionCategory(name), category)
  assert.equal(normalizedFunctionName(" Ｍｏｂ  Rain "), "mob rain")
  const good = { name: "Custom action", category: "help", label_th: "ชื่อ", label_en: null, image_url: "/uploads/a.webp", default_gift_id: 5655, default_trigger_threshold: 1 }
  assert.equal(parseFunctionInput({ name: "Giant" }).category, "help")
  assert.equal(parseFunctionInput(good).image_url, "/uploads/a.webp")
  assert.throws(() => parseFunctionInput({ name: "Too many gifts", default_trigger_threshold: 10001 }), /invalid_input/)
  assert.equal(parseFunctionInput({ name: "Boundary", default_gift_id: 2147483647, default_trigger_threshold: 10000 }).default_gift_id, 2147483647, "Gift IDs keep their independent Int32 bound")
  for (const image_url of ["//evil.example/x", "/../admin", "/back\\slash", "bare-filename.webp"]) assert.throws(() => parseFunctionInput({ name: "x", image_url }), "Only explicit HTTPS or safe root-relative image paths are accepted")
  for (const bad of [null, [], {}, { name: " " }, { name: "x", category: "admin" }, { name: "x", category: null }, { name: "x", image_url: "javascript:alert(1)" }, { name: "x", default_gift_id: "5655" }, { name: "x", default_trigger_threshold: 0 }, { name: "x", arbitrary: true }, { name: "x".repeat(121) }]) assert.throws(() => parseFunctionInput(bad))
  assert.deepEqual(parseFunctionInput({ category: "troll" }, true), { category: "troll" }, "PATCH must preserve omitted legacy fields")
  assert.throws(() => parseBulkFunctions({ items: Array(101).fill(good) }))
  assert.equal(parseBulkFunctions({ items: [{ name: "gacha", label_en: "Gacha" }, { name: "gacha", label_en: "Gacha 2" }] }).length, 2, "Bulk rows may reuse a command key")
  const created = await createFunctions(db, productId, parseBulkFunctions({ items: [good, { name: "Mob Rain" }] }))
  assert.equal(created.length, 2); assert.equal(created[1].category, "troll")
  const repeated = await createFunctions(db, productId, parseBulkFunctions({ items: [{ ...good, label_en: "Second button", default_trigger_threshold: 2 }] }))
  assert.notEqual(repeated[0].id, created[0].id); assert.equal(repeated[0].name, created[0].name)
  assert.equal(created[0].default_trigger_threshold, 1, "Reusing a key never modifies an earlier binding")
  const count = rows.length
  failAt = writes + 2
  await assert.rejects(createFunctions(db, productId, parseBulkFunctions({ items: [{ name: "Atomic one" }, { name: "Atomic two" }] })), /fixture_write_failed/)
  assert.equal(rows.length, count, "A later write failure rolls back the entire bulk")
  failAt = 0
  await assert.rejects(createFunctions(db, productId, parseBulkFunctions({ items: [{ name: "Bad Like", default_gift_id: 1203, default_trigger_threshold: 1 }] })), /invalid_input/)
  await assert.rejects(createFunctions(db, productId, parseBulkFunctions({ items: [{ name: "Missing gift", default_gift_id: 999999 }] })), /gift_not_found/)
  await assert.rejects(patchFunction(db, productId, foreignFid, { category: "help" }), /function_not_found/)
  const patched = await patchFunction(db, productId, fid, parseFunctionInput({ category: "help" }, true))
  assert.equal(patched.label_th, "เดิม"); assert.equal(patched.image_url, "/uploads/original.webp"); assert.equal(patched.default_gift_id, 5655)
  rows.push({ ...rows.find(row => row.id === fid)!, id: "66666666-6666-4666-8666-666666666666", category: null })
  const duplicateEdited = await patchFunction(db, productId, fid, parseFunctionInput({ name: "Legacy action", category: "troll", default_gift_id: 5655, default_trigger_threshold: 2 }, true))
  assert.equal(duplicateEdited.name, "Legacy action", "An unchanged duplicate legacy key never requires renaming")
  assert.equal(duplicateEdited.category, "troll"); assert.equal(duplicateEdited.default_trigger_threshold, 2)
  const reused = await patchFunction(db, productId, fid, parseFunctionInput({ name: "Custom action", label_en: "Renamed button" }, true))
  assert.equal(reused.id, fid); assert.equal(reused.name, "Custom action"); assert.equal(created[0].label_en, null, "Editing one ID cannot overwrite a same-key function")
  await assert.rejects(reorderFunctions(db, productId, [{ id: fid, sort_order: 2 }, { id: foreignFid, sort_order: 3 }]), /function_not_found/)
  assert.equal(rows.find(row => row.id === fid)!.sort_order, 0, "Foreign product IDs reject the complete reorder")
  assert.equal(rows.find(row => row.id === foreignFid)!.sort_order, 0)
  console.log("PASS product functions: conservative categories, strict inputs, duplicates, atomic bulk, legacy partial PATCH, Like validation and product-scoped reorder")
}
main().catch(error => { console.error(error); process.exitCode = 1 })
