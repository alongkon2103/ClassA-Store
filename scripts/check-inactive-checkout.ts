import assert from "node:assert/strict"
import { NextRequest } from "next/server"

function stub(name: string, exports: unknown) {
  const file = require.resolve(name)
  require.cache[file] = { id: file, filename: file, loaded: true, exports } as NodeModule
}

const variant = { id: "variant", product_id: "game", label_en: "Permanent", price: 100, variant_type: "normal" }
const game = { id: "game", name_en: "Dance", type: "roblox_whitelist", price: 100, is_active: false,
  product_variants: [variant, { ...variant, variant_type: "premium", premium_addon_price: 50 }] }
const existing = { id: "order", user_id: "buyer", product_id: game.id, products: game, product_variants: variant,
  status: "pending", payment_method: "paypal", paypal_order_id: "provider", amount: 100 }
const effects: string[] = []
function observed<T>(operation: string, result: T) {
  effects.push(operation)
  return result
}
type Availability = { is_active?: boolean }
function matches(filter?: Availability) {
  return filter?.is_active === undefined || filter.is_active === game.is_active
}
const db = {
  products: { findUnique: async ({ where }: { where: Availability }) => matches(where) ? game : null },
  product_variants: { findUnique: async () => variant },
  game_keys: { count: async () => 1 },
  orders: {
    findUnique: async ({ where }: { where: { products?: Availability } }) => matches(where.products) ? existing : null,
    findFirst: async () => null,
    findMany: async () => [],
    create: async () => observed("order", { id: existing.id }),
    update: async () => observed("update", {}),
  },
  user_whitelist_access: { upsert: async () => observed("grant", {}) },
  system_configs: {
    findMany: async () => [{ key: "payment_paypal_me_enabled", value: "true" }],
    findUnique: async () => ({ value: "THB" }),
  },
  $transaction: async (work: (tx: unknown) => unknown) => work(db),
}
stub("../lib/prisma", { prisma: db })
stub("next-auth", { getServerSession: async () => ({ user: { id: "buyer", role: "user" } }) })
stub("../lib/auth", { authOptions: {} })
stub("stripe", { __esModule: true, default: class {
  checkout = { sessions: { create: async () => observed("stripe", { id: "session", url: "https://pay.test" }) } }
} })
stub("../lib/paypal", {
  createPayPalOrder: async () => observed("paypal", { id: "provider", approveUrl: "https://pay.test" }),
  getThbToUsdRate: async () => 0.03,
  convertThbToUsd: (amount: number, rate: number) => amount * rate,
  capturePayPalOrder: async () => observed("capture", { status: "DECLINED" }),
})
globalThis.fetch = async (url) => {
  assert.equal(String(url), "https://users.roblox.com/v1/usernames/users")
  return observed("roblox", Response.json({ data: [{ id: 1234, name: "Test_Player", displayName: "Tester" }] }))
}

const body = { productId: game.id, variantId: variant.id, whitelistUsername: "Test_Player", paymentMethod: "card",
  orderId: existing.id, product_id: game.id, variant_id: variant.id }
const routes = [
  { name: "checkout", effects: ["order", "stripe", "update"] },
  { name: "checkout/paypal", effects: ["order", "paypal", "update"] },
  { name: "checkout/paypal-me", effects: ["order"] },
  { name: "checkout/trial", effects: ["roblox", "order", "grant"] },
  { name: "orders/create", effects: ["order"], status: 201 },
  { name: "checkout/paypal/retry", effects: ["paypal", "update"] },
  { name: "orders/[id]/upgrade", effects: ["stripe"] },
  { name: "checkout/paypal/capture", effects: ["capture"], status: 307 },
]

async function main() {
  const failures: string[] = []
  for (const active of [true, false]) {
    game.is_active = active
    for (const route of routes) {
      const handler = require("../app/api/" + route.name + "/route")
      const url = "https://store.test/api/" + route.name
      const capture = route.name.endsWith("/capture")
      const result = capture
        ? await handler.GET(new NextRequest(url + "?orderId=order&token=provider", { headers: { host: "store.test" } }))
        : await handler.POST(new NextRequest(url, { method: "POST", body: JSON.stringify(body) }), { params: Promise.resolve({ id: existing.id }) })
      const observedEffects = effects.splice(0)
      try {
        // Approved payment returns still settle after delisting. Guards apply to new sales.
        assert.deepEqual(observedEffects, active || capture ? route.effects : [])
        assert.equal(result.status, active ? route.status ?? 200 : capture ? 307 : 404)
      } catch (error) { failures.push(route.name + " active=" + active + ": " + String(error)) }
    }
  }
  assert.deepEqual(failures, [])
  console.log("PASS inactive products cannot initiate orders, trials, or payments; active route behavior preserved")
}
main().catch(error => { console.error(error); process.exitCode = 1 })
