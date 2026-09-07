// เท็มเพลตจากเกม — ฟังก์ชันของเกม (รูปตัวละคร + ของขวัญตั้งต้น + ป้ายชื่อ) ให้ editor วางเป็นการ์ด
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getFeatureFlags } from "@/lib/featureFlags"

export const runtime = "nodejs"

export async function GET(_req: NextRequest, { params }: { params: Promise<{ productId: string }> }) {
  const flags = await getFeatureFlags()
  if (!flags.livegen_enabled) return NextResponse.json({ error: "disabled" }, { status: 404 })
  const { productId } = await params

  const product = await prisma.products.findUnique({
    where: { id: productId },
    select: { id: true, name_th: true, name_en: true, is_active: true },
  })
  if (!product || !product.is_active) return NextResponse.json({ error: "not_found" }, { status: 404 })

  const functions = await prisma.product_functions.findMany({
    where: { product_id: productId },
    orderBy: { sort_order: "asc" },
    select: { id: true, name: true, label_th: true, label_en: true, image_url: true, default_gift_id: true },
  })
  const giftIds = [...new Set(functions.map((f) => f.default_gift_id).filter((x): x is number => x != null))]
  const gifts = giftIds.length
    ? await prisma.gifts.findMany({ where: { id: { in: giftIds } }, select: { id: true, name: true, image_url: true } })
    : []
  const giftMap = new Map(gifts.map((g) => [g.id, g]))

  return NextResponse.json({
    product: { id: product.id, name_th: product.name_th, name_en: product.name_en },
    functions: functions.map((f) => {
      const g = f.default_gift_id != null ? giftMap.get(f.default_gift_id) : null
      return {
        id: f.id, name: f.name, label_th: f.label_th, label_en: f.label_en, image_url: f.image_url,
        gift_image_url: g?.image_url ?? null, gift_name: g?.name ?? null,
      }
    }),
  })
}
