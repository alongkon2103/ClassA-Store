// app/api/discount-codes/validate/route.ts
//
// POST { code, productId, subtotal } → { valid, amountOff, finalAmount, message }
// Used by the checkout UI to preview a discount before submission.

import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { evaluateDiscount, countUserRedemptions, capPartnerDiscount } from "@/lib/discountCodes"
import { planAvailable, toPlanRows, withLiveMinimums } from "@/lib/maki"

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ valid: false, errorCode: "UNAUTHORIZED" }, { status: 401 })
    }

    const { code, productId, subtotal, partnerProductId, planKey } = await req.json()

    const raw = typeof code === "string" ? code.trim().toUpperCase() : ""

    // เกมพาร์ทเนอร์ (Maki): ราคาตั้งต้นเอาจากราคาขายในระบบ (ไม่เชื่อ client) และส่วนลดต้องไม่ทำให้ต่ำกว่าขั้นต่ำ Maki
    if (typeof partnerProductId === "string" && typeof planKey === "string") {
      const row = await prisma.partner_products.findFirst({ where: { id: partnerProductId, is_visible: true, coming_soon: false, partner: { is_active: true, integration: "maki_api" } } })
      const [live] = row ? await withLiveMinimums([row]) : [null]
      const plan = live ? toPlanRows(live.plans).find((p) => p.key === planKey) : null
      if (!raw || !plan || !planAvailable(plan)) return NextResponse.json({ valid: false, errorCode: "INVALID_INPUT" }, { status: 400 })
      const sell = plan.sell_price_thb as number
      const found = await prisma.discount_codes.findUnique({ where: { code: raw } })
      const used = found ? await countUserRedemptions(prisma, found.id, session.user.id) : 0
      const result = evaluateDiscount(found, sell, partnerProductId, used, new Date(), { partner: true })
      if (!result.ok) return NextResponse.json({ valid: false, errorCode: result.errorCode, params: result.params })
      const amountOff = capPartnerDiscount(result.amountOff, sell, plan.min_price_thb)
      if (amountOff <= 0) return NextResponse.json({ valid: false, errorCode: "NO_EFFECT" })
      return NextResponse.json({
        valid: true, code: result.code.code, type: result.code.type, value: Number(result.code.value),
        amountOff, finalAmount: Math.round((sell - amountOff) * 100) / 100, capped: amountOff < result.amountOff,
      })
    }

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
  } catch (err: unknown) {
    console.error("validate discount error:", err)
    return NextResponse.json({ valid: false, errorCode: "SERVER_ERROR" }, { status: 500 })
  }
}
