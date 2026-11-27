import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { NextResponse } from "next/server"

let allowed = false, reads = 0, failSecond = false, writes = 0
const productId = "11111111-1111-4111-8111-111111111111", otherProduct = "22222222-2222-4222-8222-222222222222"
const foreignId = "33333333-3333-4333-8333-333333333333"
let rows: Record<string, any>[] = [{ id: foreignId, product_id: otherProduct, name: "Other", category: "neutral", sort_order: 0 }]
const db = {
  $queryRaw: async (_parts: TemplateStringsArray, id: string) => { reads++; return id === productId ? [{ id }] : [] },
  gifts: { findMany: async () => [{ id: 5655, trigger_type: "Gift" }] },
  product_functions: {
    findMany: async ({ where }: any) => rows.filter(row => row.product_id === where.product_id),
    findFirst: async ({ where }: any) => rows.find(row => row.product_id === where.product_id && row.id === where.id) || null,
    create: async ({ data }: any) => { if (failSecond && ++writes === 2) throw Error("private_database_detail"); const row = { id: randomUUID(), ...data }; rows.push(row); return row },
    update: async ({ where, data }: any) => { const row = rows.find(row => row.id === where.id)!; Object.assign(row, data); return row },
  },
  $transaction: async (fn: (tx: unknown) => unknown) => { const before = structuredClone(rows); try { return await fn(db) } catch (error) { rows = before; throw error } },
}
function stub(name: string, exports: unknown) { const file = require.resolve(name); require.cache[file] = { id: file, filename: file, loaded: true, exports } as NodeModule }
stub("../lib/prisma", { prisma: db })
stub("../lib/adminAuth", { validateAdmin: async (roles: string[]) => {
  assert.deepEqual(roles, ["admin"])
  return allowed ? { isValid: true } : { isValid: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
} })
const single = require("../app/api/admin/products/[id]/functions/route")
const bulk = require("../app/api/admin/products/[id]/functions/bulk/route")
const item = require("../app/api/admin/products/[id]/functions/[fid]/route")
const reorder = require("../app/api/admin/products/[id]/functions/reorder/route")
const request = (body: unknown) => new Request("https://store.test/api/admin/test", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })
const context = { params: Promise.resolve({ id: productId, fid: foreignId }) }
async function main() {
  for (const route of [single.POST, bulk.POST, item.PATCH, reorder.PATCH]) assert.equal((await route(request({}), context)).status, 403)
  assert.equal(reads, 0, "Unauthorized requests never access product data")
  allowed = true
  let response = await bulk.POST(request({ items: [{ name: "Giant", label_th: "ใหญ่", image_url: "/uploads/a.webp", default_gift_id: 5655, default_trigger_threshold: 1 }, { name: "Mob Rain", category: "troll" }] }), context)
  assert.equal(response.status, 201)
  const created = (await response.json()).functions
  assert.equal(created.length, 2); assert.equal(created[0].category, "help")
  response = await bulk.POST(request({ items: [{ name: "gacha", label_en: "Gacha" }, { name: "gacha", label_en: "Gacha 2" }] }), context)
  assert.equal(response.status, 201)
  const duplicates = (await response.json()).functions
  assert.equal(duplicates.length, 2); assert.notEqual(duplicates[0].id, duplicates[1].id)
  response = await item.PATCH(request({ name: "gacha", label_en: "Gacha 3" }), { params: Promise.resolve({ id: productId, fid: created[0].id }) })
  assert.equal(response.status, 200); assert.equal((await response.json()).id, created[0].id)
  assert.equal(rows.find(row => row.id === duplicates[0].id)!.label_en, "Gacha", "PATCH targets an ID even when the command is shared")
  response = await item.PATCH(request({ category: "neutral" }), { params: Promise.resolve({ id: productId, fid: created[0].id }) })
  assert.equal(response.status, 200)
  const patched = await response.json(); assert.equal(patched.label_th, "ใหญ่"); assert.equal(patched.image_url, "/uploads/a.webp"); assert.equal(patched.default_gift_id, 5655)
  assert.equal((await item.PATCH(request({ category: "help" }), context)).status, 404)
  assert.equal((await reorder.PATCH(request([{ id: foreignId, sort_order: 3 }]), context)).status, 404)
  assert.equal(rows.find(row => row.id === foreignId)!.sort_order, 0)
  assert.equal((await bulk.POST(request({ items: [] }), context)).status, 400)
  assert.equal((await single.POST(request({ name: "Freeze" }), context)).status, 201)
  assert.equal((await single.POST(request({ name: "gacha", label_en: "Gacha 4" }), context)).status, 201)
  failSecond = true; writes = 0; const before = rows.length
  response = await bulk.POST(request({ items: [{ name: "Atomic A" }, { name: "Atomic B" }] }), context)
  assert.equal(response.status, 500); assert.equal(rows.length, before); assert.equal(JSON.stringify(await response.json()).includes("private_database_detail"), false)
  console.log("PASS admin function routes: admin gate, reusable keys in single/bulk/PATCH, distinct IDs, atomic rollback, partial PATCH and scoped reorder")
}
main().catch(error => { console.error(error); process.exitCode = 1 })
