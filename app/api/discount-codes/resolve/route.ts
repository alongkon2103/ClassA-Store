// app/api/discount-codes/resolve/route.ts
//
// GET ?code=XYZ → preview fields for ONE specific code, even a private affiliate
// code (which never appears in /public). Powers the /r/<code> affiliate link:
// the modal resolves the remembered ref code and auto-applies it.
//
// Returns { found:false } for codes that can't currently be used (inactive, out
// of its date window, or sold out) so the modal simply skips auto-applying.
// Only ever returns preview-safe fields, by EXACT code match — the caller must
// already know the code (it came from the affiliate's link). Amounts here are
// preview only; checkout re-validates and reserves authoritatively.

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  try {
    const raw = req.nextUrl.searchParams.get("code")?.trim().toUpperCase()
    if (!raw) return NextResponse.json({ found: false })

    const c = await prisma.discount_codes.findUnique({
      where: { code: raw },
      select: {
        code: true, type: true, value: true, min_amount: true, product_id: true,
        is_active: true, starts_at: true, expires_at: true, max_uses: true, used_count: true,
      },
    })
    if (!c || !c.is_active) return NextResponse.json({ found: false })

    const now = new Date()
    if (c.starts_at && now < c.starts_at) return NextResponse.json({ found: false })
    if (c.expires_at && now > c.expires_at) return NextResponse.json({ found: false })
    if (c.max_uses !== null && c.used_count >= c.max_uses) return NextResponse.json({ found: false })

    return NextResponse.json({
      found: true,
      code: c.code,
      type: c.type, // "fixed" | "percent"
      value: Number(c.value),
      min_amount: c.min_amount ? Number(c.min_amount) : null,
      product_id: c.product_id, // null = any product
    })
  } catch (err: unknown) {
    console.error("resolve code error:", err)
    return NextResponse.json({ found: false }, { status: 200 })
  }
}
