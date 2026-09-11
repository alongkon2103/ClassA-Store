import { NextRequest, NextResponse } from "next/server"
import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { validateAdmin } from "@/lib/adminAuth"

// ประวัติแต้มทั้งร้าน กรองตามประเภท / ค้นหาผู้ใช้ แบ่งหน้า
const TYPES = new Set(["earn_purchase", "reverse_purchase", "earn_review", "reverse_review", "earn_daily", "adjust_admin"])

export async function GET(req: NextRequest) {
  const admin = await validateAdmin(["admin"])
  if (!admin.isValid) return admin.response
  const sp = req.nextUrl.searchParams
  const type = sp.get("type") ?? ""
  const q = (sp.get("q") ?? "").trim()
  const page = Math.max(1, Number(sp.get("page")) || 1)
  const limit = Math.min(200, Math.max(1, Number(sp.get("limit")) || 50))

  const where: Prisma.point_ledgerWhereInput = {
    ...(TYPES.has(type) ? { type } : {}),
    ...(q ? { user: { OR: [{ username: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }] } } : {}),
  }
  const [total, entries] = await Promise.all([
    prisma.point_ledger.count({ where }),
    prisma.point_ledger.findMany({
      where, orderBy: { created_at: "desc" }, skip: (page - 1) * limit, take: limit,
      include: { user: { select: { id: true, username: true, email: true } }, order: { select: { id: true, products: { select: { name_th: true } } } }, partner_order: { select: { id: true, partner_product: { select: { name_th: true } } } }, product: { select: { name_th: true } } },
    }),
  ])
  const voids = await prisma.point_ledger.findMany({ where: { reverses_id: { in: entries.map((e) => e.id) } }, select: { reverses_id: true } })
  const voided = new Set(voids.map((v) => v.reverses_id))
  return NextResponse.json({
    total, page, limit,
    entries: entries.map((e) => ({
      id: e.id, delta: e.delta, type: e.type, note: e.note, created_at: e.created_at, user: e.user,
      order_id: e.order?.id ?? e.partner_order?.id ?? null, product: e.order?.products.name_th ?? e.partner_order?.partner_product.name_th ?? e.product?.name_th ?? null,
      order_href: e.order ? `/orders/${e.order.id}` : e.partner_order ? `/orders/maki/${e.partner_order.id}` : null, reverses_id: e.reverses_id, voided: voided.has(e.id),
    })),
  })
}
