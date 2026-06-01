// app/api/webhook/route.ts

import Stripe from "stripe"
import { headers } from "next/headers"
import { prisma } from "@/lib/prisma"
import { NextRequest } from "next/server"

export const runtime = "nodejs"

const stripe         = new Stripe(process.env.STRIPE_SECRET_KEY!)
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET!

export async function POST(req: NextRequest) {
  const body        = await req.text()
  const headersList = await headers()
  const sig         = headersList.get("stripe-signature")

  if (!sig) return new Response("No signature", { status: 400 })

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, endpointSecret)
  } catch (err: any) {
    console.error("Webhook error:", err.message)
    return new Response(`Webhook Error: ${err.message}`, { status: 400 })
  }

  // ─────────────────────────────────────────────
  // PAYMENT SUCCESS
  // ─────────────────────────────────────────────
  if (event.type === "checkout.session.completed") {
    const session   = event.data.object as Stripe.Checkout.Session
    const orderId   = session.metadata?.orderId
    const productId = session.metadata?.productId

    if (!orderId || !productId) return new Response("Missing metadata", { status: 200 })
    if (session.payment_status !== "paid") return new Response("ok")

    const order = await prisma.orders.findUnique({
      where: { id: orderId },
      include: {
        products:         true,
        product_variants: true,
        users: {
          include: { accounts: true },
        },
      },
    })

    if (!order) return new Response("ok")

    const isUpgrade     = session.metadata?.isUpgrade === "true"
    const isPremium     = session.metadata?.isPremium === "true"
    const durationDays  = order.product_variants?.duration_days ?? 30
    const paidAmount    = session.amount_total ? session.amount_total / 100 : 0
    const paymentMethod = session.payment_method_types?.[0] ?? "unknown"

    // ─────────────────────────────────────────────
    // UPGRADE FLOW
    // ─────────────────────────────────────────────
    if (isUpgrade) {
      // ดึง record เดิมเพื่อคง expires_at ไว้
      const existing = await prisma.user_whitelist_access.findUnique({
        where: {
          ign_product_id: {                              // ✅ แก้จาก user_id_product_id
            ign:        order.whitelisted_username || "unknown",
            product_id: order.product_id,
          },
        },
      })

      const expiresAt = existing?.expires_at
        ?? new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000)

      await prisma.$transaction([
        // 1. mark order เป็น premium
        prisma.orders.update({
          where: { id: orderId },
          data:  { is_premium_order: true },
        }),

        // 2. upsert access record
        prisma.user_whitelist_access.upsert({
          where: {
            ign_product_id: {                            // ✅ แก้จาก user_id_product_id
              ign:        order.whitelisted_username || "unknown",
              product_id: order.product_id,
            },
          },
          create: {
            ign:        order.whitelisted_username || "unknown", // ✅ แก้จาก user_id
            product_id: order.product_id,
            is_premium: true,
            expires_at: expiresAt,
          },
          update: {
            is_premium: true,
            updated_at: new Date(),
          },
        }),

        // 3. บันทึกประวัติ upgrade
        prisma.premium_upgrades.create({
          data: {
            order_id:          orderId,
            user_id:           order.user_id,
            product_id:        order.product_id,
            amount:            paidAmount,
            payment_method:    paymentMethod,
            stripe_session_id: session.id,
          },
        }),
      ])

      return new Response("ok")
    }

    // ─────────────────────────────────────────────
    // NORMAL FLOW
    // ─────────────────────────────────────────────
    if (order.status === "paid") return new Response("ok")

    const expiresAt = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000)

    // Check if we should increment discount_used
    const shouldIncrementDiscount = !!(
      order.variant_id && 
      order.products.has_limited_discount && 
      order.product_variants &&
      Number(order.product_variants.discount_pct) > 0 &&
      (order.product_variants.discount_used ?? 0) < (order.product_variants.discount_limit ?? 0)
    )

    await prisma.$transaction([
      // 1. update order
      prisma.orders.update({
        where: { id: orderId },
        data: {
          status:           "paid",
          paid_at:          new Date(),
          whitelist_status: "whitelisted",
          is_premium_order: isPremium,
        },
      }),

      // 2. upsert access record
      prisma.user_whitelist_access.upsert({
        where: {
          ign_product_id: {
            ign:        order.whitelisted_username || "unknown",
            product_id: order.product_id,
          },
        },
        create: {
          ign:        order.whitelisted_username || "unknown",
          product_id: order.product_id,
          is_premium: isPremium,
          expires_at: expiresAt,
        },
        update: {
          product_id: order.product_id,
          is_premium: isPremium,
          expires_at: expiresAt,
          updated_at: new Date(),
        },
      }),

      // 3. Increment discount quota if applicable
      ...(shouldIncrementDiscount ? [
        prisma.product_variants.update({
          where: { id: order.variant_id! },
          data: { discount_used: { increment: 1 } }
        })
      ] : [])
    ])

    // ─────────────────────────────────────────────
    // DISCORD ROLE
    // ─────────────────────────────────────────────
    const discordAccount = order.users.accounts.find((a) => a.provider === "discord")
    const discordUserId  = discordAccount?.provider_account_id
    const roleId         = order.products.discord_role_id
    const guildId        = order.products.discord_guild_id

    if (discordUserId && roleId) {
      try {
        const botResponse = await fetch("http://localhost:3700/assignrole", {
          method:  "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key":    process.env.API_ASSIGN_ROLE_KEY!,
          },
          body: JSON.stringify({ userId: discordUserId, roleId, guildId }),
        })
        if (!botResponse.ok) {
          console.error("Bot API returned error status:", botResponse.status)
        }
      } catch (error) {
        console.error("Could not connect to Discord Bot API:", error)
      }
    }
  }

  // ─────────────────────────────────────────────
  // EXPIRED
  // ─────────────────────────────────────────────
  if (event.type === "checkout.session.expired") {
    const session     = event.data.object as Stripe.Checkout.Session
    const orderId     = session.metadata?.orderId
    const isUpgrade   = session.metadata?.isUpgrade === "true"
    const paymentType = session.metadata?.paymentType

    // ==================================================
    // PREMIUM UPGRADE EXPIRED
    // ==================================================
    if (isUpgrade || paymentType === "premium_addon") {
      if (session.id) {
        await prisma.premium_upgrades.updateMany({
          where: { stripe_session_id: session.id },
          data:  { status: "expired" },
        })
      }
      return new Response("ok")
    }

    // ==================================================
    // NORMAL ORDER EXPIRED
    // ==================================================
    if (orderId) {
      const order = await prisma.orders.findUnique({
        where:  { id: orderId },
        select: { status: true },
      })

      if (order?.status === "pending") {
        await prisma.orders.update({
          where: { id: orderId },
          data:  { status: "expired" },
        })
      }
    }
  }

  return new Response("ok")
}