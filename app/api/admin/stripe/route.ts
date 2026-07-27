// app/api/admin/stripe/route.ts
//
// GET → the live Stripe dashboard payload for /admin/stripe:
//   { today, period, balance, payouts, meta }
// All money is REAL (from Stripe Balance Transactions / Payouts / Balance),
// converted to major units and bucketed by Asia/Bangkok day. Admin-only.
//
// Query:
//   ?month=YYYY-MM   period scope (default = current Bangkok month)
//   ?fresh=1         bypass the 60s cache (manual refresh)

import { NextRequest, NextResponse } from "next/server"
import { validateAdmin } from "@/lib/adminAuth"
import { parseBangkokDay, bangkokDayStart, bangkokMonthStart } from "@/lib/bangkokTz"
import { getStripeReport, getStripeBalance, getStripePayouts } from "@/lib/stripeDashboard"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const admin = await validateAdmin(["admin"])
  if (!admin.isValid) return admin.response

  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: "STRIPE_SECRET_KEY not configured" }, { status: 500 })
  }

  const { searchParams } = new URL(req.url)
  const monthParam = searchParams.get("month")
  const fresh = searchParams.get("fresh") === "1"

  const now = new Date()

  // Period = the selected Bangkok month (default: current). `periodTo` never
  // runs past "now" so a partial current month isn't padded with empty days.
  let periodFrom: Date
  let periodToCap: Date
  if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
    const first = parseBangkokDay(`${monthParam}-01`, false)
    if (!first) return NextResponse.json({ error: "bad month" }, { status: 400 })
    const [y, m] = monthParam.split("-").map(Number)
    const ny = m === 12 ? y + 1 : y
    const nm = m === 12 ? 1 : m + 1
    const next = parseBangkokDay(`${ny}-${String(nm).padStart(2, "0")}-01`, false)!
    periodFrom = first
    periodToCap = new Date(next.getTime() - 1)
  } else {
    periodFrom = bangkokMonthStart(now)
    periodToCap = now
  }
  const periodTo = periodToCap.getTime() > now.getTime() ? now : periodToCap

  const todayFrom = bangkokDayStart(now)

  const [today, period, balance, payouts] = await Promise.all([
    getStripeReport(todayFrom.getTime(), now.getTime(), fresh),
    getStripeReport(periodFrom.getTime(), periodTo.getTime(), fresh),
    getStripeBalance().catch(() => ({ available: [], pending: [] })),
    getStripePayouts(12).catch(() => []),
  ])

  return NextResponse.json({
    today,
    period,
    balance,
    payouts,
    meta: {
      month: monthParam && /^\d{4}-\d{2}$/.test(monthParam) ? monthParam : null,
      period_from: periodFrom.toISOString(),
      period_to: periodTo.toISOString(),
      generated_at: now.toISOString(),
    },
  })
}
