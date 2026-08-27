// PATCH /api/admin/partner-store/products/[id] — toggle a partner game's
// visibility (is_visible) or reorder (sort_order). is_visible is PRESERVED by
// the sync, so hiding a game stays hidden across refreshes.
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { validateAdmin } from "@/lib/adminAuth"

export const runtime = "nodejs"

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await validateAdmin()
  if (!admin.isValid) return admin.response

  const { id } = await params
  const body = await req.json().catch(() => ({}))

  const data: { is_visible?: boolean; sort_order?: number; updated_at: Date } = { updated_at: new Date() }
  if (typeof body.is_visible === "boolean") data.is_visible = body.is_visible
  if (typeof body.sort_order === "number") data.sort_order = body.sort_order

  const updated = await prisma.partner_products.update({
    where: { id },
    data,
    select: { id: true, is_visible: true, sort_order: true },
  })
  return NextResponse.json(updated)
}
