import assert from "node:assert/strict"
import { prepareBundleCheckout } from "../lib/bundleCheckout"

const id = "11111111-1111-4111-8111-111111111111"
const ids = ["22222222-2222-4222-8222-222222222222", "33333333-3333-4333-8333-333333333333"]
const product = { id, type: "bundle", is_active: true, bundle_product_ids: ids }
const variant = { id, product_id: id, is_active: true, variant_type: "normal", duration_type: "days", duration_days: 30 }
const db = { products: { findMany: async () => ids.map(productId => ({ id: productId, type: "roblox_whitelist", is_active: true, is_consignment: false, name_th: "เกม", name_en: "Game" })) } }
async function main() {
  assert.equal(await prepareBundleCheckout(db as never, { ...product, type: "roblox_whitelist" }, variant, { buyerRole: "admin", username: "Player123" }), undefined)
  await assert.rejects(() => prepareBundleCheckout(db as never, product, variant, { buyerRole: "admin", username: "Player123", premium: true }))
  await assert.rejects(() => prepareBundleCheckout(db as never, product, variant, { buyerRole: "admin", username: "bad username" }))
  await assert.rejects(() => prepareBundleCheckout(db as never, product, null, { buyerRole: "admin", username: "Player123" }))
  const snapshot = await prepareBundleCheckout(db as never, product, variant, { buyerRole: "admin", username: "Player123" })
  assert.equal(snapshot?.items.length, 2)
  assert.equal(snapshot?.durationDays, 30)
  console.log("PASS bundle checkout: selected active variant, no premium, Roblox input, frozen contents and normal product compatibility")
}
main().catch(error => { console.error(error); process.exitCode = 1 })
