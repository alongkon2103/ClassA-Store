import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const keys = await prisma.game_keys.findMany({
    where: { product_id: id },
    orderBy: { created_at: "desc" },
    include: {
      product_variants: { select: { label_en: true } },
    },
  })

  return NextResponse.json(keys)
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await req.json()
  const { keys, variant_id } = body

  if (!Array.isArray(keys) || keys.length === 0) {
    return NextResponse.json({ error: "No keys provided" }, { status: 400 })
  }
  if (!variant_id) {
    return NextResponse.json({ error: "variant_id required" }, { status: 400 })
  }

  // กรอง duplicate key_value ที่มีอยู่แล้วใน product นี้
  const existing = await prisma.game_keys.findMany({
    where: { product_id: id, key_value: { in: keys } },
    select: { key_value: true },
  })
  const existingSet = new Set(existing.map((k) => k.key_value))
  const newKeys = keys.filter((k: string) => !existingSet.has(k))

  if (newKeys.length === 0) {
    return NextResponse.json({ error: "All keys already exist" }, { status: 400 })
  }

  const created = await prisma.game_keys.createMany({
    data: newKeys.map((key_value: string) => ({
      product_id: id,
      variant_id,
      key_value,
      status: "available",
    })),
  })

  // return keys ที่เพิ่งสร้าง
  const result = await prisma.game_keys.findMany({
    where: { product_id: id, key_value: { in: newKeys } },
    orderBy: { created_at: "desc" },
  })

  return NextResponse.json(result, { status: 201 })
}