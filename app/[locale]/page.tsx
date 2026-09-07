// ISR: re-render at most every 60s. Drop-in replacement for `force-dynamic`
// that lets Next.js cache the homepage HTML between requests. Admins adding
// products see them within 60 seconds (acceptable for a marketing homepage).
export const revalidate = 60;

import HomeClient from "./HomeClient"
import { prisma } from "@/lib/prisma"
import { getThbToUsdRate } from "@/lib/paypal"
import { setRequestLocale } from "next-intl/server";

export default async function Home({
  params
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const rawProducts = await prisma.products.findMany({
    where: { is_active: true, is_featured: true },
    include: {
      product_images: true,
      product_variants: {
        where: { is_active: true },
        orderBy: { sort_order: "asc" },
        include: {
          _count: {
            select: {
              game_keys: { where: { status: "available" } },
            },
          },
        },
      },
    },
    orderBy: [
      { is_featured: "desc" },
      { created_at: "desc" },
    ],
  })

  // คะแนนรีวิวจริงต่อสินค้า สำหรับดาวบนการ์ดเกมแนะนำ
  const ratingRows = await prisma.product_reviews.groupBy({
    by: ["product_id"], _avg: { rating: true }, _count: { _all: true },
  })
  const ratings = new Map(ratingRows.map((r) => [r.product_id, { avg: r._avg.rating ?? 0, count: r._count._all }]))

  const products = rawProducts.map((p) => ({
  ...p,
  rating_avg: ratings.get(p.id)?.avg ?? null,
  rating_count: ratings.get(p.id)?.count ?? 0,
  price: Number(p.price),
  commission_pct: Number(p.commission_pct ?? 0),

  product_variants: p.product_variants.map((v) => ({
    ...v,
    price: Number(v.price),
    premium_addon_price: Number(v.premium_addon_price ?? 0),
    discount_pct: Number(v.discount_pct ?? 0),
    stock: v._count.game_keys,
  })),
}))

  const usdRate = await getThbToUsdRate()

  return <HomeClient products={products} usdRate={usdRate} />
}
