// app/api/discount-codes/validate/route.ts
//
// POST { code, productId, subtotal } → { valid, amountOff, finalAmount, message }
// Used by the checkout UI to preview a discount before submission.

import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { evaluateDiscount, countUserRedemptions } from "@/lib/discountCodes"

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ valid: false, errorCode: "UNAUTHORIZED" }, { status: 401 })
    }

    const { code, productId, subtotal } = await req.json()

    const raw = typeof code === "string" ? code.trim().toUpperCase() : ""
    const sub = Number(subtotal)
    if (!raw || !productId || !Number.isFinite(sub) || sub <= 0) {
      return NextResponse.json(
        { valid: false, errorCode: "INVALID_INPUT" },
        { status: 400 },
      )
    }

    const found = await prisma.discount_codes.findUnique({ where: { code: raw } })
    const userUsed = found
      ? await countUserRedemptions(prisma, found.id, session.user.id)
      : 0
    const result = evaluateDiscount(found, sub, productId, userUsed)

    if (!result.ok) {
      return NextResponse.json({
        valid: false,
        errorCode: result.errorCode,
        params: result.params,
      })
    }

    return NextResponse.json({
      valid: true,
      code: result.code.code,
      type: result.code.type,
      value: Number(result.code.value),
      amountOff: result.amountOff,
      finalAmount: Math.max(0, Math.round((sub - result.amountOff) * 100) / 100),
    })
  } catch (err: any) {
    console.error("validate discount error:", err)
    return NextResponse.json({ valid: false, errorCode: "SERVER_ERROR" }, { status: 500 })
  }
}
