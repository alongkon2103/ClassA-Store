// Admin actions for the PayPal.me review queue — payments the worker could not
// auto-approve (pending/eCheck, no matching order, ambiguous, or late).
//
//   POST { action: "approve", paymentId, orderId }  → manually fulfil an order
//         and mark the payment resolved (match_status="manual").
//   POST { action: "dismiss", paymentId }           → close the case without
//         fulfilling (match_status="dismissed"). Use for spam/unrelated income.
//
// A payment is "resolved" once processed_at is set; the queue only shows
// unresolved rows. Approving is idempotent-safe: fulfillPaidOrder no-ops if the
// order is already paid, and matched_order_id is UNIQUE so one order can't be
// double-linked.

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { validateAdmin } from "@/lib/adminAuth"
import { fulfillPaidOrder } from "@/lib/orderFulfillment"

export const runtime = "nodejs"

export async function POST(req: Request) {
  const auth = await validateAdmin(["admin"])
  if (!auth.isValid) return auth.response

  const body = await req.json().catch(() => ({}))
  const { action, paymentId, orderId } = body as {
    action?: string
    paymentId?: string
    orderId?: string
  }

  if (!paymentId || (action !== "approve" && action !== "dismiss")) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }

  const payment = await prisma.paypal_payments.findUnique({ where: { id: paymentId } })
  if (!payment) {
    return NextResponse.json({ error: "Payment not found" }, { status: 404 })
  }
  if (payment.processed_at) {
    return NextResponse.json({ error: "This payment has already been resolved" }, { status: 409 })
  }

  // ── Dismiss ────────────────────────────────────────────────────────────────
  if (action === "dismiss") {
    await prisma.paypal_payments.update({
      where: { id: paymentId },
      data: { match_status: "dismissed", review_reason: "dismissed by admin", processed_at: new Date() },
    })
    return NextResponse.json({ ok: true, action: "dismissed" })
  }

  // ── Approve into a chosen order ──────────────────────────────────────────────
  if (!orderId) {
    return NextResponse.json({ error: "orderId is required to approve" }, { status: 400 })
  }

  const order = await prisma.orders.findUnique({ where: { id: orderId } })
  if (!order || order.payment_method !== "paypal_me") {
    return NextResponse.json({ error: "Order not found or not a PayPal.me order" }, { status: 404 })
  }

  // Guard: don't attach to an order that another payment already fulfilled.
  const already = await prisma.paypal_payments.findUnique({ where: { matched_order_id: orderId } })
  if (already && already.id !== paymentId) {
    return NextResponse.json(
      { error: "That order is already linked to another payment" },
      { status: 409 },
    )
  }

  try {
    await prisma.paypal_payments.update({
      where: { id: paymentId },
      data: {
        match_status: "manual",
        review_reason: `manually approved by ${auth.session?.user?.email ?? "admin"}`,
        matched_order_id: orderId,
        processed_at: new Date(),
      },
    })
  } catch (e: unknown) {
    if ((e as { code?: string })?.code === "P2002") {
      return NextResponse.json({ error: "That order is already linked to another payment" }, { status: 409 })
    }
    throw e
  }

  // Unlock: shared helper flips order→paid + upserts whitelist + Discord role.
  const result = await fulfillPaidOrder(orderId)

  return NextResponse.json({ ok: true, action: "approved", fulfillment: result, orderId })
}
