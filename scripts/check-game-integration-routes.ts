import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { NextRequest, NextResponse } from "next/server"
const token = "test-service-credential-".repeat(3), id = "11111111-1111-4111-8111-111111111111"
process.env.TIKKIES_API_KEY_SHA256 = createHash("sha256").update(token).digest("hex"); process.env.TIKKIES_API_ENABLED = "true"
let admin = false, calls = 0, limited = false, failure: Error | null = null
function stub(name: string, exports: unknown) { const file = require.resolve(name); require.cache[file] = { id: file, filename: file, loaded: true, exports } as NodeModule }
const db = { $queryRaw: async (_sql: unknown, ...values: unknown[]) => [values[0], values[1]].map(key_hash => ({ key_hash, count: limited ? 999999 : 1, reset_at: new Date(Date.now() + 60000) })), $executeRaw: async () => 0 }
stub("../lib/prisma", { prisma: db })
stub("../lib/adminAuth", { validateAdmin: async () => admin ? { isValid: true } : { isValid: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) } })
const actual = require("../lib/integrations/tikkiesGameDefaults")
stub("../lib/integrations/tikkiesGameDefaults", { ...actual, readAdminGameConnection: async () => { calls++; if (failure) throw failure; return { receiverConfig: { BridgeKey: "admin-only-fixture" } } }, readTikkiesInteractiveConfig: async (_db: unknown, input: unknown) => { calls++; assert.deepEqual(input, { email: "buyer@example.com", productId: id }); if (failure) throw failure; return { credentialHash: "private-service-fixture" } } })
const receiver = require("../app/api/admin/products/[id]/game-defaults/connection/route"), interactive = require("../app/api/integrations/tikkies/library/[id]/interactive/route")
const context = { params: Promise.resolve({ id }) }
const request = (body: unknown = {}, bearer = "", query = "") => new NextRequest("https://aclassstore.com/api/test" + query, { method: "POST", headers: { "content-type": "application/json", ...(bearer ? { authorization: "Bearer " + bearer } : {}) }, body: JSON.stringify(body) })
async function run() {
  assert.equal((await receiver.POST(request(), context)).status, 403)
  assert.equal((await interactive.POST(request({ email: "buyer@example.com" }), context)).status, 401)
  assert.equal(calls, 0, "no config read before authorization")
  admin = true; const setup = await receiver.POST(request(), context); assert.equal(setup.status, 200); assert.match(setup.headers.get("cache-control")!, /no-store/)
  assert.equal((await setup.json()).receiverConfig.BridgeKey, "admin-only-fixture")
  const result = await interactive.POST(request({ email: "buyer@example.com" }, token), context); assert.equal(result.status, 200); assert.match(result.headers.get("cache-control")!, /no-store/)
  for (const body of [{ email: null }, { email: "buyer@example.com", productId: id }, { email: "bad" }]) assert.equal((await interactive.POST(request(body, token), context)).status, 400)
  assert.equal((await interactive.POST(request({ email: "buyer@example.com" }, token, "?x=1"), context)).status, 400)
  failure = Error("private_database_detail"); const failed = await receiver.POST(request(), context); assert.equal(failed.status, 503); assert.equal(JSON.stringify(await failed.json()).includes("private_database_detail"), false)
  failure = null; limited = true; assert.equal((await interactive.POST(request({ email: "buyer@example.com" }, token), context)).status, 429)
  console.log("PASS integration routes: admin-only receiver key, service-only private config, no-store, strict email body, query rejection, safe errors and rate limit")
}
run().catch(error => { console.error(error); process.exitCode = 1 })
