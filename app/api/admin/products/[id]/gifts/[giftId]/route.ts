import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { unlink } from "fs/promises"
import path from "path"
import { validateProductEditor } from "@/lib/adminAuth"

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; giftId: string }> }
) {
  const { id, giftId } = await params
  const admin = await validateProductEditor(id)
  if (!admin.isValid) return admin.response

  const gift = await prisma.product_gifts.findFirst({ where: { id: giftId, product_id: id } })
  if (!gift) return NextResponse.json({ error: "Not found" }, { status: 404 })

  // "..": url comes from the request body, don't unlink outside public/
  if (gift.url.startsWith("/gifts/") && !gift.url.includes("..")) {
    const filePath = path.join(process.cwd(), "public", gift.url)
    await unlink(filePath).catch(() => {})
  }

  await prisma.product_gifts.delete({ where: { id: giftId } })
  return NextResponse.json({ ok: true })
}