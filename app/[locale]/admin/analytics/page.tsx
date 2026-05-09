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
    netRevenue,
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
 
    // ── Top Products: revenue, profit, orders, customers, avg order ──
    prisma.$queryRaw<{
      product_id:       string
      name_th:          string
      name_en:          string
      is_consignment:   boolean
      commission_pct:   number
      owner_name:       string | null
      total_revenue:    number
      net_revenue:      number
      payout:           number
      order_count:      number
      unique_customers: number
      avg_order:        number
      first_sale:       string
      last_sale:        string
    }[]>`
      SELECT
        p.id                                            AS product_id,
        p.name_th,
        p.name_en,
        p.is_consignment,
        COALESCE(p.commission_pct, 0)::float            AS commission_pct,
        p.owner_name,
        SUM(o.amount)::float                            AS total_revenue,
        SUM(
          CASE
            WHEN p.is_consignment = true
            THEN o.amount * p.commission_pct / 100
            ELSE o.amount
          END
        )::float                                        AS net_revenue,
        SUM(
          CASE
            WHEN p.is_consignment = true
            THEN o.amount * (100 - p.commission_pct) / 100
            ELSE 0
          END
        )::float                                        AS payout,
        COUNT(o.id)::int                                AS order_count,
        COUNT(DISTINCT o.user_id)::int                  AS unique_customers,
        AVG(o.amount)::float                            AS avg_order,
        MIN(o.paid_at)::text                            AS first_sale,
        MAX(o.paid_at)::text                            AS last_sale
      FROM orders o
      JOIN products p ON p.id = o.product_id
      WHERE o.status = 'paid'
      GROUP BY p.id, p.name_th, p.name_en, p.is_consignment, p.commission_pct, p.owner_name
      ORDER BY total_revenue DESC
      LIMIT 10
    `,
 
    prisma.orders.findMany({
      take: 20,
      orderBy: { created_at: "desc" },
      include: {
        users:            { select: { username: true, avatar: true, email: true } },
        products:         { select: { name_en: true, name_th: true } },
        product_variants: { select: { label_en: true, label_th: true } },
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
 
    prisma.$queryRaw<{ label_en: string; label_th: string; total: number; count: number }[]>`
      SELECT
        pv.label_en,
        pv.label_th,
        SUM(o.amount)::float AS total,
        COUNT(*)::int        AS count
      FROM orders o
      JOIN product_variants pv ON pv.id = o.variant_id
      WHERE o.status = 'paid'
      GROUP BY pv.label_en, pv.label_th
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
        netRevenue: netRevenue[0],
      }}
    />
  )
}