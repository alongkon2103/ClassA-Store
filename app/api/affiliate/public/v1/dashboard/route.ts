// app/api/affiliate/public/v1/dashboard/route.ts
//
// PUBLIC affiliate API (key-authenticated) — the affiliate's OWN data so they
// can build their own dashboard. Read-only. Never exposes buyer identity
// (name/email/ign), matching the in-app affiliate dashboard.
//
// Auth: Authorization: Bearer <key>  (or  x-api-key: <key>)
// Gated by affiliate_profiles.api_enabled — admin can revoke instantly.

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { authenticateApiKey } from "@/lib/affiliateApi"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, X-Api-Key, Content-Type",
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

export async function GET(req: Request) {
  const auth = await authenticateApiKey(req)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status, headers: CORS })
  const userId = auth.userId

  const [profile, codes, earnings, payouts, totals] = await Promise.all([
    prisma.affiliate_profiles.findUnique({
      where: { user_id: userId },
      select: { default_commission_pct: true, display_name: true, is_active: true },
    }),
    prisma.discount_codes.findMany({
      where: { owner_user_id: userId },
      orderBy: { created_at: "desc" },
      select: {
        code: true, type: true, value: true, commission_pct: true, is_active: true,
        used_count: true, max_uses: true, per_user_limit: true,
        product: { select: { name_en: true } },
      },
    }),
    prisma.affiliate_earnings.findMany({
      where: { affiliate_user_id: userId },
      orderBy: { created_at: "desc" },
      take: 1000,
      // NO buyer identity — product/date/amounts only.
      select: {
        base_amount: true, commission_pct: true, commission_amount: true, status: true,
        created_at: true, paid_at: true,
        order: {
          select: {
            products: {
              select: {
                name_en: true,
              },
            },

            whitelisted_username:true,
            users: {
              select: {
                email: true,
              },
            },
          },
        },
      }
    }),
    prisma.affiliate_payouts.findMany({
      where: { affiliate_user_id: userId },
      orderBy: { created_at: "desc" },
      select: { amount: true, method: true, status: true, requested_at: true, paid_at: true },
    }),
    prisma.affiliate_earnings.groupBy({
      by: ["status"],
      where: { affiliate_user_id: userId },
      _sum: { commission_amount: true },
      _count: { _all: true },
    }),
  ])
  if (!profile) return NextResponse.json({ error: "Not an affiliate" }, { status: 403, headers: CORS })

  const sumFor = (s: string) => Number(totals.find((t) => t.status === s)?._sum.commission_amount ?? 0)
  const countFor = (s: string) => totals.find((t) => t.status === s)?._count._all ?? 0

  return NextResponse.json({
    profile: {
      display_name: profile.display_name,
      commission_pct: Number(profile.default_commission_pct),
      is_active: profile.is_active,
    },
    totals: {
      pending: sumFor("pending"),
      requested: sumFor("requested"),
      paid: sumFor("paid"),
      sales_count: countFor("pending") + countFor("requested") + countFor("paid"),
      currency: "THB",
    },
    codes: codes.map((c) => ({
      code: c.code,
      type: c.type,
      value: Number(c.value),
      commission_pct: c.commission_pct === null ? null : Number(c.commission_pct),
      product: c.product?.name_en ?? null,
      is_active: c.is_active,
      used_count: c.used_count,
      max_uses: c.max_uses,
      per_user_limit: c.per_user_limit,
    })),
    sales: earnings.map((e) => ({
      date: e.created_at.toISOString(),
      product: e.order?.products?.name_en ?? null,
      whitelisted_username : e.order?.whitelisted_username ?? null,
      email: e.order?.users?.email ?? null,

      sale_amount: Number(e.base_amount),
      commission_pct: Number(e.commission_pct),
      commission: Number(e.commission_amount),
      status: e.status,
      paid_at: e.paid_at?.toISOString() ?? null,
    })),
    payouts: payouts.map((p) => ({
      amount: Number(p.amount),
      method: p.method,
      status: p.status,
      requested_at: p.requested_at?.toISOString() ?? null,
      paid_at: p.paid_at?.toISOString() ?? null,
    })),
  }, { headers: CORS })
}
