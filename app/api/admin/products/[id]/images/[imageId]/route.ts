import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { unlink } from "fs/promises"
import path from "path"

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ imageId: string }> }
) {
  const { imageId } = await params

  const image = await prisma.product_images.findUnique({ where: { id: imageId } })
  if (!image) return NextResponse.json({ error: "Not found" }, { status: 404 })

  // ลบไฟล์จริงด้วยถ้าเป็น local upload
  if (image.url.startsWith("/uploads/")) {
    const filePath = path.join(process.cwd(), "public", image.url)
    await unlink(filePath).catch(() => {}) // ไม่ error ถ้าไฟล์ไม่มีแล้ว
  }

  await prisma.product_images.delete({ where: { id: imageId } })
  return NextResponse.json({ ok: true })
}