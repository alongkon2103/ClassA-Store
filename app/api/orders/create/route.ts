import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { product_id, variant_id } = await req.json()
  if (!product_id || !variant_id) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 })
  }

  const variant = await prisma.product_variants.findUnique({ where: { id: variant_id } })
  if (!variant) return NextResponse.json({ error: "Variant not found" }, { status: 404 })

  // Check stock
  const stock = await prisma.game_keys.count({
    where: { variant_id, status: "available" },
  })
  if (stock === 0) return NextResponse.json({ error: "Out of stock" }, { status: 400 })

  const order = await prisma.orders.create({
    data: {
      user_id:        session.user.id,
      product_id,
      variant_id,
      amount:         variant.price,
      status:         "pending",
      payment_method: "promptpay",
    },
  })

  return NextResponse.json({ orderId: order.id }, { status: 201 })
}