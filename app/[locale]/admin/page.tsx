import { prisma } from "@/lib/prisma"
import { startOfDay, startOfMonth } from "date-fns"
import DashboardClient from "./DashboardClient"
import { setRequestLocale } from "next-intl/server"

export default async function AdminDashboard({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)

  const now = new Date()
  const todayStart = startOfDay(now)
  const monthStart = startOfMonth(now)

  const [
    todayRevenue,
    monthRevenue,
    pendingOrders,
    totalOrders,
    totalProducts,
    topSellingProducts,
    recentOrders,
    dailyRevenue,
  ] = await Promise.all([
    // Today's Sales
    prisma.orders.aggregate({
      where: {
        status: "paid",
        paid_at: { gte: todayStart },
      },
      _sum: {
        amount: true,
      },
    }),

    // This Month's Sales
    prisma.orders.aggregate({
      where: {
        status: "paid",
        paid_at: { gte: monthStart },
      },
      _sum: {
        amount: true,
      },
    }),

    // Pending orders
    prisma.orders.count({
      where: {
        status: "pending",
        fulfilled_at: null,
      },
    }),

    // Total orders
    prisma.orders.count(),

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

    // Revenue - last 7 days
    prisma.$queryRaw<{ day: Date; total: number }[]>`
      SELECT
        DATE_TRUNC('day', paid_at) AS day,
        SUM(amount)::float AS total
      FROM orders
      WHERE status = 'paid'
        AND paid_at >= NOW() - INTERVAL '7 days'
      GROUP BY 1
      ORDER BY 1
    `,
  ])

  const data = {
    todayRevenue: Number(todayRevenue._sum.amount ?? 0),
    monthRevenue: Number(monthRevenue._sum.amount ?? 0),
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
    })),

    dailyRevenue: dailyRevenue.map((d) => ({
      day: d.day.toISOString(),
      total: d.total,
    })),
  }

  return <DashboardClient data={data} />
}