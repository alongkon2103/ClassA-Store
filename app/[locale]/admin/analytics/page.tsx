import { prisma } from "@/lib/prisma"
import AnalyticsClient from "./AnalyticsClient"
import { startOfMonth, subMonths, format } from "date-fns"

export default async function AnalyticsPage() {
  const now = new Date()

  const [
    monthlyRevenue,
    topProducts,
    recentOrders,
    ordersByStatus,
    ordersByPayment,
    dailyRevenue30,
    topVariants,
    totalStats,
    netRevenue,       // ✅ เพิ่ม
  ] = await Promise.all([

    prisma.$queryRaw<{ month: Date; total: number; count: number }[]>`
      SELECT
        DATE_TRUNC('month', paid_at) AS month,
        SUM(amount)::float           AS total,
        COUNT(*)::int                AS count
      FROM orders
      WHERE status = 'paid'
        AND paid_at >= NOW() - INTERVAL '6 months'
      GROUP BY 1
      ORDER BY 1
    `,

    prisma.$queryRaw<{ product_id: string; name_en: string; total: number; count: number }[]>`
      SELECT
        o.product_id,
        p.name_en,
        SUM(o.amount)::float AS total,
        COUNT(*)::int        AS count
      FROM orders o
      JOIN products p ON p.id = o.product_id
      WHERE o.status = 'paid'
      GROUP BY o.product_id, p.name_en
      ORDER BY total DESC
      LIMIT 10
    `,

    prisma.orders.findMany({
      take: 20,
      orderBy: { created_at: "desc" },
      include: {
        users:            { select: { username: true, avatar: true, email: true } },
        products:         { select: { name_en: true } },
        product_variants: { select: { label_en: true } },
        game_keys:        { select: { key_value: true } },
      },
    }),

    prisma.$queryRaw<{ status: string; count: number }[]>`
      SELECT status, COUNT(*)::int AS count
      FROM orders
      GROUP BY status
      ORDER BY count DESC
    `,

    prisma.$queryRaw<{ payment_method: string; count: number; total: number }[]>`
      SELECT
        COALESCE(payment_method, 'stripe') AS payment_method,
        COUNT(*)::int                      AS count,
        SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END)::float AS total
      FROM orders
      GROUP BY payment_method
    `,

    prisma.$queryRaw<{ day: Date; total: number; count: number }[]>`
      SELECT
        DATE_TRUNC('day', paid_at) AS day,
        SUM(amount)::float         AS total,
        COUNT(*)::int              AS count
      FROM orders
      WHERE status = 'paid'
        AND paid_at >= NOW() - INTERVAL '30 days'
      GROUP BY 1
      ORDER BY 1
    `,

    prisma.$queryRaw<{ label_en: string; total: number; count: number }[]>`
      SELECT
        pv.label_en,
        SUM(o.amount)::float AS total,
        COUNT(*)::int        AS count
      FROM orders o
      JOIN product_variants pv ON pv.id = o.variant_id
      WHERE o.status = 'paid'
      GROUP BY pv.label_en
      ORDER BY count DESC
      LIMIT 5
    `,

    prisma.$queryRaw<{ total_revenue: number; total_orders: number; avg_order: number; unique_customers: number }[]>`
      SELECT
        SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END)::float AS total_revenue,
        COUNT(*)::int                                                  AS total_orders,
        AVG(CASE WHEN status = 'paid' THEN amount END)::float          AS avg_order,
        COUNT(DISTINCT user_id)::int                                   AS unique_customers
      FROM orders
    `,

    // ✅ เพิ่ม — net revenue หลังหัก commission
    prisma.$queryRaw<{ total_gross: number; total_net: number; total_payout: number }[]>`
      SELECT
        SUM(o.amount)::float AS total_gross,
        SUM(
          CASE
            WHEN p.is_consignment = true
            THEN o.amount * p.commission_pct / 100
            ELSE o.amount
          END
        )::float AS total_net,
        SUM(
          CASE
            WHEN p.is_consignment = true
            THEN o.amount * (100 - p.commission_pct) / 100
            ELSE 0
          END
        )::float AS total_payout
      FROM orders o
      JOIN products p ON p.id = o.product_id
      WHERE o.status = 'paid'
    `,
  ])

  return (
    <AnalyticsClient
      data={{
        monthlyRevenue: monthlyRevenue.map((m) => ({
          month: m.month.toISOString(),
          total: m.total,
          count: m.count,
        })),
        topProducts,
        recentOrders: recentOrders.map((o) => ({
          ...o,
          amount:     Number(o.amount),
          created_at: o.created_at?.toISOString() ?? null,
          paid_at:    o.paid_at?.toISOString()    ?? null,
        })),
        ordersByStatus,
        ordersByPayment,
        dailyRevenue30: dailyRevenue30.map((d) => ({
          day:   d.day.toISOString(),
          total: d.total,
          count: d.count,
        })),
        topVariants,
        totalStats: totalStats[0],
        netRevenue: netRevenue[0],   // ✅ เพิ่ม
      }}
    />
  )
}