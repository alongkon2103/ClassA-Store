import assert from "node:assert/strict"
import type { ParsedPayPalPayment } from "../lib/paypalMailParse"

let ledger: Record<string, any> | null = null
let productType = "bundle", orderStatus = "pending", fail = false, fulfillmentCalls = 0, grants = 0
const db = {
  paypal_payments: {
    findUnique: async () => ledger,
    create: async ({ data }: any) => { ledger = { id: "payment", ...data }; return ledger },
    update: async ({ data }: any) => { Object.assign(ledger!, data); return ledger },
    updateMany: async ({ where, data }: any) => {
      if (ledger && ledger.txn_id === where.txn_id) { Object.assign(ledger, data); return { count: 1 } }
      return { count: 0 }
    },
  },
  orders: {
    findMany: async () => [{ id: "parent" }],
    findUnique: async () => ({ id: "parent", status: orderStatus, products: { type: productType }, bundle_parent_id: null }),
    findFirst: async () => null,
  },
}
function stub(name: string, exports: unknown) { const file = require.resolve(name); require.cache[file] = { id: file, filename: file, loaded: true, exports } as NodeModule }
stub("../lib/prisma", { prisma: db })
stub("../lib/orderFulfillment", { fulfillPaidOrder: async () => {
  fulfillmentCalls++
  if (fail) throw new Error("private_database_detail")
  if (orderStatus === "paid") return "already_paid"
  orderStatus = "paid"; grants++; return "ok"
} })
const { matchAndProcessPayment } = require("../lib/paypalMatcher") as typeof import("../lib/paypalMatcher")
const parsed: ParsedPayPalPayment = { ok: true, grossAmount: 20, currency: "USD", txnId: "verified-txn", payerName: "Buyer", status: "completed" }
const meta = { gmailMessageId: "verified-email" }
async function main() {
  ledger = { id: "payment", txn_id: parsed.txnId, match_status: "matched", matched_order_id: "parent", processed_at: new Date(), payment_status: "completed" }
  await matchAndProcessPayment(parsed, meta)
  assert.equal(fulfillmentCalls, 1, "Replay retries a matched pending bundle")
  assert.equal(grants, 1)
  await matchAndProcessPayment(parsed, meta)
  assert.equal(fulfillmentCalls, 1, "Paid bundle replay does not fulfill twice")
  productType = "roblox_whitelist"; orderStatus = "pending"
  await matchAndProcessPayment(parsed, meta)
  assert.equal(fulfillmentCalls, 1, "Nonbundle duplicate behavior is preserved")
  productType = "bundle"; fail = true
  const retryFailure = await matchAndProcessPayment(parsed, meta)
  assert.equal(retryFailure.outcome, "no_order")
  assert.equal(ledger!.match_status, "no_order")
  assert.equal(ledger!.processed_at, null, "Retry failure is visible in admin review")
  assert.match(ledger!.review_reason, /bundle.*fulfillment|fulfillment.*bundle/i)
  assert.equal(JSON.stringify(ledger).includes("private_database_detail"), false)
  ledger = null
  const initialFailure = await matchAndProcessPayment(parsed, meta)
  assert.equal(initialFailure.outcome, "no_order")
  assert.equal(ledger!.processed_at, null, "Initial bundle failure is visible in review")
  assert.equal(ledger!.matched_order_id, "parent", "Keep the verified order association for review")
  ledger = null; productType = "roblox_whitelist"
  await assert.rejects(matchAndProcessPayment(parsed, meta), /private_database_detail/, "Preserve ordinary fulfillment failure behavior")
  assert.equal(ledger!.match_status, "matched")
  console.log("PASS bundle PayPal.me retries: pending replay, paid no-op, reviewable initial/retry failure, unchanged ordinary payments")
}
main().catch(error => { console.error(error); process.exitCode = 1 })
