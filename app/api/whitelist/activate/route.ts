import { prisma } from "@/lib/prisma"
import { NextRequest, NextResponse } from "next/server"
import jwt from "jsonwebtoken"

const JWT_SECRET = process.env.JWT_SECRET!

// ✅ Rate limit store (IP → { count, resetAt })
const rateLimitStore = new Map<string, { count: number; resetAt: number }>()

function checkRateLimit(ip: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now()
  const windowMs = 60 * 1000  // 1 นาที
  const maxAttempts = 10       // สูงสุด 10 ครั้ง/นาที

  const record = rateLimitStore.get(ip)

  if (!record || now > record.resetAt) {
    rateLimitStore.set(ip, { count: 1, resetAt: now + windowMs })
    return { allowed: true }
  }

  if (record.count >= maxAttempts) {
    return {
      allowed: false,
      retryAfter: Math.ceil((record.resetAt - now) / 1000),
    }
  }

  record.count++
  return { allowed: true }
}

// ✅ Cleanup store ทุก 5 นาที กัน memory leak
setInterval(() => {
  const now = Date.now()
  for (const [ip, record] of rateLimitStore.entries()) {
    if (now > record.resetAt) rateLimitStore.delete(ip)
  }
}, 5 * 60 * 1000)

export async function POST(req: NextRequest) {
  try {
    // ✅ ดึง IP จาก header
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
      req.headers.get("x-real-ip") ??
      "unknown"

    const { allowed, retryAfter } = checkRateLimit(ip)

    if (!allowed) {
      return NextResponse.json(
        { error: `Too many attempts, try again in ${retryAfter}s` },
        {
          status: 429,
          headers: {
            "Retry-After": String(retryAfter),
            "X-RateLimit-Limit": "10",
            "X-RateLimit-Remaining": "0",
          },
        }
      )
    }

    const body = await req.json()
    const { licenseKey, deviceId } = body

    if (!licenseKey) {
      return NextResponse.json(
        { error: "licenseKey is required" },
        { status: 400 }
      )
    }

    // ✅ Validate UUID format ก่อน query DB
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(licenseKey)) {
      return NextResponse.json(
        { error: "Invalid license key format" },
        { status: 403 }
      )
    }

    const order = await prisma.orders.findFirst({
      where: {
        id: licenseKey,

        // อนุญาตทั้ง paid และ Admin Buy
        status: {
          in: ["paid", "Admin Buy"],
        },

        whitelist_status: "whitelisted",
      },

      include: {
        user_function_gifts: {
          include: {
            product_functions: true,
            gifts: true,
          },
        },
      },
    })

    if (!order) {
      return NextResponse.json(
        { error: "Invalid or expired license" },
        { status: 403 }
      )
    }

    if (order.expires_at && order.expires_at < new Date()) {
      return NextResponse.json(
        { error: "License expired" },
        { status: 403 }
      )
    }

    if (deviceId) {
      if (!order.activated_device_id) {
        await prisma.orders.update({
          where: { id: order.id },
          data: {
            activated_device_id: deviceId,
            activated_at: new Date(),
          },
        })
      } else if (order.activated_device_id !== deviceId) {
        return NextResponse.json(
          { error: "License already activated on another device" },
          { status: 403 }
        )
      }
    }

    const token = jwt.sign(
      {
        orderId: order.id,
        productId: order.product_id,
        tiktokUsername: order.tiktok_username,
      },
      JWT_SECRET,
      { expiresIn: "30d" }
    )

    return NextResponse.json({
      success: true,
      token,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      orderId: order.id,
      tiktokUsername: order.tiktok_username,
      whitelistedUsername: order.whitelisted_username,
      functions: order.user_function_gifts.map((ufg) => ({
        name: ufg.product_functions.name,
        label_th: ufg.product_functions.label_th,
        label_en: ufg.product_functions.label_en,
        gift_id: ufg.gift_id,
        gift_name: ufg.gifts.name,
        gift_image_url: ufg.gifts.image_url,
        gift_diamonds: ufg.gifts.diamonds,
      })),
    })
  } catch (error) {
    console.error("Desktop activation error:", error)
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    )
  }
}