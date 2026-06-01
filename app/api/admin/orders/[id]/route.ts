import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { validateAdmin } from "@/lib/adminAuth"

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await validateAdmin(["admin"])
  if (!admin.isValid) return admin.response

  const { id }  = await params
  const body    = await req.json()

  // Fetch the order first to check for discounts
  const order = await prisma.orders.findUnique({
    where: { id },
    include: { products: true, product_variants: true }
  })
  
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 })

  const becomingPaid = body.status === "paid" && order.status !== "paid"
  const shouldIncrementDiscount = becomingPaid && !!(
    order.variant_id && 
    order.products.has_limited_discount && 
    order.product_variants &&
    Number(order.product_variants.discount_pct) > 0 &&
    (order.product_variants.discount_used ?? 0) < (order.product_variants.discount_limit ?? 0)
  )

  const result = await prisma.$transaction(async (tx) => {
    const updatedOrder = await tx.orders.update({
      where: { id },
      data: {
        ...(body.whitelist_status && { whitelist_status: body.whitelist_status }),
        ...(body.status           && { status: body.status }),
        ...(body.whitelist_status === "whitelisted" && { fulfilled_at: new Date() }),
      },
    })

    if (shouldIncrementDiscount) {
      await tx.product_variants.update({
        where: { id: order.variant_id! },
        data: { discount_used: { increment: 1 } }
      })
    }
    
    return updatedOrder
  })

  return NextResponse.json({ ...result, amount: Number(result.amount) })
}