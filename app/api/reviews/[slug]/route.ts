// รีวิวสินค้า
//   GET    — รายการรีวิว + สรุปคะแนน (ค่าเฉลี่ย/จำนวน/การกระจาย 1-5 ดาว)
//   POST   — เขียน/แก้รีวิวของตัวเอง  (ต้องล็อกอิน + ต้องเคยซื้อสินค้านี้และจ่ายเงินแล้ว)
//   DELETE — ลบรีวิวของตัวเอง
//   แต้มรีวิว: POST ให้แต้มครั้งแรกของเกมนั้น (เฉพาะซื้อจริง) · DELETE หักคืน — กติกาอยู่ใน lib/points.ts
//   ใช้ได้ทั้งเกมเราและเกม Maki (slug เดียวกัน /products/<slug>) — ดู lib/games.ts
//
// เงื่อนไข "ต้องซื้อจริงก่อน" ตั้งใจใส่ไว้ เพราะร้านนี้ขายจริง — ถ้าใครก็รีวิวได้
// หน้าเว็บจะเต็มไปด้วยคะแนนปลอมและลูกค้าตัดสินใจจากข้อมูลที่เชื่อไม่ได้
import { NextRequest, NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { routing } from "@/i18n/routing"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { awardPointsForReview, reversePointsForReview, reviewPointsStates } from "@/lib/points"
import { gameBySlug, gameUserKey, gameWhere, hasPurchased } from "@/lib/games"

export const runtime = "nodejs"


export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const game = await gameBySlug(slug)
  if (!game) return NextResponse.json({ error: "not_found" }, { status: 404 })

  const [rows, session] = await Promise.all([
    prisma.product_reviews.findMany({
      where: gameWhere(game),
      orderBy: { created_at: "desc" },
      take: 50,
      include: { users: { select: { id: true, username: true, avatar: true } } },
    }),
    getServerSession(authOptions),
  ])

  const dist = [0, 0, 0, 0, 0] // index 0 = 1 ดาว
  for (const r of rows) if (r.rating >= 1 && r.rating <= 5) dist[r.rating - 1]++
  const count = rows.length
  const average = count ? Math.round((rows.reduce((s, r) => s + r.rating, 0) / count) * 10) / 10 : 0

  const meId = session?.user?.id ?? null
  const canReview = meId ? await hasPurchased(meId, game) : false
  const myRow = meId ? rows.find((r) => r.user_id === meId) ?? null : null
  // สถานะแต้มรีวิวของฉันสำหรับเกมนี้ (available = รีวิว/บันทึกตอนนี้ได้แต้ม · earned = ได้แล้ว)
  const reviewPoints = meId && canReview
    ? (await reviewPointsStates(meId, [{ game, reviewCreatedAt: myRow?.created_at ?? null }])).states.get(game.id) ?? null
    : null

  return NextResponse.json({
    average,
    count,
    distribution: dist,
    canReview,
    myReview: myRow,
    reviewPoints,
    reviews: rows.map((r) => ({
      id: r.id,
      rating: r.rating,
      comment: r.comment,
      created_at: r.created_at,
      mine: r.user_id === meId,
      user: {
        name: r.users?.username || "ผู้ใช้",
        avatar: r.users?.avatar ?? null,
      },
    })),
  })
}

// หน้าสินค้าเป็น ISR (60 วิ) — เขียน/ลบรีวิวแล้วให้ทุกภาษาสร้างใหม่ทันที คะแนนหัวหน้าจะได้ไม่ค้าง
function revalidateProduct(slug: string) {
  for (const locale of routing.locales) revalidatePath(`/${locale}/products/${slug}`)
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const { slug } = await params
  const game = await gameBySlug(slug)
  if (!game) return NextResponse.json({ error: "not_found" }, { status: 404 })

  if (!(await hasPurchased(session.user.id, game))) {
    return NextResponse.json({ error: "must_purchase" }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const rating = Number(body.rating)
  const comment = typeof body.comment === "string" ? body.comment.trim().slice(0, 1000) : null
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return NextResponse.json({ error: "invalid_rating" }, { status: 400 })
  }

  const saved = await prisma.product_reviews.upsert({
    where: gameUserKey(game, session.user.id),
    create: { ...gameWhere(game), user_id: session.user.id, rating, comment: comment || null },
    update: { rating, comment: comment || null, updated_at: new Date() },
    select: { id: true, rating: true, comment: true },
  })

  revalidateProduct(slug)
  // แต้มรีวิว (ครั้งแรกของเกมนี้เท่านั้น — แก้รีวิวไม่ได้ซ้ำ)
  const pts = await awardPointsForReview(session.user.id, game)
  return NextResponse.json({ ok: true, review: saved, points: pts?.created ? pts.points : null })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const { slug } = await params
  const game = await gameBySlug(slug)
  if (!game) return NextResponse.json({ error: "not_found" }, { status: 404 })

  const del = await prisma.product_reviews.deleteMany({
    where: { ...gameWhere(game), user_id: session.user.id },
  })
  // ลบรีวิวจริง → หักแต้มรีวิวคืน (ถ้าเคยได้)
  const reversed = del.count > 0 ? await reversePointsForReview(session.user.id, game) : 0
  revalidateProduct(slug)
  return NextResponse.json({ ok: true, reversed })
}
