import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { NextRequest, NextResponse } from "next/server"

const productId = "11111111-1111-4111-8111-111111111111", foreign = "22222222-2222-4222-8222-222222222222"
const a = "33333333-3333-4333-8333-333333333333", b = "44444444-4444-4444-8444-444444444444"
type Row = { id: string; product_id: string; url: string; filename: string; filesize: number | null; sort_order: number | null; created_at: Date | null }
let rows: Row[] = [], allowed = true, missingProduct = false, failCreate = false, lockCalls = 0
let lockTail: Promise<void> = Promise.resolve()
type Transaction = { release?: () => void; before?: Row[] }
const row = (id: string, sort_order: number | null, created_at: Date | null = new Date("2026-11-01Z")): Row => ({ id, product_id: productId, url: "/presets/original.tikkies", filename: id === a ? "Old default.tikkies" : "Old download.tfc", filesize: 10, sort_order, created_at })
function client(tx?: Transaction): any {
  const scoped = () => { if (tx) assert.ok(tx.release, "The product lock must precede preset reads/writes") }
  return {
    $queryRaw: async (query: TemplateStringsArray, id: string) => {
      if (query.join("?").includes("FROM users")) {
        assert.equal(id, "buyer@example.com")
        return [{ id: "customer", nativeStatus: "ACTIVE" }]
      }
      assert.ok(tx, "Product locking belongs inside the write transaction")
      assert.match(query.join("?"), /SELECT id FROM products.*FOR UPDATE/)
      assert.equal(id, productId)
      lockCalls++
      const previous = lockTail
      lockTail = new Promise(resolve => { tx!.release = resolve })
      await previous
      tx!.before = structuredClone(rows)
      return missingProduct ? [] : [{ id }]
    },
    products: {
      findFirst: async () => ({ id: productId }),
      findMany: async () => [{ id: productId, slug: "game", name_th: "Game", name_en: "Game", description_th: "", description_en: "", type: "roblox_whitelist", info_page_url: null, roblox_place_ids: [], product_images: [] }],
    },
    orders: { findMany: async () => [{ product_id: productId, status: "paid", paid_at: new Date(), whitelist_status: "whitelisted", whitelisted_username: "Player_A", expires_at: new Date(Date.now() + 86400000) }] },
    user_whitelist_access: { findMany: async () => [{ product_id: productId, ign: "player_a", expires_at: new Date(Date.now() + 86400000) }] },
    user_program_access: { findMany: async () => [] },
    point_redemptions: { findMany: async () => [] },
    product_functions: { findMany: async () => [] },
    product_gifts: { findMany: async () => [] },
    product_presets: {
      findMany: async ({ where, take, skip = 0 }: any) => {
        scoped()
        const result = rows.filter(item => item.product_id === where.product_id && (!where.filename || item.filename.toLowerCase().endsWith(where.filename.endsWith.toLowerCase())))
          .sort((x, y) => (x.sort_order ?? Infinity) - (y.sort_order ?? Infinity) || (x.created_at?.getTime() ?? Infinity) - (y.created_at?.getTime() ?? Infinity) || x.id.localeCompare(y.id))
        return result.slice(skip, take === undefined ? undefined : skip + take).map(item => ({ ...item }))
      },
      updateMany: async ({ where, data }: any) => {
        scoped()
        const found = rows.find(item => item.id === where.id && item.product_id === where.product_id)
        if (found) Object.assign(found, data)
        await Promise.resolve()
        return { count: found ? 1 : 0 }
      },
      create: async ({ data }: any) => {
        scoped()
        if (failCreate) throw Error("private_database_failure")
        await Promise.resolve()
        const created = { ...data, id: randomUUID(), created_at: new Date() }
        rows.push(created)
        return created
      },
    },
  }
}
const db = {
  ...client(),
  $transaction: async (operation: (tx: unknown) => unknown) => {
    const tx: Transaction = {}
    try { return await operation(client(tx)) }
    catch (error) { if (tx.before) rows = tx.before; throw error }
    finally { tx.release?.() }
  },
}
function mock(name: string, exports: unknown) { const file = require.resolve(name); require.cache[file] = { id: file, filename: file, loaded: true, exports } as NodeModule }
mock("../lib/prisma", { prisma: db })
mock("../lib/adminAuth", { validateProductEditor: async (id: string) => {
  assert.equal(id, productId)
  return allowed ? { isValid: true } : { isValid: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
} })
const { POST } = require("../app/api/admin/products/[id]/presets/route")
const { promoteTikkiesPreset, readTikkiesPreset } = require("../lib/integrations/tikkiesPreset")
const upload = (extra: Record<string, unknown> = {}) => POST(new NextRequest("https://aclassstore.com/api/admin/products/" + productId + "/presets", {
  method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify({ url: "/presets/new.tikkies", filename: "New.tikkies", filesize: 100, ...extra }),
}), { params: Promise.resolve({ id: productId }) })
const current = () => rows.filter(item => item.product_id === productId).sort((x, y) => x.sort_order! - y.sort_order!)
function reset(existing: Row[]) {
  rows = [...existing, { ...row("55555555-5555-4555-8555-555555555555", 88), product_id: foreign }]
  lockCalls = 0
}
async function main() {
  for (const fixture of [
    { rows: [row(a, 5), row(b, 20)], order: [a, b] },
    { rows: [row(a, null), row(b, 5)], order: [b, a] },
    { rows: [row(b, null, null), row(a, null)], order: [a, b] },
    { rows: [row(b, 5), row(a, 5)], order: [a, b] },
    { rows: [row(a, 5, new Date("2026-11-02Z")), row(b, 5, new Date("2026-11-01Z"))], order: [b, a] },
    { rows: [], order: [] },
  ]) {
    reset(fixture.rows)
    const response = await upload({ sort_order: fixture.rows.length })
    assert.equal(response.status, 201)
    const added = await response.json()
    assert.deepEqual(current().map(item => item.id), [...fixture.order, added.id], "Upload must append after the deterministic old sequence, ignoring client order")
    assert.deepEqual(current().map(item => item.sort_order), Array.from({ length: fixture.rows.length + 1 }, (_, index) => index))
    assert.equal(added.sort_order, fixture.rows.length)
    assert.equal(rows.find(item => item.product_id === foreign)!.sort_order, 88)
    assert.equal(lockCalls, 1)
  }
  reset([row(a, 5), row(b, 20)])
  assert.equal((await upload({ sort_order: -2147483648 })).status, 201)
  assert.equal(current()[0].id, a, "Even an explicitly forged client order cannot replace the old default")
  const large = Array.from({ length: 201 }, (_, index) => row(index === 0 ? a : randomUUID(), 5 + index * 7))
  reset(large)
  assert.equal((await upload()).status, 201, "Appending ordinary product downloads must not inherit the integration's default-search capacity limit")
  assert.equal(current()[0].id, a); assert.equal(current().at(-1)!.sort_order, 201)
  reset([row(a, 5), row(b, 20)])
  const before = structuredClone(rows)
  allowed = false; assert.equal((await upload()).status, 403); assert.deepEqual(rows, before); assert.equal(lockCalls, 0); allowed = true
  failCreate = true; assert.equal((await upload()).status, 503); assert.deepEqual(rows, before, "Normalization rolls back if creating the appended row fails"); failCreate = false
  missingProduct = true; assert.equal((await upload()).status, 404); assert.deepEqual(rows, before); missingProduct = false
  const uploads = await Promise.all([upload({ filename: "One.tikkies" }), upload({ filename: "Two.tikkies" })])
  assert.deepEqual(uploads.map(response => response.status), [201, 201])
  assert.deepEqual(current().map(item => item.sort_order), [0, 1, 2, 3])
  assert.deepEqual(current().slice(0, 2).map(item => item.id), [a, b], "Concurrent uploads retain the old implicit default")
  assert.equal(current().filter(item => item.filename === "One.tikkies").length, 1)
  assert.equal(current().filter(item => item.filename === "Two.tikkies").length, 1)
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "preset-append-"))
  try {
    await fs.mkdir(path.join(root, "presets"))
    await fs.writeFile(path.join(root, "presets", "new.tikkies"), JSON.stringify({ app: "tikkies-tools", type: "actions", version: 1, actions: [] }))
    await fs.writeFile(path.join(root, "presets", "original.tikkies"), JSON.stringify([{ id: "original", name: "Old default", responses: [{ type: "keypress", key: "G" }] }]))
    const selected = current()[3]
    const promoted = await promoteTikkiesPreset(db, productId, selected.id, "https://aclassstore.com", { uploadRoot: root })
    assert.equal(promoted.presets[0].id, selected.id, "Explicit promotion still changes the default after append")
    assert.equal(current()[0].id, selected.id)
    const response = await upload()
    assert.equal(response.status, 201); assert.equal(current()[0].id, selected.id, "The next upload preserves an explicitly promoted default")
    reset(Array.from({ length: 200 }, (_, index) => row(index === 0 ? a : randomUUID(), index)))
    const input = { email: "buyer@example.com", productId }
    const beforeDefault = await readTikkiesPreset(db, input, "https://aclassstore.com", { uploadRoot: root })
    assert.equal(beforeDefault.preset.id, a)
    assert.equal((await upload({ filename: "Ordinary download.tfc", url: "/presets/download.tfc" })).status, 201)
    const afterDefault = await readTikkiesPreset(db, input, "https://aclassstore.com", { uploadRoot: root })
    assert.equal(afterDefault.preset.id, a, "The 201st ordinary download must not invalidate an existing compatible default")
    assert.equal(afterDefault.revision, beforeDefault.revision)
    assert.deepEqual(afterDefault.actions, beforeDefault.actions)
    const pending = await upload({ filename: "Future default.tikkies" })
    assert.equal(pending.status, 201)
    const nextDefault = await pending.json()
    await promoteTikkiesPreset(db, productId, nextDefault.id, "https://aclassstore.com", { uploadRoot: root })
    assert.equal((await readTikkiesPreset(db, input, "https://aclassstore.com", { uploadRoot: root })).preset.id, nextDefault.id, "Promotion must support a product with more than 200 downloads")
  } finally { await fs.rm(root, { recursive: true, force: true }) }
  console.log("PASS canonical preset append: sparse/null/tied/empty orders, ignored client order, product lock, rollback, concurrent upload, promotion and editor authorization")
}
main().catch(error => { console.error(error); process.exitCode = 1 })
