// ปุ่ม "กดใจ" / "รายการโปรด" บนหน้าสินค้า
//   GET  — สถานะของผู้ใช้ปัจจุบัน + จำนวนคนกดใจทั้งหมด
//   POST — สลับสถานะ  body: { liked?: boolean, saved?: boolean }
import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"

async function productId(slug: string) {
  const p = await prisma.products.findFirst({ where: { slug }, select: { id: true } })
  return p?.id ?? null
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const pid = await productId(slug)
  if (!pid) return NextResponse.json({ error: "not_found" }, { status: 404 })

  const session = await getServerSession(authOptions)
  const [likes, mine] = await Promise.all([
    prisma.product_favorites.count({ where: { product_id: pid, liked: true } }),
    session?.user?.id
      ? prisma.product_favorites.findUnique({
          where: { product_id_user_id: { product_id: pid, user_id: session.user.id } },
          select: { liked: true, saved: true },
        })
      : Promise.resolve(null),
  ])

  return NextResponse.json({
    likes,
    liked: mine?.liked ?? false,
    saved: mine?.saved ?? false,
    signedIn: !!session?.user?.id,
  })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const { slug } = await params
  const pid = await productId(slug)
  if (!pid) return NextResponse.json({ error: "not_found" }, { status: 404 })

  const body = await req.json().catch(() => ({}))
  const data: { liked?: boolean; saved?: boolean } = {}
  if (typeof body.liked === "boolean") data.liked = body.liked
  if (typeof body.saved === "boolean") data.saved = body.saved
  if (Object.keys(data).length === 0) return NextResponse.json({ error: "nothing_to_update" }, { status: 400 })

  const row = await prisma.product_favorites.upsert({
    where: { product_id_user_id: { product_id: pid, user_id: session.user.id } },
    create: { product_id: pid, user_id: session.user.id, ...data },
    update: { ...data, updated_at: new Date() },
    select: { liked: true, saved: true },
  })
  const likes = await prisma.product_favorites.count({ where: { product_id: pid, liked: true } })

  return NextResponse.json({ ok: true, ...row, likes })
}
