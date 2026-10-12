import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { unlink } from "fs/promises"
import path from "path"
import { validateProductEditor } from "@/lib/adminAuth"

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; presetId: string }> }
) {
  const { id, presetId } = await params
  const admin = await validateProductEditor(id)
  if (!admin.isValid) return admin.response

  const preset = await prisma.product_presets.findFirst({ where: { id: presetId, product_id: id } })
  if (!preset) return NextResponse.json({ error: "Not found" }, { status: 404 })

  // "..": url comes from the request body, don't unlink outside public/
  if (preset.url.startsWith("/presets/") && !preset.url.includes("..")) {
    const filePath = path.join(process.cwd(), "public", preset.url)
    await unlink(filePath).catch(() => {})
  }

  await prisma.product_presets.delete({ where: { id: presetId } })
  return NextResponse.json({ ok: true })
}