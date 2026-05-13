//api/admin/products/[id]
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { consignments, ...rest } = await req.json()

  const result = await prisma.$transaction(async (tx) => {
    // 1. Update product main info
    const firstOwner = consignments && consignments.length > 0 ? consignments[0] : null
    const updatedProduct = await tx.products.update({
      where: { id },
      data: {
        ...rest,
        owner_name: firstOwner ? firstOwner.owner_name : (rest.owner_name ?? null),
        owner_contact: firstOwner ? firstOwner.owner_contact : (rest.owner_contact ?? null),
        updated_at: new Date(),
      },
    })

    // 2. Handle consignments if provided
    if (consignments) {
      // Clear old ones
      await tx.product_consignments.deleteMany({
        where: { product_id: id }
      })

      // Create new ones
      if (consignments.length > 0) {
        await tx.product_consignments.createMany({
          data: consignments.map((c: any) => ({
            product_id: id,
            owner_name: c.owner_name,
            owner_contact: c.owner_contact,
            payout_share: Number(c.payout_share)
          }))
        })
      }
    }

    return updatedProduct
  })

  return NextResponse.json({ ...result, price: Number(result.price) })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  await prisma.products.delete({ where: { id } })

  return NextResponse.json({ ok: true })
}