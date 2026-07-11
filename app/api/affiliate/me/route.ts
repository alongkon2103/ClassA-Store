// app/api/affiliate/me/route.ts
//
// GET → the LOGGED-IN affiliate's own dashboard data: profile, codes + share
// links, commission totals, sales log, and payout history.
//
// Privacy: earnings expose date / product / amount only — NEVER the buyer's
// identity (name / email / ign). Scoped strictly to the caller's own user_id.

import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const userId = session.user.id

  const profile = await prisma.affiliate_profiles.findUnique({
    where: { user_id: userId },
    select: { default_commission_pct: true, payout_method: true, payout_detail: true, display_name: true, is_active: true },
  })
  // Not an affiliate → 403 (the page redirects too, this guards the API).
  if (!profile) return NextResponse.json({ error: "Not an affiliate" }, { status: 403 })

  const [codes, earnings, payouts, totals] = await Promise.all([
    prisma.discount_codes.findMany({
      where: { owner_user_id: userId },
      orderBy: { created_at: "desc" },
      select: {
        code: true, type: true, value: true, commission_pct: true,
        is_active: true, used_count: true, max_uses: true,
        product: { select: { name_en: true } },
      },
    }),
    prisma.affiliate_earnings.findMany({
      where: { affiliate_user_id: userId },
      orderBy: { created_at: "desc" },
      take: 200,
      // NOTE: no `order.user` / buyer fields — affiliate must not see who bought.
      select: {
        id: true, base_amount: true, commission_pct: true, commission_amount: true,
        status: true, created_at: true, paid_at: true,
        order: { select: { products: { select: { name_en: true } } } },
      },
    }),
    prisma.affiliate_payouts.findMany({
      where: { affiliate_user_id: userId },
      orderBy: { paid_at: "desc" },
      select: { id: true, amount: true, method: true, paid_at: true },
    }),
    prisma.affiliate_earnings.groupBy({
      by: ["status"],
      where: { affiliate_user_id: userId },
      _sum: { commission_amount: true },
      _count: { _all: true },
    }),
  ])

  const sumFor = (s: string) => Number(totals.find((t) => t.status === s)?._sum.commission_amount ?? 0)
  const countFor = (s: string) => totals.find((t) => t.status === s)?._count._all ?? 0

  return NextResponse.json({
    profile: {
      default_commission_pct: Number(profile.default_commission_pct),
      payout_method: profile.payout_method,
      payout_detail: profile.payout_detail,
      display_name: profile.display_name,
      is_active: profile.is_active,
    },
    totals: {
      pending: sumFor("pending"),
      paid: sumFor("paid"),
      sales_count: countFor("pending") + countFor("paid"),
    },
    codes: codes.map((c) => ({
      code: c.code,
      type: c.type,
      value: Number(c.value),
      commission_pct: c.commission_pct === null ? null : Number(c.commission_pct),
      is_active: c.is_active,
      used_count: c.used_count,
      max_uses: c.max_uses,
      product_name: c.product?.name_en ?? null,
    })),
    earnings: earnings.map((e) => ({
      id: e.id,
      base_amount: Number(e.base_amount),
      commission_pct: Number(e.commission_pct),
      commission_amount: Number(e.commission_amount),
      status: e.status, // 'reversed' shown as cancelled; no clawback detail leaked
      created_at: e.created_at.toISOString(),
      paid_at: e.paid_at?.toISOString() ?? null,
      product_name: e.order?.products?.name_en ?? null,
    })),
    payouts: payouts.map((p) => ({
      id: p.id,
      amount: Number(p.amount),
      method: p.method,
      paid_at: p.paid_at.toISOString(),
    })),
  })
}
