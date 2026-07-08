// app/api/discount-codes/public/route.ts
//
// GET ?productId=... → { codes: [{ code, type, value, min_amount, remaining, already_used }] }
//
// Public/featured codes (is_public=true) shown as clickable cards under the
// discount input in the product modal — TikTok/Shopee style. NO auth required
// to see the list; session is only used (when present) to mark codes the user
// has already redeemed so the UI can gray them out.
//
// SECURITY: only is_public codes are ever returned — normal codes must never
// leak through this endpoint. Codes outside their date window or disabled are
// hidden entirely; sold-out codes ARE returned (remaining=0) so the UI can
// show them grayed out.

import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { countUserRedemptions } from "@/lib/discountCodes"

export const runtime = "nodejs"

export async function GET(req: NextRequest) {
  try {
    const productId = req.nextUrl.searchParams.get("productId")?.trim()
    if (!productId) {
      return NextResponse.json({ error: "productId required" }, { status: 400 })
    }

    const now = new Date()
    const rows = await prisma.discount_codes.findMany({
      where: {
        is_public: true,
        is_active: true,
        AND: [
          { OR: [{ starts_at: null }, { starts_at: { lte: now } }] },
          { OR: [{ expires_at: null }, { expires_at: { gt: now } }] },
          // global codes + codes tied to this product
          { OR: [{ product_id: null }, { product_id: productId }] },
        ],
      },
      orderBy: { created_at: "desc" },
      select: {
        id: true,
        code: true,
        type: true,
        value: true,
        min_amount: true,
        max_uses: true,
        used_count: true,
        per_user_limit: true,
      },
    })

    // Optional session: mark codes this user already redeemed (same
    // expired/cancelled exclusion rule as checkout via countUserRedemptions).
    const session = await getServerSession(authOptions)
    const userId = session?.user?.id ?? null

    const codes = await Promise.all(
      rows.map(async (c) => {
        let alreadyUsed = false
        if (userId && c.per_user_limit !== null) {
          const used = await countUserRedemptions(prisma, c.id, userId)
          alreadyUsed = used >= c.per_user_limit
        }
        return {
          code: c.code,
          type: c.type, // "fixed" | "percent"
          value: Number(c.value),
          min_amount: c.min_amount ? Number(c.min_amount) : null,
          // null = unlimited. used_count includes reserved pending slots, which
          // is exactly what checkout enforces, so this never over-promises.
          remaining: c.max_uses === null ? null : Math.max(0, c.max_uses - c.used_count),
          already_used: alreadyUsed,
        }
      }),
    )

    return NextResponse.json({ codes })
  } catch (err: unknown) {
    console.error("public discount-codes error:", err)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
