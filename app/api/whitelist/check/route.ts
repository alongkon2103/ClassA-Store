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

    const { username, product_id } = body

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

    const order = await prisma.orders.findFirst({
      where: {
        product_id,

        // status ต้องเป็น paid หรือ Admin Buy
        status: {
          in: ["paid", "Admin Buy"],
        },

        whitelist_status: "whitelisted",

        // ค้นหา username แบบไม่สนใจตัวพิมพ์เล็ก/ใหญ่
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

    const now = new Date()

    // permanent
    if (
      !variant?.duration_type ||
      variant.duration_type === "permanent"
    ) {
      return NextResponse.json({
        allowed: true,
        variant: variant?.label_en ?? "Permanent",
        duration_type: "permanent",
        expires_at: null,
        is_premium: !!order.is_premium_order,
      })
    }

    // days
    if (
      variant.duration_type === "days" &&
      variant.duration_days
    ) {
      const paidAt = new Date(order.paid_at!)
      const expiresAt = new Date(paidAt)

      expiresAt.setDate(
        expiresAt.getDate() + variant.duration_days
      )

      const isExpired = now > expiresAt

      const daysLeft = Math.max(
        0,
        Math.ceil(
          (expiresAt.getTime() - now.getTime()) /
          (1000 * 60 * 60 * 24)
        )
      )

      const hoursLeft = Math.max(
        0,
        Math.ceil(
          (expiresAt.getTime() - now.getTime()) /
          (1000 * 60 * 60)
        )
      )

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
      })
    }

    return NextResponse.json({
      allowed: false,
      reason: "unknown_duration_type",
    })

  } catch (err) {
    console.error(err)

    return NextResponse.json(
      {
        allowed: false,
        error: "internal server error",
      },
      { status: 500 }
    )
  }
}