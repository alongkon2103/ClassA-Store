import assert from "node:assert/strict"
import fs from "node:fs"
import { createHash, randomBytes } from "node:crypto"
import { NextRequest } from "next/server"
assert.ok(fs.existsSync("app/api/integrations/tikkies/library/route.ts"), "Our Game needs its private library API")
const token = randomBytes(48).toString("base64url")
process.env.TIKKIES_API_KEY_SHA256 = createHash("sha256").update(token).digest("hex")
process.env.TIKKIES_API_ENABLED = "true"
let blocked = false, captured: Record<string, unknown> = {}
const db = {
  $queryRaw: async (parts: TemplateStringsArray, ...values: unknown[]) => parts.join().includes("INSERT") ? [values[0], values[1]].map(key_hash => ({ key_hash, count: blocked ? 999999 : 1, reset_at: new Date(Date.now() + 60000) })) : [],
  $executeRaw: async () => 0,
  products: { findMany: async () => [], findUnique: async ({where}:any) => where.id?({id:"p",type:"roblox_whitelist",is_active:true,product_variants:[]}):null, findFirst: async () => null,
    create: async ({ data }: { data: Record<string, unknown> }) => { captured = data; return { id: "p", ...data } },
    update: async ({ data }: { data: Record<string, unknown> }) => { captured = data; return { id: "p", price: 1, ...data } } },
  $transaction: async (fn: (tx: unknown) => unknown) => fn(db),
}
function mock(name: string, exports: unknown) { const file = require.resolve(name); require.cache[file] = { id: file, filename: file, loaded: true, exports } as NodeModule }
mock("../lib/prisma", { prisma: db })
mock("../lib/adminAuth", { validateAdmin: async () => ({ isValid: true, session: { user: { id: "admin", role: "admin" } } }) })
const { POST } = require("../app/api/integrations/tikkies/library/route")
const createProduct = require("../app/api/admin/products/route").POST
const updateProduct = require("../app/api/admin/products/[id]/route").PATCH
const req = (body: unknown, auth: string | null = token) => new NextRequest("https://aclassstore.com/api/integrations/tikkies/library", { method: "POST", headers: { "content-type": "application/json", ...(auth ? { authorization: "Bearer " + auth } : {}) }, body: JSON.stringify(body) })
async function main() {
  assert.equal((await POST(req({ email: "a@b.com" }, null))).status, 401)
  assert.equal((await POST(req({ email: "a@b.com" }, "wrong"))).status, 401)
  assert.equal((await POST(req({ email: "a@b.com", userId: "other" }))).status, 400)
  assert.equal((await POST(req({ email: "bad" }))).status, 400)
  const response = await POST(req({ email: null }))
  assert.equal(response.status, 200); assert.match(response.headers.get("cache-control"), /no-store/)
  assert.deepEqual((await response.json()).games, [])
  blocked = true; const limited = await POST(req({ email: "a@b.com" })); assert.equal(limited.status, 429); assert.ok(limited.headers.get("retry-after")); blocked = false
  const fields = { name_en: "Game", name_th: "เกม", slug: "game", price: 100, info_page_url: "https://www.roblox.com/games/123/Test" }
  assert.equal((await createProduct(req(fields))).status, 201)
  assert.equal(captured.info_page_url, fields.info_page_url, "Creating a product must persist its game link")
  assert.equal((await createProduct(req({ ...fields, info_page_url: "javascript:alert(1)" }))).status, 400)
  assert.equal((await updateProduct(req({ info_page_url: "file:///test.exe" }), { params: Promise.resolve({ id: "p" }) })).status, 400)
  assert.equal((await updateProduct(req({ info_page_url: "www.roblox.com/games/123" }), { params: Promise.resolve({ id: "p" }) })).status, 200)
  assert.equal(captured.info_page_url, "https://www.roblox.com/games/123")
  console.log("PASS Our Game API: private authentication, bounded input, no-store, rate limits, product link persistence and validation")
}
main().catch(error => { console.error(error); process.exitCode = 1 })
