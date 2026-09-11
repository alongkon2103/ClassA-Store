import { prisma } from "@/lib/prisma"
import { requireUser } from "@/lib/requireUser"
import { setRequestLocale } from "next-intl/server"
import AccountFrame from "@/components/account/AccountFrame"
import MyReviewsClient from "./MyReviewsClient"
import { reconcileUserPoints, reviewPointsStates } from "@/lib/points"
import type { GameRef } from "@/lib/games"

export const dynamic = "force-dynamic"

// รีวิวของฉัน = เกมที่ซื้อ (จ่ายแล้ว) ทุกเกม รวมเกม Maki — เกมไหนยังไม่รีวิวชวนให้รีวิว เกมไหนรีวิวแล้วให้แก้ได้
// + แต้มรีวิว: ป้าย "+x แต้ม" สำหรับเกมที่รีวิวแล้วจะได้ · "ได้รับแล้ว" สำหรับเกมที่ได้แต้มไปแล้ว
export default async function MyReviewsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  const { userId } = await requireUser(locale)
  // กวาดแต้มที่ตกหล่น (ซื้อ/รีวิว) ก่อนคำนวณป้าย ให้หน้ากับยอดใน sidebar ตรงกันในการโหลดเดียว
  await reconcileUserPoints(userId).catch(() => 0)

  // เกมที่ซื้อ (จ่ายแล้ว) ทั้งเกมเราและเกม Maki — เกมละ 1 แถว ใช้วันที่ซื้อล่าสุด
  const [paid, makiPaid] = await Promise.all([
    prisma.orders.findMany({
      where: { user_id: userId, status: "paid" },
      orderBy: [{ paid_at: "desc" }, { created_at: "desc" }],
      select: { product_id: true, paid_at: true, created_at: true },
    }),
    prisma.partner_orders.findMany({
      where: { user_id: userId, status: "paid" },
      orderBy: [{ paid_at: "desc" }, { created_at: "desc" }],
      select: { partner_product_id: true, paid_at: true, created_at: true },
    }),
  ])
  const bought = new Map<string, { game: GameRef; at: Date | null }>()
  for (const o of paid) if (!bought.has(o.product_id)) bought.set(o.product_id, { game: { kind: "product", id: o.product_id }, at: o.paid_at ?? o.created_at ?? null })
  for (const o of makiPaid) if (!bought.has(o.partner_product_id)) bought.set(o.partner_product_id, { game: { kind: "partner", id: o.partner_product_id }, at: o.paid_at ?? o.created_at ?? null })
  const games = [...bought.values()].sort((a, b) => (b.at?.getTime() ?? 0) - (a.at?.getTime() ?? 0))

  const [products, makiGames, reviews] = await Promise.all([
    prisma.products.findMany({
      where: { id: { in: games.filter((g) => g.game.kind === "product").map((g) => g.game.id) } },
      include: { product_images: { orderBy: { sort_order: "asc" }, take: 1 } },
    }),
    prisma.partner_products.findMany({
      where: { id: { in: games.filter((g) => g.game.kind === "partner").map((g) => g.game.id) } },
      select: { id: true, external_slug: true, name_th: true, name_en: true, thumbnail_url: true, images: true },
    }),
    prisma.product_reviews.findMany({ where: { user_id: userId } }),
  ])
  const mine = new Map(reviews.map((r) => [(r.product_id ?? r.partner_product_id) as string, r]))
  const pts = await reviewPointsStates(userId, games.map((g) => ({ game: g.game, reviewCreatedAt: mine.get(g.game.id)?.created_at ?? null })))

  const items = games.flatMap(({ game, at }) => {
    const p = game.kind === "product" ? products.find((x) => x.id === game.id) : null
    const m = game.kind === "partner" ? makiGames.find((x) => x.id === game.id) : null
    if (!p && !m) return []
    const r = mine.get(game.id)
    const makiImages = m && Array.isArray(m.images) ? (m.images as string[]) : []
    return [{
      slug: p ? p.slug : m!.external_slug,
      name_th: (p ?? m)!.name_th,
      name_en: (p ?? m)!.name_en,
      image: p ? p.product_images[0]?.url ?? null : m!.thumbnail_url ?? makiImages[0] ?? null,
      bought_at: at?.toISOString() ?? null,
      review: r ? { rating: r.rating, comment: r.comment, updated_at: r.updated_at?.toISOString() ?? null } : null,
      points: pts.states.get(game.id) ?? { state: "none" as const, points: 0 },
    }]
  })

  return (
    <AccountFrame active="reviews">
      <MyReviewsClient items={items} perReview={pts.active ? pts.perReview : 0} />
    </AccountFrame>
  )
}
