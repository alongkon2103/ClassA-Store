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

  const order = await prisma.orders.findUnique({ where: { id: orderId } })
  if (!order) {
    return NextResponse.redirect(`${baseUrl}/${locale}/products`)
  }

  // PayPal didn't return a token → user backed out of the approval page.
  if (!paypalToken) {
    return NextResponse.redirect(`${baseUrl}/${locale}/orders/${orderId}?paypal=cancelled`)
  }

  // Defensive: ensure the token PayPal hands us matches the one we stored.
  if (order.paypal_order_id && order.paypal_order_id !== paypalToken) {
    return NextResponse.redirect(`${baseUrl}/${locale}/orders/${orderId}?paypal=mismatch`)
  }

  // If we already fulfilled (webhook + redirect race, or user refreshing),
  // skip straight to the order page.
  if (order.status === "paid") {
    return NextResponse.redirect(`${baseUrl}/${locale}/orders/${orderId}`)
  }

  try {
    const capture = await capturePayPalOrder(paypalToken)
    if (capture.status !== "COMPLETED") {
      return NextResponse.redirect(
        `${baseUrl}/${locale}/orders/${orderId}?paypal=failed&status=${encodeURIComponent(capture.status)}`,
      )
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
