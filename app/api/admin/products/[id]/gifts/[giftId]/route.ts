import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { unlink } from "fs/promises"
import path from "path"

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ giftId: string }> }
) {
  const { giftId } = await params

  const gift = await prisma.product_gifts.findUnique({ where: { id: giftId } })
  if (!gift) return NextResponse.json({ error: "Not found" }, { status: 404 })

  if (gift.url.startsWith("/gifts/")) {
    const filePath = path.join(process.cwd(), "public", gift.url)
    await unlink(filePath).catch(() => {})
  }

  await prisma.product_gifts.delete({ where: { id: giftId } })
  return NextResponse.json({ ok: true })
}