// app/api/verify-token/route.ts
import { NextRequest, NextResponse } from "next/server"
import jwt from "jsonwebtoken"

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
    const decoded = jwt.verify(token, JWT_SECRET)
    return NextResponse.json({ valid: true, payload: decoded })
  } catch {
    return NextResponse.json({ valid: false }, { status: 401 })
  }
}