import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { unlink } from "fs/promises"
import path from "path"

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ presetId: string }> }
) {
  const { presetId } = await params

  const preset = await prisma.product_presets.findUnique({ where: { id: presetId } })
  if (!preset) return NextResponse.json({ error: "Not found" }, { status: 404 })

  if (preset.url.startsWith("/presets/")) {
    const filePath = path.join(process.cwd(), "public", preset.url)
    await unlink(filePath).catch(() => {})
  }

  await prisma.product_presets.delete({ where: { id: presetId } })
  return NextResponse.json({ ok: true })
}