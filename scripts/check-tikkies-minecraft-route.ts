import assert from "node:assert/strict"
import crypto from "node:crypto"
import { NextRequest } from "next/server"

const token = crypto.randomBytes(48).toString("base64url")
process.env.TIKKIES_API_KEY_SHA256 = crypto.createHash("sha256").update(token).digest("hex")
process.env.TIKKIES_API_ENABLED = "true"
process.env.NEXTAUTH_SECRET = "test-only-download-secret"
process.env.NEXT_PUBLIC_APP_URL = "https://aclassstore.com"
let limited = false, transactions = 0
const db = {
  $queryRaw: async (parts: TemplateStringsArray, ...values: unknown[]) => parts.join().includes("INSERT") ? [values[0], values[1]].map(key_hash => ({ key_hash, count: limited ? 999999 : 1, reset_at: new Date(Date.now() + 60000) })) : [],
  $executeRaw: async () => 0,
  $transaction: async (fn: (tx: unknown) => unknown) => { transactions++; return fn(db) },
}
const file = require.resolve("../lib/prisma")
require.cache[file] = { id: file, filename: file, loaded: true, exports: { prisma: db } } as NodeModule
const { POST } = require("../app/api/integrations/tikkies/minecraft/route")
const body = { email: "buyer@example.com", productId: "11111111-1111-4111-8111-111111111111", machineId: "machine-12345678" }
const req = (value: unknown = body, auth: string | null = token, suffix = "") => new NextRequest("https://aclassstore.com/api/integrations/tikkies/minecraft" + suffix, { method: "POST", headers: { "content-type": "application/json", ...(auth ? { authorization: "Bearer " + auth } : {}) }, body: JSON.stringify(value) })
async function main() {
  assert.equal((await POST(req(body, null))).status, 401)
  assert.equal((await POST(req(body, "b".repeat(48)))).status, 401)
  process.env.TIKKIES_API_ENABLED = "false"; assert.equal((await POST(req())).status, 403); process.env.TIKKIES_API_ENABLED = "true"
  assert.equal((await POST(req({ ...body, url: "https://evil.test" }))).status, 400)
  assert.equal((await POST(req(body, token, "?email=forged@example.com"))).status, 400)
  assert.equal((await POST(req({ ...body, machineId: "x".repeat(9000) }))).status, 400)
  assert.equal(transactions, 0, "invalid/private requests must never touch entitlements or HWID")
  limited = true
  let response = await POST(req()); assert.equal(response.status, 429); assert.ok(response.headers.get("retry-after")); assert.equal(transactions, 0)
  limited = false
  response = await POST(req()); assert.equal(response.status, 403); assert.match(response.headers.get("cache-control") || "", /no-store/)
  assert.equal((await response.json()).error, "game_not_owned"); assert.equal(transactions, 1)
  console.log("PASS Minecraft store route: private credentials, bounded input, current entitlement, no-store and rate limits")
}
main().catch(error => { console.error(error); process.exitCode = 1 })
