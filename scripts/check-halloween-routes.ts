import assert from "node:assert/strict"
import { createRequire } from "node:module"
const require = createRequire(import.meta.url)
const stub = (path: string, exports: unknown) => { const file = require.resolve(path); require.cache[file] = { id: file, filename: file, loaded: true, exports } as NodeModule }
let userId: string | null = null, draws = 0, claims = 0, failure = false
const { HalloweenError } = require("../lib/halloweenDraw")
stub("next-auth", { getServerSession: async () => userId ? { user: { id: userId } } : null })
stub("../lib/auth", { authOptions: {} })
stub("../lib/halloweenDraw", {
  HalloweenError,
  getHalloweenState: async (id: string | null) => ({ signedIn: !!id, draw: null }),
  drawHalloween: async () => { draws++; if (failure) throw new HalloweenError("upcoming"); return { id: "stored-server-prize" } },
  claimHalloween: async () => { claims++; return { id: "stored-server-prize", claimedAt: "now" } },
})
const api = require("../app/api/events/halloween/route")
const claim = require("../app/api/events/halloween/claim/route")
assert.equal(typeof api.POST, "function", "The event needs an authenticated server draw endpoint")
const req = (body: unknown, origin = "http://localhost:3000") => new Request("http://localhost:3000/api/events/halloween", {
  method: "POST", headers: { "content-type": "application/json", origin }, body: JSON.stringify(body),
})
async function check() {
  const state = await api.GET()
  assert.ok(state.headers.get("cache-control")?.includes("no-store"))
  assert.equal((await api.POST(req({}))).status, 401)
  userId = "fixture"
  assert.equal((await api.POST(req({}, "https://evil.example"))).status, 403)
  assert.equal((await api.POST(req({ amount: 5000000, kind: "points" }))).status, 400)
  assert.equal((await api.POST(req({ x: "x".repeat(3000) }))).status, 400)
  assert.equal(draws, 0, "Forged or unauthorized calls must not reach the reward service")
  const result = await api.POST(req({}))
  assert.equal(result.status, 200); assert.equal((await result.json()).draw.id, "stored-server-prize")
  failure = true
  assert.equal((await api.POST(req({}))).status, 409)
  assert.equal((await claim.POST(req({ draw_id: "not-uuid", ign: "Name" }))).status, 400)
  assert.equal((await claim.POST(req({ draw_id: "11111111-1111-4111-8111-111111111111", ign: "Name", product_id: "forged" }))).status, 400)
  assert.equal(claims, 0)
  assert.equal((await claim.POST(req({ draw_id: "11111111-1111-4111-8111-111111111111", ign: "Name" }))).status, 200)
  console.log("Halloween API: session, same-origin, bounded JSON, forged reward rejection, private status and service errors OK")
}
check().catch(error => { console.error(error); process.exitCode = 1 })
