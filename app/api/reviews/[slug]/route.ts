// รีวิวสินค้า
//   GET    — รายการรีวิว + สรุปคะแนน (ค่าเฉลี่ย/จำนวน/การกระจาย 1-5 ดาว)
//   POST   — เขียน/แก้รีวิวของตัวเอง  (ต้องล็อกอิน + ต้องเคยซื้อสินค้านี้และจ่ายเงินแล้ว)
//   DELETE — ลบรีวิวของตัวเอง
//
// เงื่อนไข "ต้องซื้อจริงก่อน" ตั้งใจใส่ไว้ เพราะร้านนี้ขายจริง — ถ้าใครก็รีวิวได้
// หน้าเว็บจะเต็มไปด้วยคะแนนปลอมและลูกค้าตัดสินใจจากข้อมูลที่เชื่อไม่ได้
import { NextRequest, NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { routing } from "@/i18n/routing"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"

async function productBySlug(slug: string) {
  return prisma.products.findFirst({ where: { slug }, select: { id: true } })
}

/** ผู้ใช้คนนี้เคยซื้อสินค้านี้และจ่ายเงินเรียบร้อยหรือยัง */
async function hasPurchased(userId: string, productId: string) {
  const n = await prisma.orders.count({
    where: { user_id: userId, product_id: productId, status: "paid" },
  })
  return n > 0
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const product = await productBySlug(slug)
  if (!product) return NextResponse.json({ error: "not_found" }, { status: 404 })

  const [rows, session] = await Promise.all([
    prisma.product_reviews.findMany({
      where: { product_id: product.id },
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
  const canReview = meId ? await hasPurchased(meId, product.id) : false

  return NextResponse.json({
    average,
    count,
    distribution: dist,
    canReview,
    myReview: meId ? rows.find((r) => r.user_id === meId) ?? null : null,
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
  const product = await productBySlug(slug)
  if (!product) return NextResponse.json({ error: "not_found" }, { status: 404 })

  if (!(await hasPurchased(session.user.id, product.id))) {
    return NextResponse.json({ error: "must_purchase" }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const rating = Number(body.rating)
  const comment = typeof body.comment === "string" ? body.comment.trim().slice(0, 1000) : null
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return NextResponse.json({ error: "invalid_rating" }, { status: 400 })
  }

  const saved = await prisma.product_reviews.upsert({
    where: { product_id_user_id: { product_id: product.id, user_id: session.user.id } },
    create: { product_id: product.id, user_id: session.user.id, rating, comment: comment || null },
    update: { rating, comment: comment || null, updated_at: new Date() },
    select: { id: true, rating: true, comment: true },
  })

  revalidateProduct(slug)
  return NextResponse.json({ ok: true, review: saved })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const { slug } = await params
  const product = await productBySlug(slug)
  if (!product) return NextResponse.json({ error: "not_found" }, { status: 404 })

  await prisma.product_reviews.deleteMany({
    where: { product_id: product.id, user_id: session.user.id },
  })
  revalidateProduct(slug)
  return NextResponse.json({ ok: true })
}
