// Pure logic for evaluating a discount code against an order's subtotal.
// Returns either { ok: true, ... } or { ok: false, reason }, no DB writes.

import type { discount_codes, Prisma, PrismaClient } from "@prisma/client"

// Lightweight, DB-free version of the discount math for PREVIEW only (shop
// card strikethrough + modal auto-select). Takes plain numbers so it can run
// on both the server (card) and the client (modal) with no Prisma types.
// The authoritative amount is still recomputed server-side at checkout via
// evaluateDiscount — this never drives what the customer is actually charged.
export function previewDiscountAmount(
  code: { type: string; value: number; minAmount?: number | null },
  subtotal: number,
): number {
  if (!(subtotal > 0)) return 0
  const min = code.minAmount ?? 0
  if (subtotal < min) return 0
  let off = code.type === "fixed" ? Math.min(code.value, subtotal) : subtotal * (code.value / 100)
  off = Math.round(off * 100) / 100
  return off > 0 ? off : 0
}

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

// A candidate code for auto-selection (shop card / modal open). Normalized so
// both the server (raw discount_codes rows) and the client (public API shape)
// can feed the same picker.
export type AutoCodeCandidate = {
  code: string
  type: string
  value: number
  minAmount?: number | null
  isAutoSelect: boolean
  soldOut?: boolean
  alreadyUsed?: boolean
}

// Pick the auto-select code that gives the LARGEST discount for this subtotal
// (the user's chosen "biggest discount wins" rule). Skips codes that aren't
// auto, are sold out, already used by this shopper, or don't apply to the
// amount (below min / zero effect). Deterministic: on a tie the first
// candidate wins, so callers should pre-sort (e.g. newest first).
export function pickBestAutoCode(
  candidates: AutoCodeCandidate[],
  subtotal: number,
): { code: string; amountOff: number } | null {
  let best: { code: string; amountOff: number } | null = null
  for (const c of candidates) {
    if (!c.isAutoSelect || c.soldOut || c.alreadyUsed) continue
    const off = previewDiscountAmount(c, subtotal)
    if (off <= 0) continue
    if (!best || off > best.amountOff) best = { code: c.code, amountOff: off }
  }
  return best
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
