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

  const order = await prisma.orders.update({
    where: { id },
    data: {
      ...(body.whitelist_status && { whitelist_status: body.whitelist_status }),
      ...(body.status           && { status: body.status }),
      ...(body.whitelist_status === "whitelisted" && { fulfilled_at: new Date() }),
    },
  })

  return NextResponse.json({ ...order, amount: Number(order.amount) })
}