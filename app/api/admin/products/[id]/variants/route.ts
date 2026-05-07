import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await req.json()
  const { label_en, label_th, duration_type, duration_days, price, sort_order, is_active } = body

  if (!label_en || !label_th || !price) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
  }

  if (duration_type === "days" && (!duration_days || Number(duration_days) <= 0)) {
    return NextResponse.json({ error: "Invalid duration days" }, { status: 400 })
  }

  const variant = await prisma.product_variants.create({
    data: {
      product_id:    id,
      label_en,
      label_th,
      duration_type: duration_type ?? "permanent",
      duration_days: duration_type === "days" ? Number(duration_days) : null,
      price,
      sort_order:    sort_order ?? 0,
      is_active:     is_active  ?? true,
    },
  })

  return NextResponse.json({ ...variant, price: Number(variant.price) }, { status: 201 })
}