// Re-create a PayPal approval session for an existing pending PayPal order.
// Use case: user cancelled or had insufficient funds in PayPal, lands back
// on the order page with ?paypal=cancelled|failed, and clicks "Pay again".
//
// We never re-reserve discount codes or recompute totals — the order row
// already has its locked-in amount and discount. We only:
//   1. validate ownership + that it's a pending PayPal order
//   2. create a fresh PayPal order with the same amount
//   3. write the new paypal_order_id back to our row
//   4. return the new approveUrl

import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { createPayPalOrder, getThbToUsdRate, convertThbToUsd } from "@/lib/paypal"

export const runtime = "nodejs"

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const { orderId, locale = "en" } = (await req.json().catch(() => ({}))) as {
      orderId?: string
      locale?: string
    }
    if (!orderId) {
      return NextResponse.json({ error: "orderId required" }, { status: 400 })
    }

    const order = await prisma.orders.findUnique({
      where: { id: orderId },
      include: { products: true, product_variants: true },
    })
    if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 })
    if (order.user_id !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    if (order.payment_method !== "paypal") {
      return NextResponse.json({ error: "Not a PayPal order" }, { status: 400 })
    }
    if (order.status !== "pending") {
      return NextResponse.json({ error: "Order is not pending" }, { status: 400 })
    }

    const totalThb = Number(order.amount)
    const rate = await getThbToUsdRate()
    const usdAmount = convertThbToUsd(totalThb, rate)
    if (!Number.isFinite(usdAmount) || usdAmount <= 0) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 })
    }

    const title =
      order.product_variants
        ? `${order.products.name_en} (${order.product_variants.label_en})`
        : order.products.name_en || "Order"

    const protocol = req.headers.get("x-forwarded-proto") || "http"
    const host = req.headers.get("host")
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `${protocol}://${host}`

    const currency = process.env.PAYPAL_CURRENCY || "USD"
    const returnUrl = `${baseUrl}/api/checkout/paypal/capture?orderId=${order.id}&locale=${encodeURIComponent(locale)}`
    const cancelUrl = `${baseUrl}/${locale}/orders/${order.id}?paypal=cancelled`

    const paypal = await createPayPalOrder({
      amount: usdAmount,
      currency,
      description: title,
      customId: order.id,
      returnUrl,
      cancelUrl,
    })

    // Extend the pending window so the new PayPal approval has time to complete
    // even if the original expires_at was about to lapse.
    await prisma.orders.update({
      where: { id: order.id },
      data: {
        paypal_order_id: paypal.id,
        expires_at: new Date(Date.now() + 60 * 60 * 1000),
      },
    })

    return NextResponse.json({ url: paypal.approveUrl })
  } catch (err: unknown) {
    console.error("PayPal Retry Error:", (err as Error)?.message || err)
    return NextResponse.json({ error: "Retry failed", details: (err as Error)?.message }, { status: 500 })
  }
}
