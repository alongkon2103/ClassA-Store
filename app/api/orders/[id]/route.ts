import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params

  const order = await prisma.orders.findUnique({
    where: { id },
    include: {
      products:         { include: { product_gifts: true, product_presets: true } },
      product_variants: true,
      game_keys:        true,
    },
  })

  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (order.user_id !== session.user.id && session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  return NextResponse.json({
    ...order,
    amount: Number(order.amount),
    product_variants: order.product_variants
      ? { ...order.product_variants, price: Number(order.product_variants.price) }
      : null,
  })
}