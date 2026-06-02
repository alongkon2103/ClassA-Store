import { prisma } from "@/lib/prisma"
import { NextRequest, NextResponse } from "next/server"

function checkApiKey(req: NextRequest) {
  if (process.env.NODE_ENV === "development") {
    return true
  }

  const apiKey = req.headers.get("x-api-key")

  if (!apiKey) return false

  return apiKey === process.env.API_CHCK_WHILIST_KEY
}

export async function POST(req: NextRequest) {
  try {
    if (!checkApiKey(req)) {
      return NextResponse.json(
        { error: "invalid api key" },
        { status: 403 }
      )
    }

    const body = await req.json()

    // Support both 'username' and 'ign' in payload
    const username = body.username || body.ign
    const { product_id } = body

    if (!username) {
      return NextResponse.json(
        { allowed: false, error: "no username" },
        { status: 400 }
      )
    }

    if (!product_id) {
      return NextResponse.json(
        { allowed: false, error: "no product_id" },
        { status: 400 }
      )
    }

    const now = new Date()

    // ──────────────────────────────────────────────────────────────
    // CHECK 1: user_whitelist_access (Directly added by Admin)
    // ──────────────────────────────────────────────────────────────
    const directAccess = await prisma.user_whitelist_access.findFirst({
      where: {
        ign: { equals: username, mode: "insensitive" },
        product_id: product_id
      },
      include: {
        products: true
      }
    })

    if (directAccess) {
      const expiresAt = new Date(directAccess.expires_at)
      const isExpired = now > expiresAt

      if (!isExpired) {
        const diffMs = expiresAt.getTime() - now.getTime()
        const daysLeft = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)))
        const hoursLeft = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60)))

        // If expiry is > 50 years, consider it permanent for the response
        const isPermanent = expiresAt.getFullYear() > now.getFullYear() + 50

        return NextResponse.json({
          allowed: true,
          variant: directAccess.is_premium ? "Premium (Admin)" : "Normal (Admin)",
          duration_type: isPermanent ? "permanent" : "days",
          duration_days: isPermanent ? null : daysLeft,
          paid_at: directAccess.updated_at,
          expires_at: directAccess.expires_at,
          days_left: isPermanent ? 9999 : daysLeft,
          hours_left: isPermanent ? 999999 : hoursLeft,
          is_premium: directAccess.is_premium,
          source: "direct_access"
        })
      }
    }

    // ──────────────────────────────────────────────────────────────
    // CHECK 2: orders (Purchased via system)
    // ──────────────────────────────────────────────────────────────
    const order = await prisma.orders.findFirst({
      where: {
        product_id,
        status: {
          in: ["paid", "Admin Buy"],
        },
        whitelist_status: "whitelisted",
        whitelisted_username: {
          equals: username,
          mode: "insensitive",
        },
      },
      orderBy: {
        paid_at: "desc",
      },
      include: {
        product_variants: true,
      },
    })

    if (!order) {
      return NextResponse.json({
        allowed: false,
        reason: "not_whitelisted",
      })
    }

    const variant = order.product_variants

    // ── Case A: Order with explicit expires_at (e.g., TRIAL) ──────
    if (order.expires_at) {
      const expiresAt = new Date(order.expires_at)
      const isExpired = now > expiresAt
      if (isExpired) {
        return NextResponse.json({
          allowed: false,
          reason: "expired",
          expires_at: order.expires_at,
        })
      }

      const diffMs = expiresAt.getTime() - now.getTime()
      const daysLeft = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)))
      const hoursLeft = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60)))

      return NextResponse.json({
        allowed: true,
        variant: variant?.label_en ?? "Trial",
        duration_type: "days",
        duration_days: null,
        paid_at: order.paid_at,
        expires_at: order.expires_at,
        days_left: daysLeft,
        hours_left: hoursLeft,
        is_premium: !!order.is_premium_order,
        source: "order"
      })
    }

    // ── Case B: Order with Variant-based duration ────────────────
    // permanent
    if (!variant?.duration_type || variant.duration_type === "permanent") {
      return NextResponse.json({
        allowed: true,
        variant: variant?.label_en ?? "Permanent",
        duration_type: "permanent",
        duration_days: null,
        paid_at: order.paid_at,
        expires_at: null,
        days_left: 9999,
        hours_left: 999999,
        is_premium: !!order.is_premium_order,
        source: "order"
      })
    }

    // days
    if (variant.duration_type === "days" && variant.duration_days) {
      const paidAt = new Date(order.paid_at!)
      const expiresAt = new Date(paidAt)
      expiresAt.setDate(expiresAt.getDate() + variant.duration_days)

      const isExpired = now > expiresAt
      const diffMs = expiresAt.getTime() - now.getTime()
      const daysLeft = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)))
      const hoursLeft = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60)))

      if (isExpired) {
        return NextResponse.json({
          allowed: false,
          reason: "expired",
          variant: variant.label_en,
          duration_type: "days",
          duration_days: variant.duration_days,
          paid_at: order.paid_at,
          expires_at: expiresAt.toISOString(),
          is_premium: !!order.is_premium_order,
        })
      }

      return NextResponse.json({
        allowed: true,
        variant: variant.label_en,
        duration_type: "days",
        duration_days: variant.duration_days,
        paid_at: order.paid_at,
        expires_at: expiresAt.toISOString(),
        days_left: daysLeft,
        hours_left: hoursLeft,
        is_premium: !!order.is_premium_order,
        source: "order"
      })
    }

    return NextResponse.json({
      allowed: false,
      reason: "unknown_duration_type",
    })

  } catch (err) {
    console.error(err)
    return NextResponse.json({ allowed: false, error: "internal server error" }, { status: 500 })
  }
}
