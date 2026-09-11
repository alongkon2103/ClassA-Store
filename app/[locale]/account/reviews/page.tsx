import { prisma } from "@/lib/prisma"
import { requireUser } from "@/lib/requireUser"
import { setRequestLocale } from "next-intl/server"
import AccountFrame from "@/components/account/AccountFrame"
import MyReviewsClient from "./MyReviewsClient"
import { reconcileUserPoints, reviewPointsStates } from "@/lib/points"

export const dynamic = "force-dynamic"

// รีวิวของฉัน = เกมที่ซื้อ (จ่ายแล้ว) ทุกเกม — เกมไหนยังไม่รีวิวชวนให้รีวิว เกมไหนรีวิวแล้วให้แก้ได้
// + แต้มรีวิว: ป้าย "+x แต้ม" สำหรับเกมที่รีวิวแล้วจะได้ · "ได้รับแล้ว" สำหรับเกมที่ได้แต้มไปแล้ว
export default async function MyReviewsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  const { userId } = await requireUser(locale)
  // กวาดแต้มที่ตกหล่น (ซื้อ/รีวิว) ก่อนคำนวณป้าย ให้หน้ากับยอดใน sidebar ตรงกันในการโหลดเดียว
  await reconcileUserPoints(userId).catch(() => 0)

  const paid = await prisma.orders.findMany({
    where: { user_id: userId, status: "paid" },
    orderBy: [{ paid_at: "desc" }, { created_at: "desc" }],
    select: { product_id: true, paid_at: true, created_at: true },
  })
  // เกมละ 1 แถว ใช้วันที่ซื้อล่าสุด
  const boughtAt = new Map<string, Date | null>()
  for (const o of paid) if (!boughtAt.has(o.product_id)) boughtAt.set(o.product_id, o.paid_at ?? o.created_at ?? null)
  const ids = [...boughtAt.keys()]

  const [products, reviews] = await Promise.all([
    prisma.products.findMany({
      where: { id: { in: ids } },
      include: { product_images: { orderBy: { sort_order: "asc" }, take: 1 } },
    }),
    prisma.product_reviews.findMany({ where: { user_id: userId } }),
  ])
  const mine = new Map(reviews.map((r) => [r.product_id, r]))
  const pts = await reviewPointsStates(userId, ids.map((id) => ({ productId: id, reviewCreatedAt: mine.get(id)?.created_at ?? null })))

  const items = ids.flatMap((id) => {
    const p = products.find((x) => x.id === id)
    if (!p) return []
    const r = mine.get(id)
    return [{
      slug: p.slug,
      name_th: p.name_th,
      name_en: p.name_en,
      image: p.product_images[0]?.url ?? null,
      bought_at: boughtAt.get(id)?.toISOString() ?? null,
      review: r ? { rating: r.rating, comment: r.comment, updated_at: r.updated_at?.toISOString() ?? null } : null,
      points: pts.states.get(id) ?? { state: "none" as const, points: 0 },
    }]
  })

  return (
    <AccountFrame active="reviews">
      <MyReviewsClient items={items} perReview={pts.active ? pts.perReview : 0} />
    </AccountFrame>
  )
}
