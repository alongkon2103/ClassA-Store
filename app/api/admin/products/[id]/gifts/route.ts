import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { url, filename, sort_order } = await req.json()

  if (!url) return NextResponse.json({ error: "url required" }, { status: 400 })

  const gift = await prisma.product_gifts.create({
    data: { product_id: id, url, filename: filename ?? null, sort_order: sort_order ?? 0 },
  })

  return NextResponse.json(gift, { status: 201 })
}