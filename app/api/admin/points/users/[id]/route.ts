import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { validateAdmin } from "@/lib/adminAuth"
import { getPointsBalance } from "@/lib/points"

// ผู้ใช้หนึ่งคน: ยอดคงเหลือ + ประวัติ (แบ่งหน้า) พร้อมสถานะว่ารายการไหนถูกยกเลิกแล้ว
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await validateAdmin(["admin"])
  if (!admin.isValid) return admin.response
  const { id } = await params
  const sp = req.nextUrl.searchParams
  const page = Math.max(1, Number(sp.get("page")) || 1)
  const limit = Math.min(100, Math.max(1, Number(sp.get("limit")) || 40))

  const user = await prisma.users.findUnique({ where: { id }, select: { id: true, username: true, email: true, avatar: true, created_at: true } })
  if (!user) return NextResponse.json({ error: "not_found" }, { status: 404 })

  const [balance, total, entries] = await Promise.all([
    getPointsBalance(id),
    prisma.point_ledger.count({ where: { user_id: id } }),
    prisma.point_ledger.findMany({
      where: { user_id: id },
      orderBy: { created_at: "desc" },
      skip: (page - 1) * limit, take: limit,
      include: { order: { select: { id: true, products: { select: { name_th: true } } } }, partner_order: { select: { id: true, partner_product: { select: { name_th: true } } } }, product: { select: { name_th: true } } },
    }),
  ])
  const [voids, admins] = await Promise.all([
    prisma.point_ledger.findMany({ where: { reverses_id: { in: entries.map((e) => e.id) } }, select: { reverses_id: true } }),
    prisma.users.findMany({ where: { id: { in: entries.map((e) => e.created_by).filter((x): x is string => !!x) } }, select: { id: true, username: true } }),
  ])
  const voided = new Set(voids.map((v) => v.reverses_id))
  const adminName = new Map(admins.map((a) => [a.id, a.username]))

  return NextResponse.json({
    user, balance, total, page, limit,
    entries: entries.map((e) => ({
      id: e.id, delta: e.delta, type: e.type, note: e.note, created_at: e.created_at,
      order_id: e.order?.id ?? e.partner_order?.id ?? null, product: e.order?.products.name_th ?? e.partner_order?.partner_product.name_th ?? e.product?.name_th ?? null,
      order_href: e.order ? `/orders/${e.order.id}` : e.partner_order ? `/orders/maki/${e.partner_order.id}` : null,
      reverses_id: e.reverses_id, voided: voided.has(e.id), by: e.created_by ? adminName.get(e.created_by) ?? null : null,
    })),
  })
}
