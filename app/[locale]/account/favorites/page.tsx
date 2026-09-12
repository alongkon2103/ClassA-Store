import { prisma } from "@/lib/prisma"
import { categorySelect, visibleCategory } from "@/lib/gameCategories"
import { requireUser } from "@/lib/requireUser"
import { getThbToUsdRate } from "@/lib/paypal"
import { setRequestLocale } from "next-intl/server"
import { planAvailable, toPlanRows } from "@/lib/maki"
import AccountFrame from "@/components/account/AccountFrame"
import FavoritesClient, { type FavoriteItem } from "./FavoritesClient"

export const dynamic = "force-dynamic"

// รายการโปรด = สินค้าที่ผู้ใช้กดบุ๊กมาร์ก (saved) ในหน้าสินค้า — ทั้งเกมเราและเกม Maki
export default async function FavoritesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  const { userId } = await requireUser(locale)

  const rows = await prisma.product_favorites.findMany({
    where: {
      user_id: userId, saved: true,
      OR: [
        { products: { is_active: true } },
        { partner_product: { is_visible: true, coming_soon: false, partner: { is_active: true, integration: "maki_api" } } },
      ],
    },
    orderBy: { updated_at: "desc" },
    include: {
      products: {
        include: {
          category: categorySelect,
          product_images: { orderBy: { sort_order: "asc" }, take: 1 },
          product_variants: { where: { is_active: true }, orderBy: { sort_order: "asc" }, select: { price: true } },
        },
      },
      partner_product: {
        select: { id: true, external_slug: true, name_th: true, name_en: true, description_html_th: true, description_html_en: true, thumbnail_url: true, images: true, plans: true, preview_video_url: true, category: categorySelect },
      },
    },
  })
  const ourIds = rows.flatMap((r) => (r.product_id ? [r.product_id] : []))
  const makiIds = rows.flatMap((r) => (r.partner_product_id ? [r.partner_product_id] : []))
  const [ourRatings, makiRatings, usdRate] = await Promise.all([
    ourIds.length ? prisma.product_reviews.groupBy({ by: ["product_id"], where: { product_id: { in: ourIds } }, _avg: { rating: true }, _count: { _all: true } }) : Promise.resolve([]),
    makiIds.length ? prisma.product_reviews.groupBy({ by: ["partner_product_id"], where: { partner_product_id: { in: makiIds } }, _avg: { rating: true }, _count: { _all: true } }) : Promise.resolve([]),
    getThbToUsdRate(),
  ])
  const ratings = new Map<string, { avg: number; count: number }>([
    ...ourRatings.map((r) => [r.product_id as string, { avg: r._avg.rating ?? 0, count: r._count._all }] as const),
    ...makiRatings.map((r) => [r.partner_product_id as string, { avg: r._avg.rating ?? 0, count: r._count._all }] as const),
  ])

  const items: FavoriteItem[] = rows.flatMap((r): FavoriteItem[] => {
    const p = r.products
    if (p) {
      return [{
        id: p.id, slug: p.slug, name_th: p.name_th, name_en: p.name_en,
        description_th: p.description_th ?? null, description_en: p.description_en ?? null,
        type: p.type ?? null, price: Number(p.price), preview_video_url: p.preview_video_url ?? null, is_featured: !!p.is_featured,
        image: p.product_images[0]?.url ?? null,
        variants: p.product_variants.map((v) => ({ price: Number(v.price) })),
        category: visibleCategory(p.category),
        rating_avg: ratings.get(p.id)?.avg ?? null, rating_count: ratings.get(p.id)?.count ?? 0,
      }]
    }
    const m = r.partner_product
    if (!m) return []
    const plans = toPlanRows(m.plans).filter(planAvailable)
    if (!plans.length) return [] // ยังไม่มีแพลนที่ขายได้ = ซ่อนเหมือนหน้าร้าน
    const images = Array.isArray(m.images) ? (m.images as string[]) : []
    return [{
      id: m.id, slug: m.external_slug, name_th: m.name_th, name_en: m.name_en,
      description_th: m.description_html_th ?? null, description_en: m.description_html_en ?? null,
      type: "partner", price: Math.min(...plans.map((x) => x.sell_price_thb as number)), preview_video_url: m.preview_video_url ?? null, is_featured: false,
      image: m.thumbnail_url ?? images[0] ?? null,
      variants: plans.map((x) => ({ price: x.sell_price_thb as number, min: x.min_price_thb })),
      rating_avg: ratings.get(m.id)?.avg ?? null, rating_count: ratings.get(m.id)?.count ?? 0,
      maki: true, category: visibleCategory(m.category),
    }]
  })

  return (
    <AccountFrame active="favorites">
      <FavoritesClient items={items} usdRate={usdRate} />
    </AccountFrame>
  )
}
