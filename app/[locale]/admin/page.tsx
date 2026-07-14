import { prisma } from "@/lib/prisma"
import DashboardClient from "./DashboardClient"
import { setRequestLocale } from "next-intl/server"
import { bangkokDayStart, bangkokMonthStart, bangkokDayKey } from "@/lib/bangkokTz"

export default async function AdminDashboard({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)

  const now = new Date()
  const todayStart = bangkokDayStart(now)
  const monthStart = bangkokMonthStart(now)
  // 7-day chart: include the current Bangkok day + the previous 6, i.e.
  // window starts at Bangkok midnight 6 days ago. Using NOW() - 7 days in
  // SQL would drift relative to wall-clock days under timezone offsets.
  const sevenDayStart = new Date(todayStart.getTime() - 6 * 24 * 60 * 60 * 1000)

  const [
    todayRevenue,
    todayManualRevenue,
    monthRevenue,
    monthManualRevenue,
    pendingOrders,
    totalOrders,
    totalProducts,
    topSellingProducts,
    recentOrders,
    dailyRevenue,
    todayAffiliate,
    monthAffiliate,
  ] = await Promise.all([
    // Today's Sales (total)
    prisma.orders.aggregate({
      where: {
        status: "paid",
        paid_at: { gte: todayStart },
        NOT: { order_type: "TRIAL" },
      },
      _sum: { amount: true },
    }),

    // Today's Sales — manual-only portion (admin-recorded outside Stripe)
    prisma.orders.aggregate({
      where: {
        status: "paid",
        paid_at: { gte: todayStart },
        recorded_by_id: { not: null },
        NOT: { order_type: "TRIAL" },
      },
      _sum: { amount: true },
      _count: true,
    }),

    // This Month's Sales (total)
    prisma.orders.aggregate({
      where: {
        status: "paid",
        paid_at: { gte: monthStart },
        NOT: { order_type: "TRIAL" },
      },
      _sum: { amount: true },
    }),

    // This Month's Sales — manual-only portion
    prisma.orders.aggregate({
      where: {
        status: "paid",
        paid_at: { gte: monthStart },
        recorded_by_id: { not: null },
        NOT: { order_type: "TRIAL" },
      },
      _sum: { amount: true },
      _count: true,
    }),

    // Pending orders
    prisma.orders.count({
      where: {
        status: "pending",
        fulfilled_at: null,
        NOT: { order_type: "TRIAL" },
      },
    }),

    // Total orders
    prisma.orders.count({
      where: {
        NOT: { order_type: "TRIAL" },
      },
    }),

    // Total active products
    prisma.products.count({
      where: {
        is_active: true,
      },
    }),

    // Top selling products
    prisma.products.findMany({
      where: {
        is_active: true,
      },
      select: {
        id: true,
        slug: true,
        name_th: true,
        name_en: true,
        _count: {
          select: {
            orders: {
              where: {
                status: "paid",
                NOT: { order_type: "TRIAL" },
              },
            },
          },
        },
      },
      orderBy: {
        orders: {
          _count: "desc",
        },
      },
      take: 5,
    }),

    // Recent orders
    prisma.orders.findMany({
      where: {
        NOT: { order_type: "TRIAL" },
      },
      take: 8,
      orderBy: {
        created_at: "desc",
      },
      include: {
        users: {
          select: {
            username: true,
            avatar: true,
          },
        },
        products: {
          select: {
            name_th: true,
            name_en: true,
          },
        },
      },
    }),

    // Revenue - last 7 Bangkok days (current day + previous 6).
    // Grouping happens in JS below, NOT in SQL: the DB server's clock is
    // misconfigured (instants stored 7h early) and the Prisma driver shifts
    // them back on read, so timestamps are only trustworthy AFTER they cross
    // the driver. SQL-side DATE_TRUNC bucketing lands sales on the wrong day.
    prisma.orders.findMany({
      where: {
        status: "paid",
        NOT: { order_type: "TRIAL" },
        paid_at: { gte: sevenDayStart },
      },
      select: { paid_at: true, amount: true },
    }),

    // Affiliate commission cost — accrual, aligned to order.paid_at (same window
    // as revenue). Excludes reversed (clawed-back) earnings. Grouped by status so
    // we can split committed (pending+requested) vs already paid out.
    prisma.affiliate_earnings.groupBy({
      by: ["status"],
      where: {
        status: { not: "reversed" },
        order: { status: "paid", paid_at: { gte: todayStart }, NOT: { order_type: "TRIAL" } },
      },
      _sum: { commission_amount: true },
    }),
    prisma.affiliate_earnings.groupBy({
      by: ["status"],
      where: {
        status: { not: "reversed" },
        order: { status: "paid", paid_at: { gte: monthStart }, NOT: { order_type: "TRIAL" } },
      },
      _sum: { commission_amount: true },
    }),
  ])

  // Roll a grouped-by-status earning result into { total, committed, paid }.
  type AffGroup = { status: string; _sum: { commission_amount: unknown } }
  const affSummary = (rows: AffGroup[]) => {
    const s = (st: string) => Number(rows.find((r) => r.status === st)?._sum.commission_amount ?? 0)
    const committed = s("pending") + s("requested")
    const paid = s("paid")
    return { total: Math.round((committed + paid) * 100) / 100, committed: Math.round(committed * 100) / 100, paid: Math.round(paid * 100) / 100 }
  }
  const todayAff = affSummary(todayAffiliate)
  const monthAff = affSummary(monthAffiliate)

  // Group the last-7-days orders by Bangkok calendar day (driver-corrected
  // timestamps, same read path as the cards — so chart and cards ALWAYS agree).
  const revenueByDay = new Map<string, number>()
  for (const o of dailyRevenue) {
    if (!o.paid_at) continue
    const k = bangkokDayKey(o.paid_at)
    revenueByDay.set(k, (revenueByDay.get(k) ?? 0) + Number(o.amount))
  }

  const data = {
    todayRevenue: Number(todayRevenue._sum.amount ?? 0),
    todayManualRevenue: Number(todayManualRevenue._sum.amount ?? 0),
    todayManualCount: todayManualRevenue._count,
    monthRevenue: Number(monthRevenue._sum.amount ?? 0),
    monthManualRevenue: Number(monthManualRevenue._sum.amount ?? 0),
    monthManualCount: monthManualRevenue._count,
    // Affiliate commission cost (accrual) + store net after it.
    todayAffiliate: todayAff,
    monthAffiliate: monthAff,
    todayNet: Math.round((Number(todayRevenue._sum.amount ?? 0) - todayAff.total) * 100) / 100,
    monthNet: Math.round((Number(monthRevenue._sum.amount ?? 0) - monthAff.total) * 100) / 100,
    pendingOrders,
    totalOrders,
    totalProducts,

    topSellingProducts: topSellingProducts.map((p) => ({
      ...p,
      salesCount: p._count.orders,
    })),

    recentOrders: recentOrders.map((o) => ({
      ...o,
      amount: Number(o.amount),
      discount_amount: o.discount_amount === null ? null : Number(o.discount_amount),
      expected_amount: o.expected_amount === null ? null : Number(o.expected_amount),
    })),

    // Chart-ready: exactly 7 rows keyed by Bangkok calendar day ("YYYY-MM-DD"),
    // zero-filled. Matching by day KEY (not timestamp) means the viewer's
    // browser timezone can never shift a sale onto the wrong bar, and a day
    // with no sales shows as ฿0 instead of disappearing.
    dailyRevenue: Array.from({ length: 7 }, (_, i) => {
      const key = bangkokDayKey(new Date(sevenDayStart.getTime() + i * 24 * 60 * 60 * 1000))
      return { day: key, total: revenueByDay.get(key) ?? 0 }
    }),
  }

  return <DashboardClient data={data} />
}