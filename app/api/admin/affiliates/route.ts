// app/api/admin/affiliates/route.ts
//
// GET  → list every affiliate with rolled-up earnings (pending/paid totals, code
//        count, sale count).
// POST → make an existing user an affiliate: set role=affiliate + upsert their
//        affiliate_profiles row (default rate + payout details).

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { validateAdmin } from "@/lib/adminAuth"

export async function GET() {
  const admin = await validateAdmin(["admin"])
  if (!admin.isValid) return admin.response

  const profiles = await prisma.affiliate_profiles.findMany({
    orderBy: { created_at: "desc" },
    include: {
      user: { select: { id: true, username: true, email: true, avatar: true, role: true } },
    },
  })

  // Aggregate earnings per affiliate in two grouped queries (cheap) instead of
  // N per-affiliate queries.
  const [byStatus, codeCounts] = await Promise.all([
    prisma.affiliate_earnings.groupBy({
      by: ["affiliate_user_id", "status"],
      _sum: { commission_amount: true },
      _count: { _all: true },
    }),
    prisma.discount_codes.groupBy({
      by: ["owner_user_id"],
      where: { owner_user_id: { not: null } },
      _count: { _all: true },
    }),
  ])

  const sumFor = (uid: string, status: string) =>
    Number(
      byStatus.find((r) => r.affiliate_user_id === uid && r.status === status)?._sum.commission_amount ?? 0,
    )
  const countFor = (uid: string, status: string) =>
    byStatus.find((r) => r.affiliate_user_id === uid && r.status === status)?._count._all ?? 0

  const rows = profiles.map((p) => ({
    user_id: p.user_id,
    username: p.user.username,
    email: p.user.email,
    avatar: p.user.avatar,
    default_commission_pct: Number(p.default_commission_pct),
    payout_method: p.payout_method,
    payout_detail: p.payout_detail,
    display_name: p.display_name,
    is_active: p.is_active,
    code_count: codeCounts.find((c) => c.owner_user_id === p.user_id)?._count._all ?? 0,
    pending_amount: sumFor(p.user_id, "pending"),
    paid_amount: sumFor(p.user_id, "paid"),
    pending_count: countFor(p.user_id, "pending"),
  }))

  return NextResponse.json(rows)
}

export async function POST(req: NextRequest) {
  const admin = await validateAdmin(["admin"])
  if (!admin.isValid) return admin.response

  try {
    const body = await req.json()
    // Identify the user by id or exact email.
    const userId: string | null = body.user_id?.trim() || null
    const email: string | null = body.email?.trim().toLowerCase() || null

    const user = userId
      ? await prisma.users.findUnique({ where: { id: userId } })
      : email
        ? await prisma.users.findUnique({ where: { email } })
        : null

    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })

    const defaultPct = Number(body.default_commission_pct)
    if (!Number.isFinite(defaultPct) || defaultPct < 0 || defaultPct > 100) {
      return NextResponse.json({ error: "default_commission_pct must be 0-100" }, { status: 400 })
    }

    // Never demote an admin by accident — refuse to convert an admin/partnership
    // account into an affiliate.
    if (user.role === "admin" || user.role === "partnership") {
      return NextResponse.json(
        { error: `Cannot convert a ${user.role} account into an affiliate` },
        { status: 400 },
      )
    }

    const result = await prisma.$transaction(async (tx) => {
      await tx.users.update({ where: { id: user.id }, data: { role: "affiliate" } })
      return tx.affiliate_profiles.upsert({
        where: { user_id: user.id },
        create: {
          user_id: user.id,
          default_commission_pct: defaultPct,
          payout_method: body.payout_method?.trim() || null,
          payout_detail: body.payout_detail?.trim() || null,
          display_name: body.display_name?.trim() || null,
        },
        update: {
          default_commission_pct: defaultPct,
          payout_method: body.payout_method?.trim() || null,
          payout_detail: body.payout_detail?.trim() || null,
          display_name: body.display_name?.trim() || null,
          is_active: true,
        },
      })
    })

    return NextResponse.json({ ok: true, user_id: result.user_id })
  } catch (err: unknown) {
    console.error("POST affiliate error:", err)
    return NextResponse.json({ error: "Failed to create affiliate" }, { status: 500 })
  }
}
