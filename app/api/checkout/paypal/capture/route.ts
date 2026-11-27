// PayPal return URL. The user lands here from PayPal after approving payment.
// We capture the order, mark our local order as paid (via the shared
// fulfillment helper), then redirect them into the order page so they see the
// success state. PayPal sends ?token=<paypal_order_id>&PayerID=<id> alongside
// our own orderId query param.
//
// Failure modes we handle without showing a stack trace:
//   - missing/mismatched orderId  → /products
//   - capture API failure         → /orders/<id>?paypal=failed
//   - already paid (replay)       → /orders/<id> (no-op)
//   - user cancelled (no token)   → /orders/<id>?paypal=cancelled

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { capturePayPalOrder } from "@/lib/paypal"
import { fulfillPaidOrder } from "@/lib/orderFulfillment"

export const runtime = "nodejs"

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const orderId = url.searchParams.get("orderId")
  const paypalToken = url.searchParams.get("token")
  const locale = url.searchParams.get("locale") || "en"

  const protocol = req.headers.get("x-forwarded-proto") || "http"
  const host = req.headers.get("host")
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `${protocol}://${host}`

  if (!orderId) {
    return NextResponse.redirect(`${baseUrl}/${locale}/products`)
  }

  const order = await prisma.orders.findUnique({ where: { id: orderId }, include: { products: { select: { type: true } } } })
  if (!order) {
    return NextResponse.redirect(`${baseUrl}/${locale}/products`)
  }

  // PayPal didn't return a token → user backed out of the approval page.
  if (!paypalToken) {
    return NextResponse.redirect(`${baseUrl}/${locale}/orders/${orderId}?paypal=cancelled`)
  }

  // Bind the provider token to the monetary parent; a missing ID never matches.
  if (order.bundle_parent_id || order.payment_method !== "paypal" || !order.paypal_order_id || order.paypal_order_id !== paypalToken) {
    return NextResponse.redirect(`${baseUrl}/${locale}/orders/${orderId}?paypal=mismatch`)
  }

  // If we already fulfilled (webhook + redirect race, or user refreshing),
  // skip straight to the order page.
  if (["paid", "refunded", "revoked", "cancelled", "disputed", "expired"].includes(order.status)) {
    return NextResponse.redirect(`${baseUrl}/${locale}/orders/${orderId}`)
  }

  try {
    const capture = await capturePayPalOrder(paypalToken)
    if (capture.status !== "COMPLETED") {
      return NextResponse.redirect(
        `${baseUrl}/${locale}/orders/${orderId}?paypal=failed&status=${encodeURIComponent(capture.status)}`,
      )
    }

    // Bundle provider terms are frozen at checkout. Never grant a collection
    // for a different currency/amount, even when the provider reports COMPLETED.
    if (order.products.type === "bundle") {
      const expected = Number(order.expected_amount)
      const received = capture.amount ? Number(capture.amount.value) : NaN
      if (order.expected_amount === null || !Number.isFinite(expected) || expected <= 0 ||
        !capture.amount || !/^\d+(?:\.\d{1,2})?$/.test(capture.amount.value) || !Number.isFinite(received) || received !== expected ||
        !order.expected_currency || capture.amount.currency !== order.expected_currency) {
        return NextResponse.redirect(`${baseUrl}/${locale}/orders/${orderId}?paypal=mismatch`)
      }
    }

    if (capture.captureId) {
      await prisma.orders.update({
        where: { id: orderId },
        data: { paypal_capture_id: capture.captureId },
      })
    }

    const result = await fulfillPaidOrder(orderId)
    if (result === "missing") {
      return NextResponse.redirect(`${baseUrl}/${locale}/products`)
    }

    return NextResponse.redirect(`${baseUrl}/${locale}/orders/${orderId}`)
  } catch (err: unknown) {
    console.error("PayPal capture error:", (err as Error)?.message || err)
    return NextResponse.redirect(`${baseUrl}/${locale}/orders/${orderId}?paypal=failed`)
  }
}
