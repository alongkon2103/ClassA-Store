// PUT /api/admin/storefront-order  body { order: [{ type:"product"|"partner", id }] }
// Writes display_order = position for every game so the storefront shows them in
// exactly this order (our products and partner games interleaved as the admin
// arranged). Position is the array index, so a full ordered list is expected.
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"
import { validateAdmin } from "@/lib/adminAuth"
import { revalidatePath } from "next/cache"

export const runtime = "nodejs"

export async function PUT(req: NextRequest) {
  const admin = await validateAdmin(["admin"])
  if (!admin.isValid) return admin.response

  const body = await req.json().catch(() => ({}))
  const order: Array<{ type?: string; id?: string }> = Array.isArray(body.order) ? body.order : []
  if (order.length === 0) return NextResponse.json({ error: "empty_order" }, { status: 400 })

  const ops: Prisma.PrismaPromise<unknown>[] = []
  order.forEach((item, index) => {
    if (!item.id) return
    if (item.type === "partner") {
      ops.push(prisma.partner_products.update({ where: { id: item.id }, data: { display_order: index } }))
    } else {
      ops.push(prisma.products.update({ where: { id: item.id }, data: { display_order: index } }))
    }
  })
  await prisma.$transaction(ops)

  // Storefront is ISR-cached — refresh it so the new order shows immediately.
  revalidatePath("/th/products")
  revalidatePath("/en/products")

  return NextResponse.json({ ok: true, count: ops.length })
}
