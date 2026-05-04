// app/admin/page.tsx
import { prisma } from "@/lib/prisma"
import { startOfDay, startOfMonth } from "date-fns"
import DashboardClient from "./DashboardClient"

export default async function AdminDashboard() {
  const now = new Date()
  const todayStart = startOfDay(now)
  const monthStart = startOfMonth(now)

  const [
    todayRevenue,
    monthRevenue,
    pendingOrders,
    totalOrders,
    totalProducts,
    lowStockProducts,
    recentOrders,
    dailyRevenue,
  ] = await Promise.all([
    // ยอดขายวันนี้
    prisma.orders.aggregate({
      where: { status: "paid", paid_at: { gte: todayStart } },
      _sum: { amount: true },
    }),

    // ยอดขายเดือนนี้
    prisma.orders.aggregate({
      where: { status: "paid", paid_at: { gte: monthStart } },
      _sum: { amount: true },
    }),

    // orders รอดำเนินการ
    prisma.orders.count({ where: { status: "paid", fulfilled_at: null } }),

    // orders ทั้งหมด
    prisma.orders.count(),

    // products ทั้งหมด
    prisma.products.count({ where: { is_active: true } }),

    // products stock ต่ำ
    prisma.products.findMany({
      where: { is_active: true, isLower: true },
      select: { id: true, name_en: true, slug: true },
      take: 5,
    }),

    // orders ล่าสุด
    prisma.orders.findMany({
      take: 8,
      orderBy: { created_at: "desc" },
      include: {
        users: { select: { username: true, avatar: true } },
        products: { select: { name_en: true } },
      },
    }),

    // รายได้ 7 วันย้อนหลัง (raw groupBy)
    prisma.$queryRaw<{ day: Date; total: number }[]>`
      SELECT
        DATE_TRUNC('day', paid_at) AS day,
        SUM(amount)::float         AS total
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
    lowStockProducts,
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