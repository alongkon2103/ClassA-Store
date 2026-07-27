// app/api/admin/affiliates/settings/route.ts
//
// GET   → { min_withdraw, withdraw_wait_days }
// PATCH → set either/both (each field optional; only provided ones are saved)

import { NextRequest, NextResponse } from "next/server"
import { validateAdmin } from "@/lib/adminAuth"
import {
  getAffiliateMinWithdraw, setAffiliateMinWithdraw,
  getAffiliateWithdrawWaitDays, setAffiliateWithdrawWaitDays,
} from "@/lib/affiliateConfig"

export const dynamic = "force-dynamic"

export async function GET() {
  const admin = await validateAdmin(["admin"])
  if (!admin.isValid) return admin.response
  const [min_withdraw, withdraw_wait_days] = await Promise.all([
    getAffiliateMinWithdraw(),
    getAffiliateWithdrawWaitDays(),
  ])
  return NextResponse.json({ min_withdraw, withdraw_wait_days })
}

export async function PATCH(req: NextRequest) {
  const admin = await validateAdmin(["admin"])
  if (!admin.isValid) return admin.response

  const body = await req.json().catch(() => ({}))

  if (body.min_withdraw !== undefined) {
    const n = Number(body.min_withdraw)
    if (!Number.isFinite(n) || n < 0) {
      return NextResponse.json({ error: "min_withdraw must be >= 0" }, { status: 400 })
    }
    await setAffiliateMinWithdraw(Math.round(n * 100) / 100)
  }

  if (body.withdraw_wait_days !== undefined) {
    const d = Number(body.withdraw_wait_days)
    if (!Number.isFinite(d) || d < 0) {
      return NextResponse.json({ error: "withdraw_wait_days must be >= 0" }, { status: 400 })
    }
    await setAffiliateWithdrawWaitDays(Math.floor(d))
  }

  const [min_withdraw, withdraw_wait_days] = await Promise.all([
    getAffiliateMinWithdraw(),
    getAffiliateWithdrawWaitDays(),
  ])
  return NextResponse.json({ ok: true, min_withdraw, withdraw_wait_days })
}
