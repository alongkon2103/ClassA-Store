import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import Stripe from "stripe"

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { productId, variantId, paymentMethod, locale = "en", whitelistUsername } = await req.json()

    if (!whitelistUsername?.trim()) {
      return NextResponse.json({ error: "In-game username is required" }, { status: 400 })
    }

    const product = await prisma.products.findUnique({
      where: { id: productId },
      include: { product_variants: true },
    })

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 })
    }

    const variant    = product.product_variants.find(v => v.id === variantId)
    const finalPrice = variant ? Number(variant.price) : Number(product.price)
    const title      = variant ? `${product.name_en} (${variant.label_en})` : product.name_en

    // เช็ค pending order เดิม
    let order = await prisma.orders.findFirst({
      where: {
        user_id:    session.user.id,
        product_id: product.id,
        variant_id: variant?.id || null,
        status:     "pending",
      },
    })

    if (!order) {
      order = await prisma.orders.create({
        data: {
          user_id:              session.user.id,
          product_id:           product.id,
          variant_id:           variant?.id,
          amount:               finalPrice,
          status:               "pending",
          payment_method:       paymentMethod ?? "promptpay",
          whitelisted_username: whitelistUsername.trim(),
          whitelist_status:     "pending",
        },
      })
    } else {
      // อัพ username ถ้ามี order เดิม
      order = await prisma.orders.update({
        where: { id: order.id },
        data:  { whitelisted_username: whitelistUsername.trim() },
      })
    }

    const protocol = req.headers.get("x-forwarded-proto") || "http"
    const host     = req.headers.get("host")
    const baseUrl  = process.env.NEXT_PUBLIC_BASE_URL || `${protocol}://${host}`

    // คำนวณราคารวม fee ถ้าจ่ายด้วยบัตร
    const cardFee    = paymentMethod === "card" ? finalPrice * 0.06 : 0
    const totalPrice = finalPrice + cardFee

    const stripeSession = await stripe.checkout.sessions.create({
      mode:                "payment",
      payment_method_types: paymentMethod === "card" ? ["card"] : ["promptpay"],
      expires_at:          Math.floor(Date.now() / 1000) + 30 * 60,

      line_items: [
        {
          price_data: {
            currency:     "thb",
            product_data: { name: title },
            unit_amount:  Math.round(totalPrice * 100),
          },
          quantity: 1,
        },
      ],

      success_url: `${baseUrl}/${locale}/orders/${order.id}`,
      cancel_url:  `${baseUrl}/${locale}/products`,

      metadata: {
        orderId:             order.id,
        productId:           product.id,
        variantId:           variant?.id || "",
        whitelistUsername:   whitelistUsername.trim(),
      },
    })

    await prisma.orders.update({
      where: { id: order.id },
      data:  { stripe_session_id: stripeSession.id },
    })

    return NextResponse.json({ url: stripeSession.url })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: "Checkout failed" }, { status: 500 })
  }
}