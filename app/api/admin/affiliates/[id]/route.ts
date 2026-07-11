// app/api/admin/affiliates/[id]/route.ts   ([id] = affiliate user_id)
//
// GET    → full detail: profile, owned codes, earnings list, payout history.
// PATCH  → edit the profile (default rate, payout info, active flag).
// DELETE → revoke affiliate status (safe): refuses while commission is still
//          owed, then disables their codes, deletes the profile and demotes the
//          user back to a normal account. Earnings/payout HISTORY is kept.

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { validateAdmin } from "@/lib/adminAuth"

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const admin = await validateAdmin(["admin"])
  if (!admin.isValid) return admin.response

  const { id } = await params
  const profile = await prisma.affiliate_profiles.findUnique({
    where: { user_id: id },
    include: { user: { select: { id: true, username: true, email: true, avatar: true } } },
  })
  if (!profile) return NextResponse.json({ error: "Affiliate not found" }, { status: 404 })

  const [codes, earnings, payouts, products] = await Promise.all([
    prisma.discount_codes.findMany({
      where: { owner_user_id: id },
      orderBy: { created_at: "desc" },
      select: {
        id: true, code: true, type: true, value: true, commission_pct: true,
        is_active: true, used_count: true, max_uses: true, product_id: true,
        product: { select: { name_en: true } },
      },
    }),
    // Earnings without buyer identity — the admin can see product/date/amount.
    prisma.affiliate_earnings.findMany({
      where: { affiliate_user_id: id },
      orderBy: { created_at: "desc" },
      take: 200,
      select: {
        id: true, base_amount: true, commission_pct: true, commission_amount: true,
        status: true, clawback: true, created_at: true, paid_at: true,
        order: { select: { products: { select: { name_en: true } } } },
      },
    }),
    prisma.affiliate_payouts.findMany({
      where: { affiliate_user_id: id },
      orderBy: { paid_at: "desc" },
      select: { id: true, amount: true, method: true, note: true, paid_at: true },
    }),
    // Active products for the "which product does this code apply to?" picker.
    prisma.products.findMany({
      where: { is_active: true },
      select: { id: true, name_en: true },
      orderBy: { name_en: "asc" },
    }),
  ])

  return NextResponse.json({
    profile: {
      user_id: profile.user_id,
      username: profile.user.username,
      email: profile.user.email,
      avatar: profile.user.avatar,
      default_commission_pct: Number(profile.default_commission_pct),
      payout_method: profile.payout_method,
      payout_detail: profile.payout_detail,
      display_name: profile.display_name,
      is_active: profile.is_active,
    },
    codes: codes.map((c) => ({
      ...c,
      value: Number(c.value),
      commission_pct: c.commission_pct === null ? null : Number(c.commission_pct),
      product_name: c.product?.name_en ?? null,
    })),
    earnings: earnings.map((e) => ({
      id: e.id,
      base_amount: Number(e.base_amount),
      commission_pct: Number(e.commission_pct),
      commission_amount: Number(e.commission_amount),
      status: e.status,
      clawback: e.clawback,
      created_at: e.created_at.toISOString(),
      paid_at: e.paid_at?.toISOString() ?? null,
      product_name: e.order?.products?.name_en ?? null,
    })),
    payouts: payouts.map((p) => ({
      id: p.id,
      amount: Number(p.amount),
      method: p.method,
      note: p.note,
      paid_at: p.paid_at.toISOString(),
    })),
    products: products.map((p) => ({ id: p.id, name: p.name_en })),
  })
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const admin = await validateAdmin(["admin"])
  if (!admin.isValid) return admin.response

  try {
    const { id } = await params
    const body = await req.json()
    const data: {
      default_commission_pct?: number
      payout_method?: string | null
      payout_detail?: string | null
      display_name?: string | null
      is_active?: boolean
      updated_at?: Date
    } = {}

    if (body.default_commission_pct !== undefined) {
      const p = Number(body.default_commission_pct)
      if (!Number.isFinite(p) || p < 0 || p > 100) {
        return NextResponse.json({ error: "default_commission_pct must be 0-100" }, { status: 400 })
      }
      data.default_commission_pct = p
    }
    if (body.payout_method !== undefined) data.payout_method = body.payout_method?.trim() || null
    if (body.payout_detail !== undefined) data.payout_detail = body.payout_detail?.trim() || null
    if (body.display_name !== undefined) data.display_name = body.display_name?.trim() || null
    if (body.is_active !== undefined) data.is_active = Boolean(body.is_active)

    const updated = await prisma.affiliate_profiles.update({ where: { user_id: id }, data })
    return NextResponse.json({ ok: true, user_id: updated.user_id })
  } catch (err: unknown) {
    console.error("PATCH affiliate error:", err)
    return NextResponse.json({ error: "Failed to update affiliate" }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const admin = await validateAdmin(["admin"])
  if (!admin.isValid) return admin.response

  try {
    const { id } = await params
    const profile = await prisma.affiliate_profiles.findUnique({ where: { user_id: id }, select: { user_id: true } })
    if (!profile) return NextResponse.json({ error: "Affiliate not found" }, { status: 404 })

    // Safety: never revoke while commission is still owed — the pending earnings
    // would be stranded (money the store owes). Admin must pay out first.
    const pending = await prisma.affiliate_earnings.aggregate({
      where: { affiliate_user_id: id, status: "pending" },
      _sum: { commission_amount: true },
      _count: { _all: true },
    })
    const pendingAmount = Number(pending._sum.commission_amount ?? 0)
    if (pending._count._all > 0) {
      return NextResponse.json(
        { error: "PENDING_EXISTS", errorCode: "PENDING_EXISTS", pending_amount: pendingAmount },
        { status: 409 },
      )
    }

    await prisma.$transaction(async (tx) => {
      // Disable their codes so no further redemptions earn commission. Ownership
      // is kept so historical earnings still trace back to their code.
      await tx.discount_codes.updateMany({ where: { owner_user_id: id }, data: { is_active: false } })
      // Remove the affiliate profile (the source of truth for "is an affiliate").
      // Earnings + payouts stay — they reference the USER (not the profile) and
      // are financial history that must survive.
      await tx.affiliate_profiles.delete({ where: { user_id: id } })
      // Demote back to a normal account (only if still an affiliate).
      await tx.users.updateMany({ where: { id, role: "affiliate" }, data: { role: "user" } })
    })

    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    console.error("DELETE affiliate error:", err)
    return NextResponse.json({ error: "Failed to remove affiliate" }, { status: 500 })
  }
}
