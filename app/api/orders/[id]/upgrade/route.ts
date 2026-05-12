import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import Stripe from "stripe"

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const { paymentMethod, locale = "en" } = await req.json()

    // 1. Find the existing order
    const order = await prisma.orders.findUnique({
      where: { id },
      include: {
        products: {
          include: {
            product_variants: true,
          },
        },
        product_variants: true, // variant ที่ลูกค้าเลือกตอนสั่งซื้อ
      },
    })

    if (!order || order.user_id !== session.user.id) {
      return NextResponse.json(
        { error: "Order not found" },
        { status: 404 }
      )
    }

    if (order.is_premium_order) {
      return NextResponse.json(
        { error: "Already premium" },
        { status: 400 }
      )
    }

    // หา variant_type = "premium" ของสินค้านี้
    const premiumAddonPrice = Number(
      order.products?.product_variants?.find(
        (variant) => variant.variant_type === "premium"
      )?.premium_addon_price ?? 0
    )
    if (premiumAddonPrice <= 0) {
      return NextResponse.json({ error: "No premium addon available for this product" }, { status: 400 })
    }

    const title = `Upgrade to Premium - ${order.products.name_en}`
    const protocol = req.headers.get("x-forwarded-proto") || "http"
    const host = req.headers.get("host")
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `${protocol}://${host}`

    // 3. Calculate price with Stripe fee if card
    const cardFee = paymentMethod === "card" ? premiumAddonPrice * 0.06 : 0
    const totalPrice = premiumAddonPrice + cardFee

    // 4. Create Stripe Session
    const stripeSession = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: paymentMethod === "card" ? ["card"] : ["promptpay"],
      expires_at: Math.floor(Date.now() / 1000) + 30 * 60,

      line_items: [
        {
          price_data: {
            currency: "thb",
            product_data: {
              name: title,
              description: "Lifetime Premium Access Unlock"
            },
            unit_amount: Math.round(totalPrice * 100),
          },
          quantity: 1,
        },
      ],

      success_url: `${baseUrl}/${locale}/orders/${order.id}/settings?upgrade=success`,
      cancel_url: `${baseUrl}/${locale}/orders/${order.id}/settings`,

      metadata: {
        orderId: order.id,
        productId: order.product_id,
        isUpgrade: "true",
      },
    })

    return NextResponse.json({ url: stripeSession.url })

  } catch (err) {
    console.error("Upgrade error:", err)
    return NextResponse.json({ error: "Checkout failed" }, { status: 500 })
  }
}
