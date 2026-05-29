// app/api/verify-token/route.ts
import { NextRequest, NextResponse } from "next/server"
import jwt from "jsonwebtoken"
import { prisma } from "@/lib/prisma"

const JWT_SECRET = process.env.JWT_SECRET!
const INTERNAL_KEY = process.env.INTERNAL_API_KEY! // secret ระหว่าง Node↔Next.js

export async function POST(req: NextRequest) {
  // เช็คว่า request มาจาก Node server เท่านั้น
  const internalKey = req.headers.get("x-internal-key")
  if (internalKey !== INTERNAL_KEY) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { token } = await req.json()

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any
    
    // Additional check for order status if it's a license token
    if (decoded.orderId && decoded.orderId !== 'simulator') {
      const order = await prisma.orders.findFirst({
        where: {
          id: decoded.orderId,
          status: { in: ["paid", "Admin Buy"] },
          whitelist_status: "whitelisted"
        }
      })

      if (!order) {
        return NextResponse.json({ valid: false, error: "Order not found or not whitelisted" }, { status: 401 })
      }

      if (order.expires_at && order.expires_at < new Date()) {
        return NextResponse.json({ valid: false, error: "License expired" }, { status: 401 })
      }
    }

    return NextResponse.json({ valid: true, payload: decoded })
  } catch {
    return NextResponse.json({ valid: false }, { status: 401 })
  }
}