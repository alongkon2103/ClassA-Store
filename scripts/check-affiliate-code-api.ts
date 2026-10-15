// Direct handler tests with auth and Prisma mocked; never connects to or changes a database.
import assert from "node:assert/strict"
import { createRequire } from "node:module"
import { NextRequest, NextResponse } from "next/server"
const require = createRequire(import.meta.url)
let authorized = true
const authPath = require.resolve("../lib/adminAuth")
require.cache[authPath] = { id: authPath, filename: authPath, loaded: true, exports: {
  validateAdmin: async () => authorized ? { isValid: true } : { isValid: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 403 }) },
} } as NodeModule
const { prisma } = require("../lib/prisma")
const { POST } = require("../app/api/admin/discount-codes/route")
const { PATCH } = require("../app/api/admin/discount-codes/[id]/route")
const A = "11111111-1111-1111-1111-111111111111", B = "22222222-2222-2222-2222-222222222222", C = "33333333-3333-3333-3333-333333333333"
let saved: Record<string, unknown> = {}
let existing = { owner_user_id: A, product_id: A as string | null, product_ids: [] as string[], partner_product_id: null, game_scope: "all" }
prisma.discount_codes.findUnique = async ({ where }: { where: { id?: string } }) => where.id ? existing : null
prisma.products.count = async ({ where }: { where: { id: { in: string[] } } }) => where.id.in.filter(id => [A, B].includes(id)).length
prisma.discount_codes.create = async ({ data }: { data: Record<string, unknown> }) => { saved = data; return { id: C, ...data } }
prisma.discount_codes.update = async ({ data }: { data: Record<string, unknown> }) => { saved = data; return { id: C, ...existing, ...data } }
const request = (body: unknown, method: string) => new NextRequest("http://localhost/api/admin/discount-codes", { method, body: JSON.stringify(body), headers: { "Content-Type": "application/json" } })
const create = (body: Record<string, unknown>) => POST(request({ code: "TEST", value: 50, owner_user_id: A, ...body }, "POST"))
const patch = (body: unknown) => PATCH(request(body, "PATCH"), { params: Promise.resolve({ id: C }) })
async function check() {
  assert.equal((await create({ product_ids: [A, B, A] })).status, 200)
  assert.deepEqual(saved.product_ids, [A, B])
  assert.equal(saved.product_id, null)
  assert.equal(saved.is_public, false)
  assert.equal((await create({ product_ids: [] })).status, 400)
  assert.equal((await create({ product_ids: ["invalid"] })).status, 400)
  assert.equal((await create({ product_ids: [C] })).status, 400)
  assert.equal((await create({ product_ids: [A], product_id: B })).status, 400)
  assert.equal((await patch({ product_ids: [A, B] })).status, 200)
  assert.deepEqual(saved.product_ids, [A, B])
  assert.equal(saved.product_id, null, "Switching from a legacy single game clears that field")
  existing = { ...existing, product_id: null, product_ids: [A, B] }
  assert.equal((await patch({ commission_pct: 20 })).status, 200)
  assert.equal(saved.product_ids, undefined, "Editing commission preserves the existing allowlist")
  assert.equal((await patch({ product_id: null, game_scope: "all" })).status, 400, "Stale single-game clients cannot broaden a multi-game code")
  assert.equal((await patch({ product_ids: [] })).status, 400)
  assert.equal((await patch({ product_ids: null })).status, 200)
  assert.deepEqual(saved.product_ids, [], "Explicit all-products mode clears the allowlist")
  assert.equal((await patch({ product_ids: null, product_id: A })).status, 200, "Explicitly replacing an allowlist with a legacy single game works")
  assert.deepEqual(saved.product_ids, [])
  assert.equal(saved.product_id, A)
  existing = { ...existing, product_ids: [A, C] }
  assert.equal((await patch({ is_active: false })).status, 200, "An obsolete selected game must not prevent disabling the code")
  assert.equal(saved.product_ids, undefined)
  authorized = false
  assert.equal((await create({ product_ids: [A] })).status, 403)
  assert.equal((await patch({ product_ids: null })).status, 403)
  console.log("Affiliate discount handlers: create/edit, validation, preservation, explicit all mode and admin guard OK")
}
check().catch(error => { console.error(error); process.exitCode = 1 })
