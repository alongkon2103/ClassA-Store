import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { validateAdmin } from "@/lib/adminAuth"

type ConsignmentInput = {
  owner_name: string
  owner_contact: string
  payout_share: number | string
}

type ShareInput = {
  partner_id: string
  share_pct: number | string
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await validateAdmin()
  if (!admin.isValid) return admin.response

  const { id } = await params

  // Partnership can only edit their own products
  if (admin.session?.user?.role === "partnership") {
    const product = await prisma.products.findUnique({
      where: { id },
      select: { created_by_id: true }
    })
    
    if (!product || product.created_by_id !== admin.session.user.id) {
      return NextResponse.json({ error: "Forbidden: You can only edit your own products" }, { status: 403 })
    }
  }

  const { consignments, partnership_shares, ...rest } = await req.json()

  const result = await prisma.$transaction(async (tx) => {
    // 1. Update product main info
    const firstOwner = consignments && consignments.length > 0 ? consignments[0] : null
    const updatedProduct = await tx.products.update({
      where: { id },
      data: {
        ...rest,
        owner_name: firstOwner ? firstOwner.owner_name : (rest.owner_name ?? undefined),
        owner_contact: firstOwner ? firstOwner.owner_contact : (rest.owner_contact ?? undefined),
        updated_at: new Date(),
      },
    })

    // 2. Handle consignments if provided
    if (consignments) {
      await tx.product_consignments.deleteMany({ where: { product_id: id } })
      if (consignments.length > 0) {
        await tx.product_consignments.createMany({
          data: consignments.map((c: ConsignmentInput) => ({
            product_id: id,
            owner_name: c.owner_name,
            owner_contact: c.owner_contact,
            payout_share: Number(c.payout_share)
          }))
        })
      }
    }

    // 3. Handle partnership shares if provided
    if (partnership_shares) {
      await tx.product_shares.deleteMany({ where: { product_id: id } })
      if (partnership_shares.length > 0) {
        await tx.product_shares.createMany({
          data: partnership_shares.map((s: ShareInput) => ({
            product_id: id,
            partner_id: s.partner_id,
            share_pct: Number(s.share_pct)
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
  const admin = await validateAdmin()
  if (!admin.isValid) return admin.response

  const { id } = await params

  // Partnership can only delete their own products
  if (admin?.session?.user.role === "partnership") {
    const product = await prisma.products.findUnique({
      where: { id },
      select: { created_by_id: true }
    })
    
    if (!product || product.created_by_id !== admin.session.user.id) {
      return NextResponse.json({ error: "Forbidden: You can only delete your own products" }, { status: 403 })
    }
  }

  await prisma.products.delete({ where: { id } })

  return NextResponse.json({ ok: true })
}
