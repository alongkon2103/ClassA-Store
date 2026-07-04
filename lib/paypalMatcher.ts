// Amount-only matcher for verified+parsed PayPal payments. This is where the
// safety rules from the spec live, because the amount is the ONLY link between a
// payment and an order:
//
//   auto-approve ONLY when: status=completed AND exactly ONE active paypal_me
//   order has this exact gross+currency AND the txn hasn't been processed before.
//
//   Everything else goes to the review queue (a paypal_payments row with
//   match_status != 'matched'): pending/eCheck, no matching order, >1 match, or a
//   payment that arrived after its order already expired (late).
//
// Idempotency: paypal_payments.txn_id is UNIQUE — one transaction is processed
// exactly once, so replays / double emails can't double-unlock.

import { prisma } from "@/lib/prisma"
import { fulfillPaidOrder } from "@/lib/orderFulfillment"
import type { ParsedPayPalPayment } from "@/lib/paypalMailParse"

export type MatchOutcome =
  | "matched"
  | "pending"
  | "no_order"
  | "ambiguous"
  | "late"
  | "duplicate"

export type MatchResult = { outcome: MatchOutcome; orderId?: string; reason?: string }

export async function matchAndProcessPayment(
  parsed: ParsedPayPalPayment,
  meta: { gmailMessageId: string },
): Promise<MatchResult> {
  if (!parsed.ok || parsed.grossAmount == null || !parsed.currency || !parsed.txnId) {
    return { outcome: "no_order", reason: "unparseable payment" }
  }
  const txnId = parsed.txnId
  const gross = parsed.grossAmount
  const currency = parsed.currency

  // 1. Idempotency — never process the same transaction twice.
  const existing = await prisma.paypal_payments.findUnique({ where: { txn_id: txnId } })
  if (existing) {
    return { outcome: "duplicate", orderId: existing.matched_order_id ?? undefined }
  }

  // Records the payment row = idempotency ledger + review queue entry. Returns
  // false if a concurrent pass already inserted it (unique txn_id).
  const record = async (
    match_status: Exclude<MatchOutcome, "duplicate">,
    matchedOrderId: string | null,
    reviewReason: string | null,
  ): Promise<boolean> => {
    try {
      await prisma.paypal_payments.create({
        data: {
          txn_id: txnId,
          gmail_message_id: meta.gmailMessageId,
          gross_amount: gross,
          currency,
          sender_name: parsed.payerName ?? null,
          payment_status: parsed.status,
          match_status,
          review_reason: reviewReason,
          matched_order_id: matchedOrderId,
          processed_at: match_status === "matched" ? new Date() : null,
        },
      })
      return true
    } catch (e: unknown) {
      if ((e as { code?: string })?.code === "P2002") return false // raced
      throw e
    }
  }

  // 2. Only completed payments can auto-unlock; pending/eCheck → review.
  if (parsed.status !== "completed") {
    await record("pending", null, `payment status is "${parsed.status}", not completed`)
    return { outcome: "pending" }
  }

  const now = new Date()

  // 3. Exactly-one ACTIVE order with this exact gross + currency?
  const active = await prisma.orders.findMany({
    where: {
      payment_method: "paypal_me",
      status: "pending",
      expected_currency: currency,
      expected_amount: gross,
      expires_at: { gt: now },
    },
    select: { id: true },
  })

  if (active.length > 1) {
    await record("ambiguous", null, `${active.length} active orders share this amount`)
    return { outcome: "ambiguous" }
  }

  if (active.length === 1) {
    const orderId = active[0].id
    const inserted = await record("matched", orderId, null)
    if (!inserted) return { outcome: "duplicate", orderId } // lost the race — someone else fulfilled
    // 4. Unlock: shared helper flips order→paid + upserts user_whitelist_access
    //    + Discord role. Idempotent, so safe even if called twice.
    await fulfillPaidOrder(orderId)
    return { outcome: "matched", orderId }
  }

  // 0 active — was there an order with this amount that already expired? (late payment)
  const expired = await prisma.orders.findFirst({
    where: {
      payment_method: "paypal_me",
      status: "pending",
      expected_currency: currency,
      expected_amount: gross,
      expires_at: { lte: now },
    },
    orderBy: { expires_at: "desc" },
    select: { id: true },
  })
  if (expired) {
    await record("late", expired.id, "payment arrived after the order expired")
    return { outcome: "late", orderId: expired.id }
  }

  // No order at all with this amount → money in with nothing to fulfil.
  await record("no_order", null, "no order matches this amount")
  return { outcome: "no_order" }
}
