import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { validateAdmin } from "@/lib/adminAuth"
import { parseBangkokDay } from "@/lib/bangkokTz"

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
        where: { status: "paid", ...dateFilter },
        select: { amount: true, recorded_by_id: true, paid_at: true, payment_method: true }
      }
    }
  })

  const processed = products.map((p) => {
    const totalOrders = p.orders.length
    const grossRevenue = p.orders.reduce((sum, o) => sum + Number(o.amount), 0)
    const manualOrders = p.orders.filter((o) => o.recorded_by_id !== null)
    const manualRevenue = manualOrders.reduce((sum, o) => sum + Number(o.amount), 0)
    // PayPal-only slice — admin needs to see this separately because PayPal
    // settles in USD and charges ~3.9% so the THB amount we recorded is NOT
    // what actually lands in the bank account. The UI subtracts the fee.
    const paypalOrders = p.orders.filter((o) => o.payment_method === "paypal")
    const paypalRevenue = paypalOrders.reduce((sum, o) => sum + Number(o.amount), 0)
    return {
      id: p.id,
      name_en: p.name_en,
      name_th: p.name_th,
      total_orders: totalOrders,
      gross_revenue: grossRevenue,
      manual_orders: manualOrders.length,
      manual_revenue: manualRevenue,
      paypal_orders: paypalOrders.length,
      paypal_revenue: paypalRevenue,
      partners: p.product_shares.map(s => ({
        name: s.partners.name,
        contact: s.partners.contact,
        share: Number(s.share_pct),
        payout: (grossRevenue * Number(s.share_pct)) / 100
      }))
    }
  }).filter(p => p.partners.length > 0)
    .sort((a, b) => b.gross_revenue - a.gross_revenue)

  return NextResponse.json(processed)
}