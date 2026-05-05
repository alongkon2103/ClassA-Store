import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { url, filename, filesize, sort_order } = await req.json()

  if (!url || !filename) return NextResponse.json({ error: "url and filename required" }, { status: 400 })

  const preset = await prisma.product_presets.create({
    data: { product_id: id, url, filename, filesize: filesize ?? null, sort_order: sort_order ?? 0 },
  })

  return NextResponse.json(preset, { status: 201 })
}