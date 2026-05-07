import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const order = await prisma.orders.findUnique({
    where: { id },
    select: { 
      status: true,
      game_keys: { select: { id: true } }
    },
  })

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 })
  }

  return NextResponse.json({ 
    status: order.status,
    isFulfilled: !!order.game_keys
  })
}
