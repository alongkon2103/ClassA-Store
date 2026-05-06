import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ variantId: string }> }
) {
  const { variantId } = await params
  const body = await req.json()

  const variant = await prisma.product_variants.update({
    where: { id: variantId },
    data: { ...body, updated_at: new Date() },
  })

  return NextResponse.json({ ...variant, price: Number(variant.price) })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ variantId: string }> }
) {
  const { variantId } = await params

  // Check if there are any assigned keys
  const hasAssigned = await prisma.game_keys.count({
    where: { variant_id: variantId, status: "assigned" },
  })
  if (hasAssigned > 0) {
    return NextResponse.json(
      { error: "Cannot delete variant with assigned keys" },
      { status: 400 }
    )
  }

  await prisma.product_variants.delete({ where: { id: variantId } })
  return NextResponse.json({ ok: true })
}