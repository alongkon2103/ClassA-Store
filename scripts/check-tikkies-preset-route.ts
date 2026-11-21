import assert from "node:assert/strict"
import { createHash, randomBytes } from "node:crypto"
import { NextRequest, NextResponse } from "next/server"

const token = randomBytes(48).toString("base64url")
process.env.TIKKIES_API_KEY_SHA256 = createHash("sha256").update(token).digest("hex")
process.env.TIKKIES_API_ENABLED = "true"
const gameId = "acc03a88-9090-42d9-9ce2-29f1c853b898", presetId = "11111111-1111-4111-8111-111111111111"
let allowAdmin = true, limited = false, calls = 0, captured: unknown
const db = {
  $queryRaw: async (_query: unknown, ...values: unknown[]) => [values[0], values[1]].map(key_hash => ({ key_hash, count: limited ? 999999 : 1, reset_at: new Date(Date.now() + 60000) })),
  $executeRaw: async () => 0,
}
function mock(name: string, exports: unknown) { const file = require.resolve(name); require.cache[file] = { id: file, filename: file, loaded: true, exports } as NodeModule }
mock("../lib/prisma", { prisma: db })
const actual = require("../lib/integrations/tikkiesPreset")
mock("../lib/integrations/tikkiesPreset", {
  ...actual,
  readTikkiesPreset: async (_db: unknown, input: unknown) => { calls++; captured = input; return { schemaVersion: 1, gameId, actions: [] } },
  promoteTikkiesPreset: async (_db: unknown, id: string, picked: string) => { calls++; captured = { id, picked }; return { presets: [] } },
})
mock("../lib/adminAuth", { validateProductEditor: async (id: string) => { assert.equal(id, gameId); return allowAdmin ? { isValid: true } : { isValid: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) } } })
const { POST } = require("../app/api/integrations/tikkies/preset/route")
const promote = require("../app/api/admin/products/[id]/presets/[presetId]/default/route").POST
const req = (body: unknown, credential: string | null = token, suffix = "") => new NextRequest("https://aclassstore.com/api/integrations/tikkies/preset" + suffix, { method: "POST", headers: { "content-type": "application/json", ...(credential ? { authorization: "Bearer " + credential } : {}) }, body: JSON.stringify(body) })
async function main() {
  assert.equal((await POST(req({ email: "buyer@example.com", productId: gameId }, null))).status, 401)
  assert.equal((await POST(req({ email: "buyer@example.com", productId: gameId, machineId: "device" }))).status, 400)
  assert.equal((await POST(req({ email: "buyer@example.com", productId: gameId }, token, "?email=other@example.com"))).status, 400)
  let response = await POST(req({ email: " Buyer@Example.com ", productId: gameId }))
  assert.equal(response.status, 200); assert.match(response.headers.get("cache-control")!, /no-store/)
  assert.deepEqual(captured, { email: "buyer@example.com", productId: gameId })
  limited = true; response = await POST(req({ email: "buyer@example.com", productId: gameId })); assert.equal(response.status, 429); assert.ok(response.headers.get("retry-after")); limited = false
  const params = { params: Promise.resolve({ id: gameId, presetId }) }
  allowAdmin = false; const before = calls; assert.equal((await promote(req({}), params)).status, 403); assert.equal(calls, before)
  allowAdmin = true; assert.equal((await promote(req({}), params)).status, 200); assert.deepEqual(captured, { id: gameId, picked: presetId })
  console.log("PASS preset routes: integration authentication, identity/body/query bounds, rate limits, no-store and product editor authorization")
}
main().catch(error => { console.error(error); process.exitCode = 1 })
