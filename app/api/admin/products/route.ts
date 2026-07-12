//api/admin/products/

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { validateAdmin } from "@/lib/adminAuth"

export async function GET() {
  const admin = await validateAdmin()
  if (!admin.isValid) return admin.response

  const products = await prisma.products.findMany({
    orderBy: { created_at: "desc" },
    include: {
      product_images:  { orderBy: { sort_order: "asc" }, take: 1 },
      product_variants: {
        where: { is_active: true },
        include: {
          _count: { select: { game_keys: { where: { status: "available" } } } },
        },
      },
      _count: { select: { orders: true } },
    },
  })

  const safe = products.map((p) => ({
    ...p,
    price: Number(p.price),
    product_variants: p.product_variants.map((v) => ({
      ...v,
      price: Number(v.price),
      stock: v._count.game_keys,
    })),
  }))

  return NextResponse.json(safe)
}

export async function POST(req: NextRequest) {
  const admin = await validateAdmin()
  if (!admin.isValid) return admin.response

  const body = await req.json()
  const { name_en, name_th, slug, description_en, description_th, price, is_active, is_featured, isLower, youtube_url, videos, tutorial_video_url, preview_video_url } = body

  if (!name_en || !name_th || !slug || !price) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
  }

  // Normalize the YouTube video list; keep the legacy single youtube_url in sync
  // with the first video so the shop ProductModal keeps working.
  const vids: string[] = Array.isArray(videos)
    ? videos.map((s: string) => (s ?? "").trim()).filter(Boolean)
    : (youtube_url ? [String(youtube_url).trim()] : [])

  // Check for duplicate slug
  const existing = await prisma.products.findUnique({ where: { slug } })
  if (existing) return NextResponse.json({ error: "Slug already exists" }, { status: 400 })

  const product = await prisma.products.create({
    data: {
      name_en, name_th, slug,
      description_en: description_en ?? null,
      description_th: description_th ?? null,
      price,
      is_active:   is_active   ?? true,
      is_featured: is_featured ?? false,
      isLower:     isLower     ?? false,
      youtube_url: vids[0] ?? null,
      tutorial_video_url: tutorial_video_url ?? null,
      preview_video_url: preview_video_url ?? null,
      created_by_id: admin?.session?.user.id,
      ...(vids.length > 0 ? { product_videos: { create: vids.map((url, i) => ({ url, sort_order: i })) } } : {}),
    },
  })

  return NextResponse.json({ ...product, price: Number(product.price) }, { status: 201 })
}