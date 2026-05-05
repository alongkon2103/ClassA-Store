import Stripe from "stripe"
import { headers } from "next/headers"
import { prisma } from "@/lib/prisma"

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET!

export async function POST(req: Request) {
  const body = await req.text()
  const sig = (await headers()).get("stripe-signature")!

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(body, sig, endpointSecret)
  } catch (err: any) {
    console.error("Webhook error:", err.message)
    return new Response("Webhook Error", { status: 400 })
  }

  // ✅ จ่ายเงินสำเร็จ
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session

    const orderId = session.metadata?.orderId
    const productId = session.metadata?.productId
    const variantId = session.metadata?.variantId

    if (!orderId || !productId) {
      console.error("Missing metadata in session:", session.id)
      return new Response("Missing metadata", { status: 200 }) // Return 200 to stop Stripe retries
    }

    try {
      // 🔥 หา key ที่ยังว่าง
      const key = await prisma.game_keys.findFirst({
        where: {
          product_id: productId,
          variant_id: variantId || null,
          status: "available",
        },
      })

      if (!key) {
        console.error(`No available keys for product ${productId} variant ${variantId}`)
        // ยังคงต้อง update order เป็น paid แต่อาจจะไม่มี key
        await prisma.orders.update({
          where: { id: orderId },
          data: {
            status: "paid",
            paid_at: new Date(),
          },
        })
        return new Response("ok (no keys available)")
      }

      // 🔥 assign key + update order
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
    } catch (dbErr) {
      console.error("Database update error in webhook:", dbErr)
      // We might want Stripe to retry if it's a transient DB error
      return new Response("DB Error", { status: 500 })
    }
  }

  return new Response("ok")
}