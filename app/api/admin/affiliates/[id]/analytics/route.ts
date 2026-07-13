// app/api/admin/affiliates/[id]/analytics/route.ts
//
// GET → deep analytics for ONE affiliate: summary totals, per-code and
// per-product breakdowns, a monthly time series, and a detailed order log
// (admin CAN see the buyer — unlike the affiliate's own dashboard).
//
// All bucketing/formatting is done in JS, never in SQL — the production DB
// stores timestamps 7h early and the Prisma driver read-shifts them back, so a
// JS-side `created_at` is the correct instant but any SQL DATE_TRUNC would be
// wrong (see memory: db-timestamps-shifted-7h).

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { validateAdmin } from "@/lib/adminAuth"

export const dynamic = "force-dynamic"

const n2 = (n: number) => Math.round(n * 100) / 100

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await validateAdmin(["admin"])
  if (!admin.isValid) return admin.response
  const { id } = await params

  const profile = await prisma.affiliate_profiles.findUnique({
    where: { user_id: id },
    include: { user: { select: { username: true, email: true, avatar: true } } },
  })
  if (!profile) return NextResponse.json({ error: "Affiliate not found" }, { status: 404 })

  const earnings = await prisma.affiliate_earnings.findMany({
    where: { affiliate_user_id: id },
    orderBy: { created_at: "desc" },
    select: {
      id: true, base_amount: true, commission_amount: true, commission_pct: true,
      status: true, clawback: true, created_at: true,
      discount_code: { select: { code: true } },
      order: {
        select: {
          amount: true, discount_amount: true, payment_method: true, whitelisted_username: true,
          discount_code_id: true, referral_code_id: true,
          products: { select: { name_en: true } },
          users: { select: { username: true, email: true } },
        },
      },
    },
  })

  // ── Summary (a reversed/clawed-back earning doesn't count as a live sale) ──
  const live = earnings.filter((e) => e.status !== "reversed")
  const sum = (arr: typeof earnings, f: (e: typeof earnings[number]) => number) => arr.reduce((s, e) => s + f(e), 0)
  const comm = (e: typeof earnings[number]) => Number(e.commission_amount)
  const base = (e: typeof earnings[number]) => Number(e.base_amount)

  const byStatus = (st: string) => {
    const rows = earnings.filter((e) => e.status === st)
    return { count: rows.length, amount: n2(sum(rows, comm)) }
  }

  const totalOrders = live.length
  const totalSales = n2(sum(live, base))
  const totalCommission = n2(sum(live, comm))

  const summary = {
    total_orders: totalOrders,
    total_sales: totalSales,
    total_commission: totalCommission,
    avg_sale: totalOrders ? n2(totalSales / totalOrders) : 0,
    avg_commission: totalOrders ? n2(totalCommission / totalOrders) : 0,
    pending: byStatus("pending"),
    requested: byStatus("requested"),
    paid: byStatus("paid"),
    reversed: byStatus("reversed"),
    clawback_count: earnings.filter((e) => e.clawback).length,
  }

  // ── Per-code breakdown (which code earned) ──
  const codeMap = new Map<string, { code: string; orders: number; sales: number; commission: number }>()
  for (const e of live) {
    const key = e.discount_code?.code ?? "—"
    const row = codeMap.get(key) ?? { code: key, orders: 0, sales: 0, commission: 0 }
    row.orders += 1; row.sales += base(e); row.commission += comm(e)
    codeMap.set(key, row)
  }
  const per_code = [...codeMap.values()]
    .map((r) => ({ ...r, sales: n2(r.sales), commission: n2(r.commission) }))
    .sort((a, b) => b.commission - a.commission)

  // ── Per-product breakdown (which game was sold) ──
  const prodMap = new Map<string, { product: string; orders: number; sales: number; commission: number }>()
  for (const e of live) {
    const key = e.order?.products?.name_en ?? "—"
    const row = prodMap.get(key) ?? { product: key, orders: 0, sales: 0, commission: 0 }
    row.orders += 1; row.sales += base(e); row.commission += comm(e)
    prodMap.set(key, row)
  }
  const per_product = [...prodMap.values()]
    .map((r) => ({ ...r, sales: n2(r.sales), commission: n2(r.commission) }))
    .sort((a, b) => b.commission - a.commission)

  // ── Monthly time series (last 12 Bangkok months, zero-filled) ──
  // Bucket key is the Bangkok year-month ("YYYY-MM"). Formatting the instant in
  // the Bangkok tz (not UTC) is essential: a UTC slice would push start-of-month
  // rows into the previous month.
  const monthKey = (d: Date) =>
    new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit" }).format(d)
  const tsMap = new Map<string, { orders: number; sales: number; commission: number }>()
  for (const e of live) {
    const key = monthKey(e.created_at)
    const row = tsMap.get(key) ?? { orders: 0, sales: 0, commission: 0 }
    row.orders += 1; row.sales += base(e); row.commission += comm(e)
    tsMap.set(key, row)
  }
  // Build the last 12 month keys from integer year/month (no tz drift).
  let [yy, mm] = monthKey(new Date()).split("-").map(Number)
  const timeseries: { month: string; orders: number; sales: number; commission: number }[] = []
  for (let i = 0; i < 12; i++) {
    const key = `${yy}-${String(mm).padStart(2, "0")}`
    const row = tsMap.get(key) ?? { orders: 0, sales: 0, commission: 0 }
    timeseries.unshift({ month: key, orders: row.orders, sales: n2(row.sales), commission: n2(row.commission) })
    mm--; if (mm === 0) { mm = 12; yy-- }
  }

  // ── Detailed order log (admin sees the buyer) ──
  const orders = earnings.map((e) => ({
    id: e.id,
    date: e.created_at.toISOString(),
    buyer: e.order?.users?.username ?? null,
    buyer_email: e.order?.users?.email ?? null,
    ign: e.order?.whitelisted_username ?? null,
    product: e.order?.products?.name_en ?? null,
    payment_method: e.order?.payment_method ?? null,
    sale_amount: e.order ? Number(e.order.amount) : 0,
    discount: e.order?.discount_amount ? Number(e.order.discount_amount) : 0,
    commission: Number(e.commission_amount),
    commission_pct: Number(e.commission_pct),
    status: e.status,
    // How the affiliate was credited on this order.
    attribution: e.order?.discount_code_id ? "code" : e.order?.referral_code_id ? "referral" : "—",
    code: e.discount_code?.code ?? null,
  }))

  return NextResponse.json({
    profile: {
      user_id: id,
      username: profile.user.username,
      email: profile.user.email,
      avatar: profile.user.avatar,
      display_name: profile.display_name,
      default_commission_pct: Number(profile.default_commission_pct),
      is_active: profile.is_active,
    },
    summary,
    per_code,
    per_product,
    timeseries,
    orders,
  })
}
