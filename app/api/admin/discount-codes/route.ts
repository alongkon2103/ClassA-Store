// app/api/admin/discount-codes/route.ts

import { NextRequest, NextResponse } from "next/server"
import { randomBytes } from "crypto"
import { prisma } from "@/lib/prisma"
import { validateAdmin } from "@/lib/adminAuth"

// A → Z and 2 → 9 (no I/O/0/1 to avoid look-alikes)
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"

function generateCode(len = 8): string {
  const bytes = randomBytes(len)
  let out = ""
  for (let i = 0; i < len; i++) {
    out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length]
  }
  return out
}

export async function GET() {
  const admin = await validateAdmin(["admin"])
  if (!admin.isValid) return admin.response

  const codes = await prisma.discount_codes.findMany({
    orderBy: { created_at: "desc" },
    include: {
      product: { select: { id: true, name_en: true, name_th: true } },
      _count: { select: { redemptions: true } },
    },
  })
  return NextResponse.json(codes)
}

export async function POST(req: NextRequest) {
  const admin = await validateAdmin(["admin"])
  if (!admin.isValid) return admin.response

  try {
    const body = await req.json()

    let code: string = (body.code || "").trim().toUpperCase()
    const type: string = body.type === "percent" ? "percent" : "fixed"
    const value = Number(body.value)
    const maxUses = body.max_uses === null || body.max_uses === "" ? null : Number(body.max_uses)
    const perUserLimit =
      body.per_user_limit === null || body.per_user_limit === undefined || body.per_user_limit === ""
        ? 1
        : Number(body.per_user_limit)
    const minAmount = body.min_amount === null || body.min_amount === "" ? null : Number(body.min_amount)
    const productId = body.product_id?.trim() || null
    const startsAt = body.starts_at ? new Date(body.starts_at) : null
    const expiresAt = body.expires_at ? new Date(body.expires_at) : null
    const note: string | null = body.note?.trim() || null
    const isPublic = Boolean(body.is_public)

    if (!Number.isFinite(value) || value <= 0) {
      return NextResponse.json({ error: "value must be > 0" }, { status: 400 })
    }
    if (type === "percent" && value > 100) {
      return NextResponse.json({ error: "percent value cannot exceed 100" }, { status: 400 })
    }
    if (maxUses !== null && (!Number.isFinite(maxUses) || maxUses < 1)) {
      return NextResponse.json({ error: "max_uses must be >= 1 or empty" }, { status: 400 })
    }

    if (!code) {
      // generate until unique — retry on collision (very rare for 8 char codes)
      for (let i = 0; i < 5; i++) {
        const candidate = generateCode(8)
        const exists = await prisma.discount_codes.findUnique({ where: { code: candidate } })
        if (!exists) {
          code = candidate
          break
        }
      }
      if (!code) {
        return NextResponse.json({ error: "Failed to generate unique code, retry" }, { status: 500 })
      }
    } else {
      const exists = await prisma.discount_codes.findUnique({ where: { code } })
      if (exists) {
        return NextResponse.json({ error: "Code already exists" }, { status: 400 })
      }
    }

    const created = await prisma.discount_codes.create({
      data: {
        code,
        type,
        value,
        max_uses: maxUses,
        per_user_limit: Number.isFinite(perUserLimit) ? (perUserLimit as number) : null,
        min_amount: minAmount,
        product_id: productId,
        starts_at: startsAt,
        expires_at: expiresAt,
        is_public: isPublic,
        note,
      },
    })

    return NextResponse.json(created)
  } catch (err: unknown) {
    console.error("POST discount-code error:", err)
    return NextResponse.json({ error: "Failed to create code" }, { status: 500 })
  }
}
