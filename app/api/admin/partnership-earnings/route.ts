import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { validateAdmin } from "@/lib/adminAuth"
import { parseBangkokDay } from "@/lib/bangkokTz"
import { paypalSettlementFromAmounts } from "@/lib/paypalSettlement"

export async function GET(req: NextRequest) {
  const admin = await validateAdmin(["admin"])
  if (!admin.isValid) return admin.response

  const { searchParams } = new URL(req.url)
  const month = searchParams.get("month") // format: "2026-05"

  // Bangkok-local month range. `new Date("2026-05-01")` parses as UTC midnight
  // which misclassifies sales between 00:00–06:59 Bangkok into the previous
  // month — see lib/bangkokTz.ts.
  let dateFilter = {}
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const firstOfThis = parseBangkokDay(`${month}-01`, false)
    if (firstOfThis) {
      // Compute Bangkok midnight on day 1 of the *next* month.
      const [y, m] = month.split("-").map(Number)
      const nextY = m === 12 ? y + 1 : y
      const nextM = m === 12 ? 1 : m + 1
      const firstOfNext = parseBangkokDay(`${nextY}-${String(nextM).padStart(2, "0")}-01`, false)
      if (firstOfNext) {
        dateFilter = { paid_at: { gte: firstOfThis, lt: firstOfNext } }
      }
    }
  }

  const products = await prisma.products.findMany({
    where: { is_consignment: false },
    include: {
      product_shares: {
        include: { partners: true }
      },
      orders: {
        // TRIAL orders are ฿0 giveaways — they must not inflate the order
        // counts partners see on this page.
        where: { status: "paid", order_type: { not: "TRIAL" }, ...dateFilter },
        select: { amount: true, recorded_by_id: true, paid_at: true, payment_method: true }
      }
    }
  })

  const processed = products.map((p) => {
    const totalOrders = p.orders.length
    const grossRevenue = p.orders.reduce((sum, o) => sum + Number(o.amount), 0)
    const manualOrders = p.orders.filter((o) => o.recorded_by_id !== null)
    const manualRevenue = manualOrders.reduce((sum, o) => sum + Number(o.amount), 0)
    // PayPal slice — admin needs to see this separately because PayPal
    // settles in USD and charges 4.4% + $0.39 per transaction, so the THB
    // amount we recorded is NOT what actually lands in the bank account.
    // Includes BOTH channels that land in the PayPal account: the REST API
    // flow ("paypal") and the PayPal.me email-verified flow ("paypal_me").
    // Compute net here (per-order) so the $0.39 fixed fee is applied N times.
    const paypalOrders = p.orders.filter(
      (o) => o.payment_method === "paypal" || o.payment_method === "paypal_me",
    )
    const paypalAmounts = paypalOrders.map((o) => Number(o.amount))
    const paypalSettle = paypalSettlementFromAmounts(paypalAmounts)
    // Revenue after the PayPal fees we can compute exactly. Stripe fees are
    // not tracked per-order, so this is "net of PayPal" — the closest honest
    // net figure without inventing Stripe rates.
    const netRevenue = grossRevenue - paypalSettle.amount_thb + paypalSettle.net_thb
    return {
      id: p.id,
      name_en: p.name_en,
      name_th: p.name_th,
      total_orders: totalOrders,
      gross_revenue: grossRevenue,
      net_revenue: netRevenue,
      manual_orders: manualOrders.length,
      manual_revenue: manualRevenue,
      paypal_orders: paypalOrders.length,
      paypal_revenue: paypalSettle.amount_thb,
      paypal_amount_usd: paypalSettle.amount_usd,
      paypal_net_usd: paypalSettle.net_usd,
      paypal_net_thb: paypalSettle.net_thb,
      partners: p.product_shares.map(s => ({
        name: s.partners.name,
        contact: s.partners.contact,
        share: Number(s.share_pct),
        // Headline payout stays gross-based (existing agreement with
        // partners); payout_net shows the same share on PayPal-net revenue
        // for comparison.
        payout: (grossRevenue * Number(s.share_pct)) / 100,
        payout_net: (netRevenue * Number(s.share_pct)) / 100
      }))
    }
  }).filter(p => p.partners.length > 0)
    .sort((a, b) => b.gross_revenue - a.gross_revenue)

  // Store-wide affiliate commission for the same period (accrual, order.paid_at).
  // The store bears this cost — partner shares above are unchanged. Excludes
  // reversed earnings; split committed (pending+requested) vs already paid out.
  const affRows = await prisma.affiliate_earnings.groupBy({
    by: ["status"],
    where: {
      status: { not: "reversed" },
      order: { status: "paid", order_type: { not: "TRIAL" }, ...dateFilter },
    },
    _sum: { commission_amount: true },
  })
  const affSum = (st: string) => Number(affRows.find((r) => r.status === st)?._sum.commission_amount ?? 0)
  const r2 = (n: number) => Math.round(n * 100) / 100
  const affCommitted = affSum("pending") + affSum("requested")
  const affPaid = affSum("paid")
  const affiliate = { committed: r2(affCommitted), paid: r2(affPaid), total: r2(affCommitted + affPaid) }

  return NextResponse.json({ products: processed, affiliate })
}