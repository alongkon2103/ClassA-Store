import { prisma } from "./prisma"
import { fulfillBundleInTransaction } from "./bundleFulfillment"
import { parseBundleSnapshot } from "./bundles"
import { resolveTikkiesBinding } from "./integrations/tikkiesRoblox"
import { prepareAffiliateEarning } from "./affiliateEarnings"
import { awardPointsForOrder } from "./points"
import { notify } from "./notifications"
import { retryAbortedTransaction } from "./transactionRetry"

/** Monetary effects belong only to the parent. All grants commit together. */
export async function fulfillPaidBundleOrder(orderId: string): Promise<"ok" | "already_paid" | "missing"> {
  const parent = await prisma.orders.findUnique({ where: { id: orderId }, include: { products: true, product_variants: true } })
  if (!parent) return "missing"
  if (parent.products.type !== "bundle" || parent.bundle_parent_id) return "missing"
  if (["paid", "refunded", "revoked", "cancelled", "disputed", "expired"].includes(parent.status)) return "already_paid"
  const snapshot = parseBundleSnapshot(parent.bundle_snapshot)
  const robloxBinding = snapshot.items.some(item => item.type === "roblox_whitelist")
    ? await resolveTikkiesBinding(parent.whitelisted_username, parent) : {}
  const earning = await prepareAffiliateEarning(parent)
  const result = await retryAbortedTransaction(() => prisma.$transaction(async tx => {
    const outcome = await fulfillBundleInTransaction(tx, orderId, { robloxBinding })
    if (outcome !== "ok") return outcome
    if (parent.variant_id && parent.products.has_limited_discount && Number(parent.product_variants?.discount_pct) > 0) {
      await tx.product_variants.updateMany({ where: { id: parent.variant_id, discount_used: { lt: parent.product_variants?.discount_limit ?? 0 } }, data: { discount_used: { increment: 1 } } })
    }
    if (earning) await tx.affiliate_earnings.create({ data: earning })
    return outcome
  }, { maxWait: 10000, timeout: 60000 }))
  if (result === "ok") {
    await awardPointsForOrder(orderId)
    if (earning) await notify({ userId: earning.affiliate_user_id, type: "commission_earned", data: { amount: Number(earning.commission_amount) }, link: "/affiliate" })
  }
  return result
}
