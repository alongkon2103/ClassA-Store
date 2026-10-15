// Defaults to dry-run. Never infer ownership from email or a customer's latest username.
import "dotenv/config"
import { prisma } from "../lib/prisma"
import { lookupTikkiesRoblox, type RobloxIdentity } from "../lib/integrations/tikkiesRoblox"
const args = process.argv.slice(2)
const flag = (name: string) => args.includes(`--${name}`)
const arg = (name: string) => args.find(x => x.startsWith(`--${name}=`))?.split("=").slice(1).join("=")
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
async function run() {
 if (args.some(x => !/^--(apply|dry-run|refresh)$/.test(x) && !/^--(limit|delay-ms|after|order-id)=/.test(x))) throw new Error("Unknown argument")
 const limit = Number(arg("limit") ?? 100), delay = Number(arg("delay-ms") ?? 1000)
 if (!Number.isInteger(limit) || limit < 1 || limit > 5000 || !Number.isInteger(delay) || delay < 350 || delay > 60000) throw new Error("Use limit 1–5000 and delay-ms 350–60000")
 const after = arg("after"), orderId = arg("order-id")
 if ((after && !uuid.test(after)) || (orderId && !uuid.test(orderId))) throw new Error("Invalid order cursor")
 const apply = flag("apply") && !flag("dry-run"), refresh = flag("refresh")
 const orders = await prisma.orders.findMany({ where: { products: { type: "roblox_whitelist" }, whitelisted_username: { not: null }, ...(orderId ? { id: orderId } : after ? { id: { gt: after } } : {}), ...(!refresh ? { roblox_user_id: null } : {}) }, orderBy: { id: "asc" }, take: limit, select: { id: true, whitelisted_username: true, roblox_user_id: true, roblox_resolved_for: true } })
 const cache = new Map<string, RobloxIdentity | null>()
 let changed = 0, unresolved = 0
 for (const order of orders) {
  const byId = !!order.roblox_user_id, value = order.roblox_user_id ?? order.whitelisted_username!
  const key = `${byId ? "id" : "name"}:${value.toLowerCase()}`
  let identity: RobloxIdentity | null = cache.get(key) ?? null
  if (!cache.has(key)) {
   for (let attempt = 0; attempt < 3; attempt++) {
    await wait(delay)
    try { identity = await lookupTikkiesRoblox(value, byId); break }
    catch (error) {
     const retry = error instanceof Error ? /^roblox_rate_limited:(\d+)$/.exec(error.message) : null
     if (!retry || attempt === 2) break
     await wait(Number(retry[1]) * 1000 * (attempt + 1))
    }
   }
   cache.set(key, identity)
  }
  if (!identity) { unresolved++; console.log(JSON.stringify({ orderId: order.id, result: "account_unresolved" })); continue }
  if (apply) {
   const result = await prisma.orders.updateMany({ where: { id: order.id, whitelisted_username: order.whitelisted_username, roblox_user_id: order.roblox_user_id, roblox_resolved_for: order.roblox_resolved_for }, data: { roblox_user_id: identity.userId, roblox_username: identity.username, roblox_display_name: identity.displayName, roblox_resolved_for: order.whitelisted_username!.trim().toLowerCase() } })
   changed += result.count
   console.log(JSON.stringify({ orderId: order.id, result: result.count ? "bound" : "skipped_concurrent_change" }))
  } else console.log(JSON.stringify({ orderId: order.id, result: "would_bind", robloxUserId: identity.userId }))
 }
 console.log(JSON.stringify({ mode: apply ? "apply" : "dry-run", scanned: orders.length, changed, unresolved, nextCursor: orders.at(-1)?.id ?? null }))
}
run().catch(()=>{ console.error("Backfill failed; no secrets or customer data logged. Check database/configuration.");process.exitCode=1 }).finally(()=>prisma.$disconnect())
