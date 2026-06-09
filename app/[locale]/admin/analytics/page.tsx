import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"
import AnalyticsClient from "./AnalyticsClient"

type Granularity = "hour" | "day" | "month"

// Treat YYYY-MM-DD as a Bangkok day boundary regardless of server TZ.
// `from` → start of that day (00:00:00.000 +07:00)
// `to`   → end of that day   (23:59:59.999 +07:00)
function parseBangkokDay(s: string | undefined, end: boolean): Date | null {
  if (!s) return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null
  const iso = end ? `${s}T23:59:59.999+07:00` : `${s}T00:00:00.000+07:00`
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d
}

function pickGranularity(from: Date | null, to: Date | null): Granularity {
  if (!from || !to) return from || to ? "day" : "month"
  const days = (to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)
  if (days <= 2) return "hour"
  if (days <= 90) return "day"
  return "month"
}

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>
}) {
  const sp = await searchParams
  const from = parseBangkokDay(sp.from, false)
  const to = parseBangkokDay(sp.to, true)
  const granularity = pickGranularity(from, to)

  // Filter on paid_at for revenue/sales queries.
  // Pending orders (no paid_at) are excluded automatically — that's what we want.
  const paidAtFilter =
    from && to ? Prisma.sql`AND o.paid_at BETWEEN ${from} AND ${to}` :
    from        ? Prisma.sql`AND o.paid_at >= ${from}` :
    to          ? Prisma.sql`AND o.paid_at <= ${to}` :
    Prisma.empty

  // Same filter but for queries that don't alias the table.
  const paidAtFilterNoAlias =
    from && to ? Prisma.sql`AND paid_at BETWEEN ${from} AND ${to}` :
    from        ? Prisma.sql`AND paid_at >= ${from}` :
    to          ? Prisma.sql`AND paid_at <= ${to}` :
    Prisma.empty

  // For "all orders" queries (incl. pending/expired) filter by created_at.
  const createdAtFilter =
    from && to ? Prisma.sql`AND created_at BETWEEN ${from} AND ${to}` :
    from        ? Prisma.sql`AND created_at >= ${from}` :
    to          ? Prisma.sql`AND created_at <= ${to}` :
    Prisma.empty

  // DATE_TRUNC unit driven by granularity — server-derived only, safe to inline.
  const bucketExpr = Prisma.raw(`DATE_TRUNC('${granularity}', paid_at)`)

  const [
    revenueOverTime,
    topProducts,
    recentOrders,
    ordersByStatus,
    ordersByPayment,
    topVariants,
    totalStats,
    netRevenue,
    productVariantBreakdown,
  ] = await Promise.all([

    // ── Revenue Over Time (single unified series) ──
    prisma.$queryRaw<{ bucket: Date; total: number; count: number }[]>`
      SELECT
        ${bucketExpr}        AS bucket,
        SUM(amount)::float   AS total,
        COUNT(*)::int        AS count
      FROM orders o
      WHERE status = 'paid'
        AND order_type = 'NEW'
        ${paidAtFilter}
      GROUP BY 1
      ORDER BY 1
    `,

    // ── Top Products ──
    prisma.$queryRaw<{
      product_id: string
      name_th: string
      name_en: string
      is_consignment: boolean
      commission_pct: number
      owner_name: string | null
      total_revenue: number
      net_revenue: number
      payout: number
      order_count: number
      unique_customers: number
      avg_order: number
      first_sale: string
      last_sale: string
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
        AND o.order_type = 'NEW'
        ${paidAtFilter}
      GROUP BY p.id, p.name_th, p.name_en, p.is_consignment, p.commission_pct, p.owner_name
      ORDER BY total_revenue DESC
      LIMIT 10
    `,

    // ── Recent Orders ──
    prisma.orders.findMany({
      take: 20,
      orderBy: { created_at: "desc" },
      where: {
        status: "paid",
        order_type: "NEW",
        ...(from || to ? { paid_at: { ...(from && { gte: from }), ...(to && { lte: to }) } } : {}),
      },
      include: {
        users: { select: { username: true, avatar: true, email: true } },
        products: { select: { name_en: true, name_th: true } },
        product_variants: { select: { label_en: true, label_th: true } },
        game_keys: { select: { key_value: true } },
      },
    }),

    // ── Orders by Status (uses created_at — pending orders included) ──
    prisma.$queryRaw<{ status: string; count: number }[]>`
      SELECT status, COUNT(*)::int AS count
      FROM orders
      WHERE order_type = 'NEW'
        ${createdAtFilter}
      GROUP BY status
      ORDER BY count DESC
    `,

    // ── Orders by Payment Method ──
    prisma.$queryRaw<{ payment_method: string; count: number; total: number }[]>`
      SELECT
        CASE
          WHEN COALESCE(payment_method, 'stripe') IN ('stripe', 'card') THEN 'stripe'
          ELSE COALESCE(payment_method, 'stripe')
        END AS payment_method,
        COUNT(*)::int                      AS count,
        SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END)::float AS total
      FROM orders
      WHERE order_type = 'NEW'
        ${createdAtFilter}
      GROUP BY payment_method
    `,

    // ── Top Variants ──
    prisma.$queryRaw<{ label_en: string; label_th: string; total: number; count: number }[]>`
      SELECT
        pv.label_en,
        pv.label_th,
        SUM(o.amount)::float AS total,
        COUNT(*)::int        AS count
      FROM orders o
      JOIN product_variants pv ON pv.id = o.variant_id
      WHERE o.status = 'paid'
        AND o.order_type = 'NEW'
        ${paidAtFilter}
      GROUP BY pv.label_en, pv.label_th
      ORDER BY count DESC
      LIMIT 5
    `,

    // ── Total Stats ──
    prisma.$queryRaw<{ total_revenue: number; total_orders: number; avg_order: number; unique_customers: number }[]>`
      SELECT
        SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END)::float AS total_revenue,
        COUNT(*)::int                                                  AS total_orders,
        AVG(CASE WHEN status = 'paid' THEN amount END)::float          AS avg_order,
        COUNT(DISTINCT user_id)::int                                   AS unique_customers
      FROM orders
      WHERE order_type = 'NEW'
        ${createdAtFilter}
    `,

    // ── Net Revenue ──
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
        AND o.order_type = 'NEW'
        ${paidAtFilter}
    `,

    // ── Per Product × Variant Breakdown ──
    // LEFT JOINs so variants with zero sales still appear. Date filter applied
    // inside the COUNT/SUM via FILTER so empty variants don't get dropped.
    prisma.$queryRaw<{
      product_id: string
      product_name_th: string
      product_name_en: string
      variant_id: string | null
      label_th: string | null
      label_en: string | null
      duration_type: string | null
      duration_days: number | null
      price: number | null
      order_count: number
      revenue: number
    }[]>`
      SELECT
        p.id                                                                AS product_id,
        p.name_th                                                           AS product_name_th,
        p.name_en                                                           AS product_name_en,
        pv.id                                                               AS variant_id,
        pv.label_th,
        pv.label_en,
        pv.duration_type,
        pv.duration_days,
        pv.price::float                                                     AS price,
        COUNT(o.id) FILTER (
          WHERE o.status = 'paid' AND o.order_type = 'NEW'
                ${from ? Prisma.sql`AND o.paid_at >= ${from}` : Prisma.empty}
                ${to   ? Prisma.sql`AND o.paid_at <= ${to}`   : Prisma.empty}
        )::int                                                              AS order_count,
        COALESCE(SUM(
          CASE
            WHEN o.status = 'paid' AND o.order_type = 'NEW'
                 ${from ? Prisma.sql`AND o.paid_at >= ${from}` : Prisma.empty}
                 ${to   ? Prisma.sql`AND o.paid_at <= ${to}`   : Prisma.empty}
            THEN o.amount ELSE 0
          END
        ), 0)::float                                                         AS revenue
      FROM products p
      LEFT JOIN product_variants pv ON pv.product_id = p.id
      LEFT JOIN orders o ON o.variant_id = pv.id
      GROUP BY p.id, p.name_th, p.name_en, pv.id, pv.label_th, pv.label_en,
               pv.duration_type, pv.duration_days, pv.price, pv.sort_order
      ORDER BY p.name_en, COALESCE(pv.sort_order, 999), pv.label_en
    `,
  ])

  return (
    <AnalyticsClient
      data={{
        range: {
          from: from?.toISOString() ?? null,
          to: to?.toISOString() ?? null,
          fromParam: sp.from ?? null,
          toParam: sp.to ?? null,
          granularity,
        },
        revenueOverTime: revenueOverTime.map((r) => ({
          bucket: r.bucket.toISOString(),
          total: r.total,
          count: r.count,
        })),
        topProducts,
        recentOrders: recentOrders.map((o) => ({
          ...o,
          amount: Number(o.amount),
          created_at: o.created_at?.toISOString() ?? null,
          paid_at: o.paid_at?.toISOString() ?? null,
        })),
        ordersByStatus,
        ordersByPayment,
        topVariants,
        totalStats: totalStats[0],
        netRevenue: netRevenue[0],
        productVariantBreakdown,
      }}
    />
  )
}
