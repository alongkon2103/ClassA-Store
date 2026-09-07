import { prisma } from "@/lib/prisma"
import { requireUser } from "@/lib/requireUser"
import { getThbToUsdRate } from "@/lib/paypal"
import { setRequestLocale } from "next-intl/server"
import AccountFrame from "@/components/account/AccountFrame"
import FavoritesClient from "./FavoritesClient"

export const dynamic = "force-dynamic"

// รายการโปรด = สินค้าที่ผู้ใช้กดบุ๊กมาร์ก (saved) ในหน้าสินค้า
export default async function FavoritesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  const { userId } = await requireUser(locale)

  const rows = await prisma.product_favorites.findMany({
    where: { user_id: userId, saved: true, products: { is_active: true } },
    orderBy: { updated_at: "desc" },
    include: {
      products: {
        include: {
          product_images: { orderBy: { sort_order: "asc" }, take: 1 },
          product_variants: { where: { is_active: true }, orderBy: { sort_order: "asc" }, select: { price: true } },
        },
      },
    },
  })
  const ids = rows.map((r) => r.product_id)
  const [ratingRows, usdRate] = await Promise.all([
    prisma.product_reviews.groupBy({ by: ["product_id"], where: { product_id: { in: ids } }, _avg: { rating: true }, _count: { _all: true } }),
    getThbToUsdRate(),
  ])
  const ratings = new Map(ratingRows.map((r) => [r.product_id, { avg: r._avg.rating ?? 0, count: r._count._all }]))

  const items = rows.map((r) => {
    const p = r.products
    return {
      id: p.id,
      slug: p.slug,
      name_th: p.name_th,
      name_en: p.name_en,
      description_th: p.description_th ?? null,
      description_en: p.description_en ?? null,
      type: p.type ?? null,
      price: Number(p.price),
      preview_video_url: p.preview_video_url ?? null,
      is_featured: !!p.is_featured,
      image: p.product_images[0]?.url ?? null,
      variants: p.product_variants.map((v) => ({ price: Number(v.price) })),
      rating_avg: ratings.get(p.id)?.avg ?? null,
      rating_count: ratings.get(p.id)?.count ?? 0,
    }
  })

  return (
    <AccountFrame active="favorites">
      <FavoritesClient items={items} usdRate={usdRate} />
    </AccountFrame>
  )
}
