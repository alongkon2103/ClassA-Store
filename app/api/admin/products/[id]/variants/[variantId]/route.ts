import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { validateProductEditor } from "@/lib/adminAuth"

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; variantId: string }> }
) {
  const { id, variantId } = await params
  const admin = await validateProductEditor(id)
  if (!admin.isValid) return admin.response

  const existing = await prisma.product_variants.findFirst({ where: { id: variantId, product_id: id }, select: { id: true } })
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })

  // Only the fields VariantManager edits (never product_id / discount_used). Omitted = unchanged.
  const {
    label_en,
    label_th,
    duration_type,
    duration_days,
    price,
    sort_order,
    is_active,
    variant_type,
    premium_addon_price,
    discount_pct,
    discount_limit
  } = await req.json()

  const variant = await prisma.product_variants.update({
    where: { id: variantId },
    data: {
      label_en,
      label_th,
      duration_type,
      duration_days,
      price,
      sort_order,
      is_active,
      variant_type,
      premium_addon_price,
      discount_pct,
      discount_limit,
      updated_at: new Date(),
    },
  })

  return NextResponse.json({ 
    ...variant, 
    price: Number(variant.price),
    premium_addon_price: Number(variant.premium_addon_price ?? 0),
    discount_pct: Number(variant.discount_pct ?? 0)
  })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; variantId: string }> }
) {
  const { id, variantId } = await params
  const admin = await validateProductEditor(id)
  if (!admin.isValid) return admin.response

  const existing = await prisma.product_variants.findFirst({ where: { id: variantId, product_id: id }, select: { id: true } })
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })

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