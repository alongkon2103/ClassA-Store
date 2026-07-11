// app/api/discount-codes/auto-preview/route.ts
//
// GET → { codes: [{ code, type, value, min_amount, product_id, sold_out, already_used }] }
//
// Every ACTIVE public auto-select code, with per-user state, in ONE call so a
// whole catalog page (shop grid / home best-sellers) can render personalised
// strikethrough prices without N requests. The client runs pickBestAutoCode
// per product+variant to decide the featured deal.
//
// Personalised: `already_used` reflects THIS shopper's paid redemptions, so a
// customer who already used the 30% code sees the card fall back to the next
// best code they can still use — matching the modal exactly.
//
// SECURITY: only public + auto-select codes leak here; normal/hidden codes
// never appear. amounts shown are PREVIEW only — checkout re-validates.

import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { countUserRedemptions } from "@/lib/discountCodes"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const now = new Date()
    const rows = await prisma.discount_codes.findMany({
      where: {
        is_public: true,
        is_auto_select: true,
        is_active: true,
        AND: [
          { OR: [{ starts_at: null }, { starts_at: { lte: now } }] },
          { OR: [{ expires_at: null }, { expires_at: { gt: now } }] },
        ],
      },
      select: {
        id: true,
        code: true,
        type: true,
        value: true,
        min_amount: true,
        product_id: true,
        max_uses: true,
        used_count: true,
        per_user_limit: true,
      },
    })

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
          product_id: c.product_id, // null = applies to every product
          sold_out: c.max_uses !== null && c.used_count >= c.max_uses,
          already_used: alreadyUsed,
        }
      }),
    )

    return NextResponse.json({ codes })
  } catch (err: unknown) {
    console.error("auto-preview discount error:", err)
    return NextResponse.json({ codes: [] }, { status: 200 })
  }
}
