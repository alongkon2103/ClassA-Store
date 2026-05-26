// app/api/checkout/route.ts

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

    // 1. รับค่า isPremium เพิ่มเข้ามา
    const { productId, variantId, paymentMethod, locale = "en", whitelistUsername, isPremium } = await req.json()

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

    // 2. ค้นหา Variant หลักที่เลือก
    const variant = product.product_variants.find(v => v.id === variantId)
    let basePrice = variant ? Number(variant.price) : Number(product.price)
    let title = variant ? `${product.name_en} (${variant.label_en})` : product.name_en

    // 3. จัดการเรื่อง Premium Add-on
    let premiumPrice = 0
    if (isPremium) {
      const premiumVar = product.product_variants.find(v => v.variant_type === "premium")
      if (premiumVar) {
        premiumPrice = Number(premiumVar.premium_addon_price || 0)
        title += " + PREMIUM"
      }
    }

    const currentSubtotal = basePrice + premiumPrice

    // 4. ✅ คำนวณราคารวมค่าธรรมเนียมก่อน เพื่อให้ order ในฐานข้อมูลได้ราคาที่ถูกต้อง
    const cardFee = paymentMethod === "card" ? currentSubtotal * 0.06 : 0
    const totalPrice = currentSubtotal + cardFee

    // 5. เช็ค pending order เดิม
    let order = await prisma.orders.findFirst({
      where: {
        user_id: session.user.id,
        product_id: product.id,
        variant_id: variant?.id || null,
        status: "pending",
        payment_method: paymentMethod,
      },
    })

    if (!order) {
      order = await prisma.orders.create({
        data: {
          user_id: session.user.id,
          product_id: product.id,
          variant_id: variant?.id,
          amount: totalPrice, 
          status: "pending",
          payment_method: paymentMethod ?? "promptpay",
          whitelisted_username: whitelistUsername.trim(),
          whitelist_status: "pending",
          // is_premium: isPremium,
        },
      })
    } else {
      order = await prisma.orders.update({
        where: { id: order.id },
        data: {
          whitelisted_username: whitelistUsername.trim(),
          amount: totalPrice, 
          payment_method: paymentMethod,
        },
      })
    }

    const protocol = req.headers.get("x-forwarded-proto") || "http"
    const host = req.headers.get("host")
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `${protocol}://${host}`

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
              description: isPremium ? "Included Premium Add-on" : undefined
            },
            unit_amount: Math.round(totalPrice * 100),
          },
          quantity: 1,
        },
      ],

      success_url: `${baseUrl}/${locale}/orders/${order.id}`,
      cancel_url: `${baseUrl}/${locale}/products`,

      metadata: {
        orderId: order.id,
        productId: product.id,
        variantId: variant?.id || "",
        whitelistUsername: whitelistUsername.trim(),
        isPremium: isPremium ? "true" : "false",
      },
    })

    await prisma.orders.update({
      where: { id: order.id },
      data: { stripe_session_id: stripeSession.id },
    })

    return NextResponse.json({ url: stripeSession.url })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: "Checkout failed" }, { status: 500 })
  }
}