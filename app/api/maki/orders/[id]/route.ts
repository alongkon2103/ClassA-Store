import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { syncMakiOrder, toMakiOrderView } from "@/lib/makiOrders"

// หน้าออเดอร์ Maki poll ตัวนี้จนกว่าจะพ้น pending — เจ้าของออเดอร์หรือแอดมินเท่านั้น
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "not_found" }, { status: 404 })
  const row = await syncMakiOrder(id)
  if (!row || (row.user_id !== session.user.id && session.user.role !== "admin")) return NextResponse.json({ error: "not_found" }, { status: 404 })
  const [product, points] = await Promise.all([
    prisma.partner_products.findUnique({ where: { id: row.partner_product_id }, select: { external_slug: true, name_th: true, name_en: true, thumbnail_url: true, images: true, plans: true, downloads: true, guide_videos: true } }),
    prisma.point_ledger.findFirst({ where: { partner_order_id: id, type: "earn_purchase" }, select: { delta: true } }),
  ])
  return NextResponse.json({ order: toMakiOrderView(row, product), points: points?.delta ?? null })
}
