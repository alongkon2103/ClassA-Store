import Stripe from "stripe"
import { headers } from "next/headers"
import { prisma } from "@/lib/prisma"
import { NextRequest } from "next/server"

// ✅ บอก Next.js ไม่ต้อง parse body
export const runtime = "nodejs"

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET!

export async function POST(req: NextRequest) {
  const body = await req.text()  // ✅ ต้องเป็น raw text
  const headersList = await headers()
  const sig = headersList.get("stripe-signature")

  if (!sig) {
    console.error("No stripe-signature header")
    return new Response("No signature", { status: 400 })
  }

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(body, sig, endpointSecret)
  } catch (err: any) {
    console.error("Webhook signature error:", err.message)
    return new Response(`Webhook Error: ${err.message}`, { status: 400 })
  }

  console.log("Webhook event received:", event.type)

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session
    const paymentIntent = await stripe.paymentIntents.retrieve(
      session.payment_intent as string
    )
    const actualMethod = paymentIntent.payment_method_types?.[0] ?? "card"

    console.log("Session metadata:", session.metadata)
    console.log("Payment status:", session.payment_status)

    const orderId = session.metadata?.orderId
    const productId = session.metadata?.productId
    const variantId = session.metadata?.variantId || null

    if (!orderId || !productId) {
      console.error("Missing metadata:", { orderId, productId })
      return new Response("Missing metadata", { status: 200 })
    }

    // เช็ค payment_status ด้วย บางที session complete แต่ยังไม่ได้จ่าย
    if (session.payment_status !== "paid") {
      console.log("Payment not yet paid, status:", session.payment_status)
      return new Response("ok")
    }

    try {
      // เช็คว่า order อัพเดตไปแล้วหรือยัง (กันซ้ำ)
      const existingOrder = await prisma.orders.findUnique({
        where: { id: orderId },
      })

      if (!existingOrder) {
        console.error("Order not found:", orderId)
        return new Response("Order not found", { status: 200 })
      }

      if (existingOrder.status === "paid") {
        console.log("Order already paid, skipping:", orderId)
        return new Response("ok")
      }

      const key = await prisma.game_keys.findFirst({
        where: {
          product_id: productId,
          variant_id: variantId || null,
          status: "available",
        },
      })

      if (!key) {
        console.error("No available keys for:", { productId, variantId })
        // อัพเดต order เป็น paid แม้ไม่มี key
        await prisma.orders.update({
          where: { id: orderId },
          data: {
            status: "paid",
            paid_at: new Date(),
          },
        })
        return new Response("ok (no keys)")
      }

      await prisma.$transaction([
        prisma.game_keys.update({
          where: { id: key.id },
          data: {
            status: "assigned",
            order_id: orderId,
            assigned_at: new Date(),
          },
        }),
        prisma.orders.update({
          where: { id: orderId },
          data: {
            status: "paid",
            paid_at: new Date(),
            fulfilled_at: new Date(),
          },
        }),
      ])

      await prisma.$transaction([
        prisma.game_keys.update({
          where: { id: key.id },
          data: { status: "assigned", order_id: orderId, assigned_at: new Date() },
        }),
        prisma.orders.update({
          where: { id: orderId },
          data: {
            status: "paid",
            paid_at: new Date(),
            fulfilled_at: new Date(),
            payment_method: actualMethod,
          },
        }),
      ])

      console.log("Order fulfilled:", orderId, "Key:", key.key_value)
    } catch (dbErr) {
      console.error("DB error in webhook:", dbErr)
      return new Response("DB Error", { status: 500 })
    }
  }

  if (event.type === "checkout.session.expired") {
    const session = event.data.object as Stripe.Checkout.Session
    const orderId = session.metadata?.orderId

    if (orderId) {
      await prisma.orders.update({
        where: { id: orderId },
        data: { status: "expired" },
      })
      console.log("Order expired:", orderId)
    }
  }

  return new Response("ok")
}