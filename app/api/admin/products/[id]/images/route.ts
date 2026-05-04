import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await req.json()
  const { url, alt_text, sort_order } = body

  if (!url) return NextResponse.json({ error: "url required" }, { status: 400 })

  const image = await prisma.product_images.create({
    data: {
      product_id: id,
      url,
      alt_text:   alt_text   ?? null,
      sort_order: sort_order ?? 0,
    },
  })

  return NextResponse.json(image, { status: 201 })
}