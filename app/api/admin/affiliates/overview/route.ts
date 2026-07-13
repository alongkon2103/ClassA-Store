// app/api/admin/affiliates/overview/route.ts
//
// GET → program-wide affiliate overview for admin: totals across all affiliates,
// a leaderboard, and a monthly commission time series. Bucketing is done in JS
// (never SQL) — see memory: db-timestamps-shifted-7h.

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { validateAdmin } from "@/lib/adminAuth"

export const dynamic = "force-dynamic"

const n2 = (n: number) => Math.round(n * 100) / 100

export async function GET() {
  const admin = await validateAdmin(["admin"])
  if (!admin.isValid) return admin.response

  const [profiles, byUserStatus, payoutAgg, earningRows] = await Promise.all([
    prisma.affiliate_profiles.findMany({
      include: { user: { select: { username: true, avatar: true } } },
    }),
    prisma.affiliate_earnings.groupBy({
      by: ["affiliate_user_id", "status"],
      _sum: { commission_amount: true, base_amount: true },
      _count: { _all: true },
    }),
    prisma.affiliate_payouts.groupBy({
      by: ["status"],
      _sum: { amount: true },
      _count: { _all: true },
    }),
    // Minimal rows for the JS monthly time series (program-wide, live only).
    prisma.affiliate_earnings.findMany({
      where: { status: { not: "reversed" } },
      select: { created_at: true, commission_amount: true },
    }),
  ])

  // ── Per-affiliate rollup + program totals ──
  type Agg = { orders: number; sales: number; commission: number; pending: number; requested: number; paid: number }
  const perUser = new Map<string, Agg>()
  const ensure = (uid: string): Agg => {
    let a = perUser.get(uid)
    if (!a) { a = { orders: 0, sales: 0, commission: 0, pending: 0, requested: 0, paid: 0 }; perUser.set(uid, a) }
    return a
  }
  for (const r of byUserStatus) {
    const a = ensure(r.affiliate_user_id)
    const comm = Number(r._sum.commission_amount ?? 0)
    const sales = Number(r._sum.base_amount ?? 0)
    if (r.status !== "reversed") { a.orders += r._count._all; a.sales += sales; a.commission += comm }
    if (r.status === "pending") a.pending += comm
    if (r.status === "requested") a.requested += comm
    if (r.status === "paid") a.paid += comm
  }

  const nameOf = new Map(profiles.map((p) => [p.user_id, { name: p.display_name || p.user.username, avatar: p.user.avatar, active: p.is_active }]))

  const leaderboard = [...perUser.entries()]
    .map(([uid, a]) => ({
      user_id: uid,
      name: nameOf.get(uid)?.name ?? "—",
      avatar: nameOf.get(uid)?.avatar ?? null,
      is_active: nameOf.get(uid)?.active ?? true,
      orders: a.orders,
      sales: n2(a.sales),
      commission: n2(a.commission),
      pending: n2(a.pending),
      paid: n2(a.paid),
    }))
    .sort((a, b) => b.commission - a.commission)

  const totals = {
    affiliate_count: profiles.length,
    active_count: profiles.filter((p) => p.is_active).length,
    total_orders: leaderboard.reduce((s, r) => s + r.orders, 0),
    total_sales: n2(leaderboard.reduce((s, r) => s + r.sales, 0)),
    total_commission: n2(leaderboard.reduce((s, r) => s + r.commission, 0)),
    pending: n2(leaderboard.reduce((s, r) => s + r.pending, 0)),
    requested: n2(byUserStatus.filter((r) => r.status === "requested").reduce((s, r) => s + Number(r._sum.commission_amount ?? 0), 0)),
    paid_out: n2(Number(payoutAgg.find((p) => p.status === "paid")?._sum.amount ?? 0)),
    open_requests: {
      count: payoutAgg.find((p) => p.status === "requested")?._count._all ?? 0,
      amount: n2(Number(payoutAgg.find((p) => p.status === "requested")?._sum.amount ?? 0)),
    },
  }

  // ── Monthly commission time series (last 12 Bangkok months, zero-filled) ──
  const monthKey = (dt: Date) =>
    new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit" }).format(dt)
  const tsMap = new Map<string, number>()
  for (const e of earningRows) {
    const key = monthKey(e.created_at)
    tsMap.set(key, (tsMap.get(key) ?? 0) + Number(e.commission_amount))
  }
  let [yy, mm] = monthKey(new Date()).split("-").map(Number)
  const timeseries: { month: string; commission: number }[] = []
  for (let i = 0; i < 12; i++) {
    const key = `${yy}-${String(mm).padStart(2, "0")}`
    timeseries.unshift({ month: key, commission: n2(tsMap.get(key) ?? 0) })
    mm--; if (mm === 0) { mm = 12; yy-- }
  }

  return NextResponse.json({ totals, leaderboard, timeseries })
}
