import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"
import AnalyticsClient from "./AnalyticsClient"
import { parseBangkokDay, bangkokBucketStart, zeroFillBuckets, type BangkokGranularity } from "@/lib/bangkokTz"

type Granularity = BangkokGranularity

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

  // For "all orders" queries (incl. pending/expired) filter by created_at.
  const createdAtFilter =
    from && to ? Prisma.sql`AND created_at BETWEEN ${from} AND ${to}` :
    from        ? Prisma.sql`AND created_at >= ${from}` :
    to          ? Prisma.sql`AND created_at <= ${to}` :
    Prisma.empty

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
    revenueBySource,
    affiliateCost,
  ] = await Promise.all([

    // ── Revenue Over Time (single unified series) ──
    // Bucketing happens in JS below, NOT in SQL: the DB server's clock is
    // misconfigured (instants stored 7h early) and the Prisma driver shifts
    // them back on read, so timestamps are only trustworthy AFTER they cross
    // the driver. SQL DATE_TRUNC on the raw values lands sales on the wrong
    // Bangkok day, which is why this chart used to disagree with the cards.
    prisma.orders.findMany({
      where: {
        status: "paid",
        order_type: { not: "TRIAL" },
        paid_at: {
          not: null,
          ...(from && { gte: from }),
          ...(to && { lte: to }),
        },
      },
      select: { paid_at: true, amount: true },
    }),

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
      first_sale: Date | null
      last_sale: Date | null
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
        -- Return as timestamptz (NOT ::text): raw stored values are 7h early
        -- (see lib/bangkokTz.ts note); only the driver's read path corrects
        -- them, so text-formatting in SQL displays the wrong time/day.
        MIN(o.paid_at)                                  AS first_sale,
        MAX(o.paid_at)                                  AS last_sale
      FROM orders o
      JOIN products p ON p.id = o.product_id
      WHERE o.status = 'paid'
        AND o.order_type <> 'TRIAL'
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
        order_type: { not: "TRIAL" },
        ...(from || to ? { paid_at: { ...(from && { gte: from }), ...(to && { lte: to }) } } : {}),
      },
      include: {
        users: { select: { username: true, avatar: true, email: true } },
        products: { select: { name_en: true, name_th: true } },
        product_variants: { select: { label_en: true, label_th: true } },
        game_keys: { select: { key_value: true } },
        recorded_by: { select: { username: true, avatar: true } },
      },
    }),

    // ── Orders by Status (uses created_at — pending orders included) ──
    prisma.$queryRaw<{ status: string; count: number }[]>`
      SELECT status, COUNT(*)::int AS count
      FROM orders
      WHERE order_type <> 'TRIAL'
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
      WHERE order_type <> 'TRIAL'
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
        AND o.order_type <> 'TRIAL'
        ${paidAtFilter}
      GROUP BY pv.label_en, pv.label_th
      ORDER BY count DESC
      LIMIT 5
    `,

    // ── Total Stats ──
    // avg_order: paid orders with a real amount only — ฿0 admin-recorded rows
    // (43 of them at last audit) would drag the average down to a meaningless
    // number. unique_customers: people who actually PAID, not everyone who
    // opened a checkout (pending/expired rows have user_ids too).
    prisma.$queryRaw<{ total_revenue: number; total_orders: number; avg_order: number; unique_customers: number }[]>`
      SELECT
        SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END)::float           AS total_revenue,
        COUNT(*)::int                                                            AS total_orders,
        AVG(CASE WHEN status = 'paid' AND amount > 0 THEN amount END)::float    AS avg_order,
        COUNT(DISTINCT CASE WHEN status = 'paid' THEN user_id END)::int         AS unique_customers
      FROM orders
      WHERE order_type <> 'TRIAL'
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
        AND o.order_type <> 'TRIAL'
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
          WHERE o.status = 'paid' AND o.order_type <> 'TRIAL'
                ${from ? Prisma.sql`AND o.paid_at >= ${from}` : Prisma.empty}
                ${to   ? Prisma.sql`AND o.paid_at <= ${to}`   : Prisma.empty}
        )::int                                                              AS order_count,
        COALESCE(SUM(
          CASE
            WHEN o.status = 'paid' AND o.order_type <> 'TRIAL'
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

    // ── Revenue by Source (Manual admin entry vs Stripe checkout) ──
    // `recorded_by_id IS NULL` means the row was created by the checkout flow
    // (Stripe webhook). Any row with `recorded_by_id` was entered by an admin.
    prisma.$queryRaw<{ source: "manual" | "stripe"; count: number; total: number }[]>`
      SELECT
        CASE WHEN recorded_by_id IS NULL THEN 'stripe' ELSE 'manual' END AS source,
        COUNT(*)::int                                                     AS count,
        SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END)::float      AS total
      FROM orders
      WHERE order_type <> 'TRIAL'
        ${createdAtFilter}
      GROUP BY source
    `,

    // ── Affiliate commission cost (accrual, aligned to o.paid_at) ──
    // Store bears this cost; excludes reversed earnings. Split committed vs paid.
    prisma.$queryRaw<{ committed: number; paid_out: number }[]>`
      SELECT
        COALESCE(SUM(CASE WHEN ae.status IN ('pending','requested') THEN ae.commission_amount ELSE 0 END), 0)::float AS committed,
        COALESCE(SUM(CASE WHEN ae.status = 'paid' THEN ae.commission_amount ELSE 0 END), 0)::float                   AS paid_out
      FROM affiliate_earnings ae
      JOIN orders o ON o.id = ae.order_id
      WHERE ae.status <> 'reversed'
        AND o.status = 'paid'
        AND o.order_type <> 'TRIAL'
        ${paidAtFilter}
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
        // Group paid orders into Bangkok-local buckets in JS (driver-corrected
        // timestamps — same read path as every other number on this page, so
        // the series always agrees with the stat cards), then zero-fill so
        // no-sale periods show as ฿0 instead of vanishing.
        revenueOverTime: (() => {
          const byBucket = new Map<number, { bucket: Date; total: number; count: number }>()
          for (const o of revenueOverTime) {
            if (!o.paid_at) continue
            const b = bangkokBucketStart(o.paid_at, granularity)
            const cur = byBucket.get(b.getTime()) ?? { bucket: b, total: 0, count: 0 }
            cur.total += Number(o.amount)
            cur.count += 1
            byBucket.set(b.getTime(), cur)
          }
          const sorted = [...byBucket.values()].sort(
            (a, b) => a.bucket.getTime() - b.bucket.getTime(),
          )
          return zeroFillBuckets(sorted, granularity).map((r) => ({
            bucket: r.bucket.toISOString(),
            total: Math.round(r.total * 100) / 100,
            count: r.count,
          }))
        })(),
        topProducts,
        revenueBySource,
        recentOrders: recentOrders.map((o) => ({
          ...o,
          amount: Number(o.amount),
          discount_amount: o.discount_amount === null ? null : Number(o.discount_amount),
          expected_amount: o.expected_amount === null ? null : Number(o.expected_amount),
          created_at: o.created_at?.toISOString() ?? null,
          paid_at: o.paid_at?.toISOString() ?? null,
        })),
        ordersByStatus,
        ordersByPayment,
        topVariants,
        totalStats: totalStats[0],
        netRevenue: (() => {
          const nr = netRevenue[0]
          const committed = Number(affiliateCost[0]?.committed ?? 0)
          const paid = Number(affiliateCost[0]?.paid_out ?? 0)
          const affiliate_total = Math.round((committed + paid) * 100) / 100
          return {
            ...nr,
            affiliate_committed: Math.round(committed * 100) / 100,
            affiliate_paid: Math.round(paid * 100) / 100,
            affiliate_total,
            net_after_affiliate: Math.round(((nr?.total_net ?? 0) - affiliate_total) * 100) / 100,
          }
        })(),
        productVariantBreakdown,
      }}
    />
  )
}
