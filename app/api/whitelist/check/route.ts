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
    // Single source of truth: user_whitelist_access
    // Populated atomically by /api/webhook (paid orders) and
    // /api/checkout/trial (trial orders), plus admin grants.
    // ──────────────────────────────────────────────────────────────
    const access = await prisma.user_whitelist_access.findFirst({
      where: {
        ign: { equals: username, mode: "insensitive" },
        product_id: product_id,
      },
    })

    if (!access) {
      return NextResponse.json({
        allowed: false,
        reason: "not_whitelisted",
      })
    }

    const expiresAt = new Date(access.expires_at)
    // Permanent sentinel: webhook writes year 9999 for permanent variants.
    const isPermanent = expiresAt.getFullYear() > now.getFullYear() + 50
    const isExpired = !isPermanent && now > expiresAt

    if (isExpired) {
      return NextResponse.json({
        allowed: false,
        reason: "expired",
        expires_at: access.expires_at,
      })
    }

    const diffMs = expiresAt.getTime() - now.getTime()
    const daysLeft = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)))
    const hoursLeft = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60)))

    return NextResponse.json({
      allowed: true,
      duration_type: isPermanent ? "permanent" : "days",
      duration_days: isPermanent ? null : daysLeft,
      paid_at: access.updated_at,
      expires_at: isPermanent ? null : access.expires_at,
      days_left: isPermanent ? 9999 : daysLeft,
      hours_left: isPermanent ? 999999 : hoursLeft,
      is_premium: access.is_premium,
      source: "user_whitelist_access",
    })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ allowed: false, error: "internal server error" }, { status: 500 })
  }
}
