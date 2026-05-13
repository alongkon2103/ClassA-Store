//api/admin/products/

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET() {
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
  const body = await req.json()
  const { name_en, name_th, slug, description_en, description_th, price, is_active, is_featured, isLower } = body

  if (!name_en || !name_th || !slug || !price) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
  }

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
    },
  })

  return NextResponse.json({ ...product, price: Number(product.price) }, { status: 201 })
}