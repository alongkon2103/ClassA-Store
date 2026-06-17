// Pure logic for evaluating a discount code against an order's subtotal.
// Returns either { ok: true, ... } or { ok: false, reason }, no DB writes.

import type { discount_codes, Prisma, PrismaClient } from "@prisma/client"

// Error codes are stable identifiers that the UI maps to localized strings.
// `params` carries values for placeholders (e.g. min amount in THB).
export type DiscountErrorCode =
  | "NOT_FOUND"
  | "DISABLED"
  | "NOT_YET_ACTIVE"
  | "EXPIRED"
  | "LIMIT_REACHED"
  | "ALREADY_USED"
  | "WRONG_PRODUCT"
  | "BELOW_MIN_AMOUNT"
  | "NO_EFFECT"

export type DiscountEvaluation =
  | { ok: true; code: discount_codes; amountOff: number }
  | { ok: false; errorCode: DiscountErrorCode; params?: Record<string, number | string> }

export function evaluateDiscount(
  code: discount_codes | null,
  subtotal: number,
  productId: string,
  userUsedCount: number,
  now: Date = new Date(),
): DiscountEvaluation {
  if (!code) return { ok: false, errorCode: "NOT_FOUND" }
  if (!code.is_active) return { ok: false, errorCode: "DISABLED" }
  if (code.starts_at && now < code.starts_at) return { ok: false, errorCode: "NOT_YET_ACTIVE" }
  if (code.expires_at && now > code.expires_at) return { ok: false, errorCode: "EXPIRED" }
  if (code.max_uses !== null && code.used_count >= code.max_uses) {
    return { ok: false, errorCode: "LIMIT_REACHED" }
  }
  if (code.per_user_limit !== null && userUsedCount >= code.per_user_limit) {
    return { ok: false, errorCode: "ALREADY_USED" }
  }
  if (code.product_id && code.product_id !== productId) {
    return { ok: false, errorCode: "WRONG_PRODUCT" }
  }
  const minAmount = code.min_amount ? Number(code.min_amount) : 0
  if (subtotal < minAmount) {
    return { ok: false, errorCode: "BELOW_MIN_AMOUNT", params: { minAmount } }
  }

  let amountOff: number
  if (code.type === "fixed") {
    amountOff = Math.min(Number(code.value), subtotal)
  } else {
    amountOff = subtotal * (Number(code.value) / 100)
  }
  amountOff = Math.round(amountOff * 100) / 100
  if (amountOff <= 0) return { ok: false, errorCode: "NO_EFFECT" }

  return { ok: true, code, amountOff }
}

// Count how many times a user has actively claimed a code. We exclude
// redemptions linked to expired/cancelled orders so an abandoned checkout
// doesn't permanently lock the customer out of the code.
export async function countUserRedemptions(
  prisma: PrismaClient | Prisma.TransactionClient,
  codeId: string,
  userId: string,
): Promise<number> {
  return prisma.discount_redemptions.count({
    where: {
      discount_code_id: codeId,
      user_id: userId,
      orders: {
        status: { notIn: ["expired", "cancelled"] },
      },
    },
  })
}

// Release a discount slot tied to an order — decrements used_count on the
// code and deletes the redemption row. Idempotent: safe to call even if the
// order has no discount or has already been released. Designed to run inside
// a Prisma transaction.
export async function releaseOrderDiscount(
  tx: Prisma.TransactionClient,
  orderId: string,
): Promise<void> {
  const order = await tx.orders.findUnique({
    where: { id: orderId },
    select: { discount_code_id: true },
  })
  if (!order?.discount_code_id) return

  await tx.discount_codes.update({
    where: { id: order.discount_code_id },
    data: { used_count: { decrement: 1 } },
  })
  await tx.discount_redemptions.deleteMany({
    where: { order_id: orderId },
  })
  await tx.orders.update({
    where: { id: orderId },
    data: { discount_code_id: null, discount_amount: null },
  })
}
