import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { NextRequest, NextResponse } from "next/server"
import jwt from "jsonwebtoken"

const MIDDLEWARE_URL = process.env.MIDDLEWARE_URL   // http://localhost:3001
const JWT_SECRET     = process.env.JWT_SECRET!

export async function POST(req: NextRequest) {
  // Admin only
  const session = await getServerSession(authOptions)
  if (session?.user?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  if (!MIDDLEWARE_URL) {
    return NextResponse.json({ error: "MIDDLEWARE_URL not configured" }, { status: 500 })
  }

  const event = await req.json()

  const username = event.tiktokRecipient?.trim()
  if (!username) {
    return NextResponse.json({ error: "missing tiktokRecipient" }, { status: 400 })
  }

  // Sign JWT แบบเดียวกับที่ Python client ได้รับ
  const token = jwt.sign(
    {
      tiktokUsername: username,
      orderId:        "simulator",
      role:           "simulator",
    },
    JWT_SECRET,
    { expiresIn: "5m" }
  )

  try {
    // 1. Register ก่อน (middleware ต้องรู้จัก username)
    await fetch(`${MIDDLEWARE_URL}/register`, {
      method:  "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify({ username }),
    })

    // 2. Push gift event
    const res = await fetch(`${MIDDLEWARE_URL}/push-event`, {
      method:  "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify({
        username,
        type: "gift",
        data: {
          id:                event.msgId,
          giftId:            event.giftId,
          giftName:          event.giftName,
          username:          event.uniqueId,
          nickname:          event.nickname,
          diamond:           event.diamondCount,
          repeatCount:       event.repeatCount,
          repeatEnd:         true,
          profilePictureUrl: event.giftPictureUrl ?? "",
        },
      }),
    })

    const result = await res.json()

    if (!res.ok) {
      return NextResponse.json(
        { error: result.error ?? "Middleware error" },
        { status: res.status }
      )
    }

    return NextResponse.json({ ok: true })

  } catch (err) {
    console.error("[simulator] error:", err)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}