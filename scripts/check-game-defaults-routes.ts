import assert from "node:assert/strict"
import fs from "node:fs"
import { createHash, randomBytes } from "node:crypto"
import { NextRequest, NextResponse } from "next/server"
assert.ok(fs.existsSync("app/api/admin/products/[id]/game-defaults/route.ts"), "canonical admin route exists")
const token = randomBytes(48).toString("base64url")
process.env.TIKKIES_API_KEY_SHA256 = createHash("sha256").update(token).digest("hex"); process.env.TIKKIES_API_ENABLED = "true"
const id = "11111111-1111-4111-8111-111111111111"
let admin = false, calls = 0, limited = false, failure: Error | null = null
const db = { $queryRaw: async (_sql: unknown, ...values: unknown[]) => [values[0], values[1]].map(key_hash => ({ key_hash, count: limited ? 999999 : 1, reset_at: new Date(Date.now() + 60000) })), $executeRaw: async () => 0 }
function stub(name: string, exports: unknown) { const file = require.resolve(name); require.cache[file] = { id: file, filename: file, loaded: true, exports } as NodeModule }
stub("../lib/prisma", { prisma: db })
stub("../lib/adminAuth", { validateAdmin: async (roles: string[]) => { assert.deepEqual(roles, ["admin"]); return admin ? { isValid: true } : { isValid: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) } } })
const actual = require("../lib/integrations/tikkiesGameDefaults")
const read = async () => { calls++; if (failure) throw failure; return { ok: true } }
stub("../lib/integrations/tikkiesGameDefaults", { ...actual, readAdminGameDefaults: read, saveAdminGameDefaults: read, importAdminGameDefaults: read, readTikkiesGameDefaults: read })
const route = require("../app/api/admin/products/[id]/game-defaults/route")
const importer = require("../app/api/admin/products/[id]/game-defaults/import/route")
const integration = require("../app/api/integrations/tikkies/actions/route")
const request = (method: string, body?: unknown, bearer?: string, suffix = "") => new NextRequest("https://aclassstore.com/api/test" + suffix, { method, headers: { "content-type": "application/json", ...(bearer ? { authorization: "Bearer " + bearer } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
const context = { params: Promise.resolve({ id }) }
async function run() {
  for (const [handler, method] of [[route.GET, "GET"], [route.PUT, "PUT"], [importer.POST, "POST"]] as const) assert.equal((await handler(request(method, method === "GET" ? undefined : {}), context)).status, 403)
  assert.equal(calls, 0)
  admin = true
  assert.equal((await route.GET(request("GET"), context)).status, 200)
  assert.equal((await route.GET(request("GET", undefined, undefined, "?other=1"), context)).status, 400)
  const { GameDefaultsError } = require("../lib/tikkiesGameDefaults")
  failure = new GameDefaultsError("defaults_changed", 409)
  assert.equal((await route.PUT(request("PUT", {}), context)).status, 409)
  failure = Error("private_database_detail")
  const error = await route.GET(request("GET"), context); assert.equal(error.status, 503); assert.equal(JSON.stringify(await error.json()).includes("private_database_detail"), false)
  failure = null
  assert.equal((await integration.POST(request("POST", { email: "buyer@example.com", productId: id }))).status, 401)
  const result = await integration.POST(request("POST", { email: "buyer@example.com", productId: id }, token)); assert.equal(result.status, 200); assert.match(result.headers.get("cache-control")!, /no-store/)
  assert.equal((await integration.POST(request("POST", { email: "buyer@example.com", productId: id, other: true }, token))).status, 400)
  limited = true; assert.equal((await integration.POST(request("POST", { email: "buyer@example.com", productId: id }, token))).status, 429)
  console.log("PASS canonical routes: admin-only before reads, query/body bounds, safe errors, revision409 and signed/rate-limited no-store delivery")
}
run().catch(error => { console.error(error); process.exitCode = 1 })
