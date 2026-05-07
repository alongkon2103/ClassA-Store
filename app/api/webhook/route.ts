// import Stripe from "stripe"
// import { headers } from "next/headers"
// import { prisma } from "@/lib/prisma"
// import { NextRequest } from "next/server"
// import { getServerSession } from "next-auth"
// import { authOptions } from "@/lib/auth"


// export const runtime = "nodejs"

// const stripe          = new Stripe(process.env.STRIPE_SECRET_KEY!)
// const endpointSecret  = process.env.STRIPE_WEBHOOK_SECRET!
// const sessionUser = await getServerSession(authOptions)

// export async function POST(req: NextRequest) {
//   const body = await req.text()
//   const headersList = await headers()
//   const sig = headersList.get("stripe-signature")

//   if (!sig) return new Response("No signature", { status: 400 })

//   let event: Stripe.Event
//   try {
//     event = stripe.webhooks.constructEvent(body, sig, endpointSecret)
//   } catch (err: any) {
//     console.error("Webhook error:", err.message)
//     return new Response(`Webhook Error: ${err.message}`, { status: 400 })
//   }

//   if (event.type === "checkout.session.completed") {
//     const session   = event.data.object as Stripe.Checkout.Session
//     const orderId   = session.metadata?.orderId
//     const productId = session.metadata?.productId

//     if (!orderId || !productId) {
//       return new Response("Missing metadata", { status: 200 })
//     }

//     if (session.payment_status !== "paid") {
//       return new Response("ok")
//     }

//     const existingOrder = await prisma.orders.findUnique({ where: { id: orderId } })
//     if (!existingOrder || existingOrder.status === "paid") {
//       return new Response("ok")
//     }

//     let actualMethod = "promptpay"
//     try {
//       if (session.payment_intent) {
//         const pi     = await stripe.paymentIntents.retrieve(session.payment_intent as string)
//         actualMethod = pi.payment_method_types?.[0] ?? "promptpay"
//       }
//     } catch {}

//     await prisma.orders.update({
//       where: { id: orderId },
//       data: {
//         status:           "paid",
//         paid_at:          new Date(),
//         payment_method:   actualMethod,
//         whitelist_status: "whitelisted", 
//       },
//     })

//     console.log("Order paid, pending whitelist:", orderId, existingOrder.whitelisted_username)
//   }

//   if (event.type === "checkout.session.expired") {
//     const session = event.data.object as Stripe.Checkout.Session
//     const orderId = session.metadata?.orderId
//     if (orderId) {
//       await prisma.orders.update({ where: { id: orderId }, data: { status: "expired" } })
//     }
//   }

//   return new Response("ok")
// }

import Stripe from "stripe"
import { headers } from "next/headers"
import { prisma } from "@/lib/prisma"
import { NextRequest } from "next/server"

export const runtime = "nodejs"

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET!

export async function POST(req: NextRequest) {
  const body = await req.text()
  const headersList = await headers()
  const sig = headersList.get("stripe-signature")

  if (!sig) return new Response("No signature", { status: 400 })

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(body, sig, endpointSecret)
  } catch (err: any) {
    console.error("Webhook error:", err.message)
    return new Response(`Webhook Error: ${err.message}`, { status: 400 })
  }

  // ─────────────────────────────────────────────
  // ✅ PAYMENT SUCCESS
  // ─────────────────────────────────────────────
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session

    const orderId = session.metadata?.orderId
    const productId = session.metadata?.productId

    if (!orderId || !productId) {
      return new Response("Missing metadata", { status: 200 })
    }

    if (session.payment_status !== "paid") {
      return new Response("ok")
    }

    const order = await prisma.orders.findUnique({
      where: { id: orderId },
      include: {
        products: true,
        users: {
          include: {
            accounts: true,
          },
        },
      },
    })

    if (!order || order.status === "paid") {
      return new Response("ok")
    }

    // ─────────────────────────────────────────────
    // update order
    // ─────────────────────────────────────────────
    await prisma.orders.update({
      where: { id: orderId },
      data: {
        status: "paid",
        paid_at: new Date(),
        whitelist_status: "whitelisted",
      },
    })

    // ─────────────────────────────────────────────
    // get discord id
    // ─────────────────────────────────────────────
    const discordAccount = order.users.accounts.find(
      (a) => a.provider === "discord"
    )

    const discordUserId = discordAccount?.provider_account_id

    const roleId = order.products.discord_role_id
    const guildId = order.products.discord_guild_id

    // ─────────────────────────────────────────────
    // CALL YOUR DISCORD BOT API
    // ─────────────────────────────────────────────
    if (discordUserId && roleId) {
      await fetch("http://localhost:3700/assignrole", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": process.env.API_ASSIGN_ROLE_KEY!,
        },
        body: JSON.stringify({
          userId: discordUserId,
          roleId: roleId,
          guildId: guildId,
        }),
      })
    }

    console.log("✅ Paid + Role assigned:", {
      orderId,
      discordUserId,
      roleId,
    })
  }

  // ─────────────────────────────────────────────
  // EXPIRED
  // ─────────────────────────────────────────────
  if (event.type === "checkout.session.expired") {
    const session = event.data.object as Stripe.Checkout.Session
    const orderId = session.metadata?.orderId

    if (orderId) {
      await prisma.orders.update({
        where: { id: orderId },
        data: { status: "expired" },
      })
    }
  }

  return new Response("ok")
}