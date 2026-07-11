// app/api/admin/affiliates/settings/route.ts
//
// GET   → { min_withdraw }   (the minimum an affiliate can self-withdraw)
// PATCH → set min_withdraw

import { NextRequest, NextResponse } from "next/server"
import { validateAdmin } from "@/lib/adminAuth"
import { getAffiliateMinWithdraw, setAffiliateMinWithdraw } from "@/lib/affiliateConfig"

export const dynamic = "force-dynamic"

export async function GET() {
  const admin = await validateAdmin(["admin"])
  if (!admin.isValid) return admin.response
  return NextResponse.json({ min_withdraw: await getAffiliateMinWithdraw() })
}

export async function PATCH(req: NextRequest) {
  const admin = await validateAdmin(["admin"])
  if (!admin.isValid) return admin.response

  const body = await req.json().catch(() => ({}))
  const n = Number(body.min_withdraw)
  if (!Number.isFinite(n) || n < 0) {
    return NextResponse.json({ error: "min_withdraw must be >= 0" }, { status: 400 })
  }
  await setAffiliateMinWithdraw(Math.round(n * 100) / 100)
  return NextResponse.json({ ok: true, min_withdraw: Math.round(n * 100) / 100 })
}
