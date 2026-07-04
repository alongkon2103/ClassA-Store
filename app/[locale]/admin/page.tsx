import { prisma } from "@/lib/prisma"
import DashboardClient from "./DashboardClient"
import { setRequestLocale } from "next-intl/server"
import { bangkokDayStart, bangkokMonthStart, bangkokBucketSql } from "@/lib/bangkokTz"

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

    // Revenue - last 7 Bangkok days (current day + previous 6)
    prisma.$queryRaw<{ day: Date; total: number }[]>`
      SELECT
        ${bangkokBucketSql("day")} AS day,
        SUM(amount)::float AS total
      FROM orders
      WHERE status = 'paid'
        AND order_type != 'TRIAL'
        AND paid_at IS NOT NULL
        AND paid_at >= ${sevenDayStart}
      GROUP BY 1
      ORDER BY 1
    `,
  ])

  const data = {
    todayRevenue: Number(todayRevenue._sum.amount ?? 0),
    todayManualRevenue: Number(todayManualRevenue._sum.amount ?? 0),
    todayManualCount: todayManualRevenue._count,
    monthRevenue: Number(monthRevenue._sum.amount ?? 0),
    monthManualRevenue: Number(monthManualRevenue._sum.amount ?? 0),
    monthManualCount: monthManualRevenue._count,
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

    dailyRevenue: dailyRevenue.map((d) => ({
      day: d.day.toISOString(),
      total: d.total,
    })),
  }

  return <DashboardClient data={data} />
}