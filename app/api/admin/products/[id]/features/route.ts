// ฟีเจอร์/จุดเด่นของสินค้าที่แอดมินพิมพ์เอง — GET รายการ / PUT แทนทั้งชุด (ลบของเก่า ใส่ใหม่ตามลำดับที่ส่งมา)
import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { revalidatePath } from "next/cache"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { routing } from "@/i18n/routing"

export const runtime = "nodejs"
const MAX_ITEMS = 40

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (session?.user?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const { id } = await params
  const features = await prisma.product_features.findMany({ where: { product_id: id }, orderBy: { sort_order: "asc" } })
  return NextResponse.json({ features })
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (session?.user?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const { id } = await params

  const product = await prisma.products.findUnique({ where: { id }, select: { slug: true } })
  if (!product) return NextResponse.json({ error: "not_found" }, { status: 404 })

  const body = await req.json().catch(() => null)
  const raw: unknown[] = Array.isArray(body?.items) ? body.items : []
  const items = raw
    .map((x) => {
      const o = (x ?? {}) as Record<string, unknown>
      const text_th = typeof o.text_th === "string" ? o.text_th.trim().slice(0, 200) : ""
      const text_en = typeof o.text_en === "string" ? o.text_en.trim().slice(0, 200) : ""
      return { text_th, text_en }
    })
    .filter((x) => x.text_th || x.text_en)
    .slice(0, MAX_ITEMS)

  await prisma.$transaction([
    prisma.product_features.deleteMany({ where: { product_id: id } }),
    ...items.map((it, i) =>
      prisma.product_features.create({
        data: { product_id: id, text_th: it.text_th || it.text_en, text_en: it.text_en || null, sort_order: i },
      }),
    ),
  ])
  // หน้าสินค้าเป็น ISR — ให้สร้างใหม่ทันทีทุกภาษา
  for (const locale of routing.locales) revalidatePath(`/${locale}/products/${product.slug}`)

  const features = await prisma.product_features.findMany({ where: { product_id: id }, orderBy: { sort_order: "asc" } })
  return NextResponse.json({ ok: true, features })
}
