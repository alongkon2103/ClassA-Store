import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { validateAdmin } from "@/lib/adminAuth"

export async function GET(req: NextRequest) {
  const admin = await validateAdmin(["admin"])
  if (!admin.isValid) return admin.response

  const { searchParams } = new URL(req.url)
  const month = searchParams.get("month") // format: "2026-05"

  const dateFilter = month ? {
    created_at: {
      gte: new Date(`${month}-01`),
      lt: new Date(new Date(`${month}-01`).setMonth(new Date(`${month}-01`).getMonth() + 1))
    }
  } : {}

  const products = await prisma.products.findMany({
    where: { is_consignment: false },
    include: {
      product_shares: {
        include: { partners: true }
      },
      orders: {
        where: { status: "paid", ...dateFilter },
        select: { amount: true, created_at: true } // ✅ created_at ไม่ใช่ createdAt
      }
    }
  })

  const processed = products.map((p) => {
    const totalOrders = p.orders.length
    const grossRevenue = p.orders.reduce((sum, o) => sum + Number(o.amount), 0)
    return {
      id: p.id,
      name_en: p.name_en,
      name_th: p.name_th,
      total_orders: totalOrders,
      gross_revenue: grossRevenue,
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