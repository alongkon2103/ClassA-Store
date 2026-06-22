// Shared post-payment fulfillment for both Stripe and PayPal.
// Runs once an order has been confirmed paid by either provider:
//   1) Flip the order to status=paid, whitelist_status=whitelisted, set expires_at
//   2) Upsert the user_whitelist_access row for this product+ign
//   3) Increment the variant's discount_used counter when applicable
//   4) Try to assign the matching Discord role (best-effort, never throws)
//
// Idempotent: if status is already "paid" we no-op so retries are safe.

import { prisma } from "@/lib/prisma"

const PERMANENT_EXPIRES_AT = new Date("9999-12-31T00:00:00.000Z")

function computeExpiresAt(variant: { duration_type?: string | null; duration_days?: number | null } | null | undefined): Date {
  if (!variant?.duration_type || variant.duration_type === "permanent") {
    return PERMANENT_EXPIRES_AT
  }
  if (variant.duration_type === "days" && variant.duration_days) {
    return new Date(Date.now() + variant.duration_days * 24 * 60 * 60 * 1000)
  }
  return PERMANENT_EXPIRES_AT
}

export async function fulfillPaidOrder(orderId: string, opts?: { isPremium?: boolean }): Promise<"ok" | "already_paid" | "missing"> {
  const order = await prisma.orders.findUnique({
    where: { id: orderId },
    include: {
      products: true,
      product_variants: true,
      users: { include: { accounts: true } },
    },
  })

  if (!order) return "missing"
  if (order.status === "paid") return "already_paid"

  const isPremium = opts?.isPremium ?? !!order.is_premium_order
  const expiresAt = computeExpiresAt(order.product_variants)

  const shouldIncrementDiscount = !!(
    order.variant_id &&
    order.products.has_limited_discount &&
    order.product_variants &&
    Number(order.product_variants.discount_pct) > 0 &&
    (order.product_variants.discount_used ?? 0) < (order.product_variants.discount_limit ?? 0)
  )

  await prisma.$transaction([
    prisma.orders.update({
      where: { id: orderId },
      data: {
        status: "paid",
        paid_at: new Date(),
        expires_at: expiresAt,
        whitelist_status: "whitelisted",
        is_premium_order: isPremium,
      },
    }),
    prisma.user_whitelist_access.upsert({
      where: {
        ign_product_id: {
          ign: order.whitelisted_username || "unknown",
          product_id: order.product_id,
        },
      },
      create: {
        ign: order.whitelisted_username || "unknown",
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
    ...(shouldIncrementDiscount
      ? [
          prisma.product_variants.update({
            where: { id: order.variant_id! },
            data: { discount_used: { increment: 1 } },
          }),
        ]
      : []),
  ])

  // Best-effort Discord role assignment — never block fulfillment on bot failures.
  if (order.users) {
    const discordAccount = order.users.accounts.find((a) => a.provider === "discord")
    const discordUserId = discordAccount?.provider_account_id
    const roleId = order.products.discord_role_id
    const guildId = order.products.discord_guild_id
    if (discordUserId && roleId) {
      try {
        const r = await fetch("http://localhost:3700/assignrole", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": process.env.API_ASSIGN_ROLE_KEY!,
          },
          body: JSON.stringify({ userId: discordUserId, roleId, guildId }),
        })
        if (!r.ok) console.error("Bot API returned error status:", r.status)
      } catch (e) {
        console.error("Could not connect to Discord Bot API:", e)
      }
    }
  }

  return "ok"
}
