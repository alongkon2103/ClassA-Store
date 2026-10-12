import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { unlink } from "fs/promises"
import path from "path"
import { validateProductEditor } from "@/lib/adminAuth"

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; imageId: string }> }
) {
  const { id, imageId } = await params
  const admin = await validateProductEditor(id)
  if (!admin.isValid) return admin.response

  const image = await prisma.product_images.findFirst({ where: { id: imageId, product_id: id } })
  if (!image) return NextResponse.json({ error: "Not found" }, { status: 404 })

  // Also delete the actual file if it's a local upload ("..": url comes from the request body, don't unlink outside public/)
  if (image.url.startsWith("/uploads/") && !image.url.includes("..")) {
    const filePath = path.join(process.cwd(), "public", image.url)
    await unlink(filePath).catch(() => {}) // Do not error if the file is already gone
  }

  await prisma.product_images.delete({ where: { id: imageId } })
  return NextResponse.json({ ok: true })
}