import { prisma } from "@/lib/prisma"
import { setRequestLocale } from "next-intl/server"
import GameCategoriesClient, { type CatRow, type GameRow } from "./GameCategoriesClient"

// หมวดหมู่เกม: สร้าง/แก้ชื่อ/ซ่อน/เรียง/ลบหมวด แล้วใส่หมวดให้ทุกเกมในหน้าเดียว ทั้งเกมเราและเกมพาร์ทเนอร์
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)

  const [cats, products, partners] = await Promise.all([
    prisma.game_categories.findMany({
      orderBy: [{ sort_order: "asc" }, { created_at: "asc" }],
      include: { _count: { select: { products: true, partner_products: true } } },
    }),
    prisma.products.findMany({
      orderBy: [{ is_active: "desc" }, { created_at: "desc" }],
      select: {
        id: true, name_th: true, name_en: true, is_active: true, category_id: true,
        product_images: { orderBy: { sort_order: "asc" }, take: 1, select: { url: true } },
      },
    }),
    prisma.partner_products.findMany({
      where: { partner: { is_active: true } },
      orderBy: [{ partner_id: "asc" }, { sort_order: "asc" }],
      select: {
        id: true, name_th: true, name_en: true, thumbnail_url: true, is_visible: true, coming_soon: true, category_id: true,
        partner: { select: { display_name: true } },
      },
    }),
  ])

  const catRows: CatRow[] = cats.map((c) => ({
    id: c.id, name_th: c.name_th, name_en: c.name_en, is_visible: c.is_visible,
    count: c._count.products + c._count.partner_products,
  }))
  const games: GameRow[] = [
    ...products.map((p): GameRow => ({
      kind: "product", id: p.id, name_th: p.name_th, name_en: p.name_en,
      thumb: p.product_images[0]?.url ?? null, source: null, listed: !!p.is_active, category_id: p.category_id,
    })),
    ...partners.map((p): GameRow => ({
      kind: "partner", id: p.id, name_th: p.name_th, name_en: p.name_en,
      thumb: p.thumbnail_url, source: p.partner.display_name, listed: p.is_visible && !p.coming_soon, category_id: p.category_id,
    })),
  ]

  return <GameCategoriesClient cats={catRows} games={games} />
}
