// Affiliate commission capture — the money-critical core of the affiliate
// program. When a paid order carries an affiliate's discount code, the code's
// owner earns a commission, FROZEN into affiliate_earnings at fulfillment time.
//
// Called from every real fulfillment path so no channel is missed:
//   - lib/orderFulfillment.ts   (PayPal REST, PayPal.me, admin paypal-review)
//   - app/api/webhook/route.ts  (Stripe card / promptpay — has its own inline
//                                fulfillment that does NOT call fulfillPaidOrder)
//
// Design invariants (see the /grill-me design session):
//   • Base = product revenue = order.amount with the payment fee removed
//     (amount = subtotalAfterDiscount * (1 + fee%/100), so base = amount / (1+fee%)).
//     Commission is NOT paid on the gateway fee, nor on the discount the code
//     already gave the customer.
//   • Rate = code.commission_pct ?? profile.default_commission_pct.
//   • Self-purchase (buyer == code owner) earns the discount but NO commission.
//   • Frozen amounts → later rate edits never change past earnings.
//   • order_id is UNIQUE on affiliate_earnings → never double-credit; the
//     create is added to the same transaction that flips the order to paid.

import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { getPaymentConfig, type PaymentConfig, type PaymentMethodKey } from "@/lib/paymentConfig"

const round2 = (n: number) => Math.round(n * 100) / 100

// Map an order.payment_method to a config key. Unknown methods (admin_manual,
// free_trial, legacy 'stripe' default) carry no configured surcharge → fee 0,
// so base = amount (the recorded figure IS the revenue).
function feePctForMethod(method: string | null | undefined, cfg: PaymentConfig): number {
  const key = method as PaymentMethodKey
  if (key === "card" || key === "promptpay" || key === "paypal" || key === "paypal_me") {
    return cfg[key].fee_pct
  }
  return 0
}

type EarningOrderInput = {
  id: string
  user_id: string | null
  discount_code_id: string | null
  referral_code_id: string | null
  product_id: string
  amount: Prisma.Decimal | number
  payment_method: string | null
  order_type: string
}

// Resolve a /r/<code> referral into a code id to store on the order — ONLY when
// it's an active affiliate code whose product scope allows this product (the
// "allowed games": null scope = all products). Returns null otherwise. Called at
// checkout so referral attribution survives even when the discount isn't applied.
export async function resolveReferralCodeId(
  refCode: string | null | undefined,
  productId: string,
): Promise<string | null> {
  if (!refCode || typeof refCode !== "string") return null
  const code = await prisma.discount_codes.findUnique({
    where: { code: refCode.trim().toUpperCase() },
    select: { id: true, owner_user_id: true, product_id: true, is_active: true },
  })
  if (!code || !code.owner_user_id || code.is_active === false) return null
  if (!(code.product_id === null || code.product_id === productId)) return null
  return code.id
}

// Compute the frozen earning row for an order, or null if it earns nothing.
// Pure reads (code owner, profile, fee config) — safe to run BEFORE opening the
// fulfillment transaction, then feed the returned data into that transaction.
//
// Attribution order: (1) the applied discount code IF it belongs to an affiliate;
// (2) else the referral code from the buyer's /r/<code> link, IF its product
// scope allows this product. This lets an affiliate earn on their allowed
// game(s) even when the customer didn't use the discount.
export async function prepareAffiliateEarning(
  order: EarningOrderInput,
): Promise<Prisma.affiliate_earningsCreateManyInput | null> {
  if (order.order_type === "TRIAL") return null // ฿0 giveaways never earn

  const amount = Number(order.amount)
  if (!(amount > 0)) return null

  type CodeRow = { id: string; owner_user_id: string | null; commission_pct: Prisma.Decimal | null; product_id: string | null }
  let code: CodeRow | null = null

  // 1) Applied discount code, if it's an affiliate code.
  if (order.discount_code_id) {
    const dc = await prisma.discount_codes.findUnique({
      where: { id: order.discount_code_id },
      select: { id: true, owner_user_id: true, commission_pct: true, product_id: true },
    })
    if (dc?.owner_user_id) code = dc
  }
  // 2) Fall back to the referral code, scope-checked against this product.
  if (!code && order.referral_code_id) {
    const rc = await prisma.discount_codes.findUnique({
      where: { id: order.referral_code_id },
      select: { id: true, owner_user_id: true, commission_pct: true, product_id: true },
    })
    if (rc?.owner_user_id && (rc.product_id === null || rc.product_id === order.product_id)) code = rc
  }
  if (!code?.owner_user_id) return null // no affiliate attribution

  // Self-purchase: affiliate keeps the discount but earns no commission.
  if (order.user_id && code.owner_user_id === order.user_id) return null

  const profile = await prisma.affiliate_profiles.findUnique({
    where: { user_id: code.owner_user_id },
    select: { default_commission_pct: true, is_active: true },
  })
  // Paused affiliate → stop accruing new commissions.
  if (profile && profile.is_active === false) return null

  const pct =
    code.commission_pct != null
      ? Number(code.commission_pct)
      : profile
        ? Number(profile.default_commission_pct)
        : 0
  if (!(pct > 0)) return null

  const cfg = await getPaymentConfig()
  const feePct = feePctForMethod(order.payment_method, cfg)
  const base = round2(amount / (1 + feePct / 100))
  const commission = round2((base * pct) / 100)
  if (!(base > 0) || !(commission > 0)) return null

  return {
    affiliate_user_id: code.owner_user_id,
    order_id: order.id,
    discount_code_id: code.id, // the code that earned (applied discount OR referral)
    base_amount: base,
    commission_pct: pct,
    commission_amount: commission,
    status: "pending",
  }
}

// Reverse an order's earning when the order is later cancelled/undone. Runs
// inside the caller's transaction. Idempotent; no-op when there's no earning or
// it's already reversed. A reversal of an ALREADY-PAID earning sets clawback=true
// so the admin can see money that must be recovered.
export async function reverseAffiliateEarning(
  tx: Prisma.TransactionClient,
  orderId: string,
): Promise<void> {
  const earning = await tx.affiliate_earnings.findUnique({
    where: { order_id: orderId },
    select: { id: true, status: true },
  })
  if (!earning || earning.status === "reversed") return

  await tx.affiliate_earnings.update({
    where: { id: earning.id },
    data: {
      status: "reversed",
      reversed_at: new Date(),
      clawback: earning.status === "paid",
    },
  })
}
