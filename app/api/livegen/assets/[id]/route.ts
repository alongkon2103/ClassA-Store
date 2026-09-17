// ลบรูปที่อัปโหลด (ของตัวเอง) — ลบไฟล์แบบ best-effort ถ้าไฟล์หายไปแล้วก็ไม่ล้ม
import { unlink } from "fs/promises"
import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { livegenAssetDiskPath } from "@/lib/livegen/assetPaths"

export const runtime = "nodejs"

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  const { id } = await params
  const row = await prisma.livegen_assets.findUnique({ where: { id }, select: { user_id: true, url: true } })
  if (!row || row.user_id !== session.user.id) return NextResponse.json({ error: "not_found" }, { status: 404 })

  await prisma.livegen_assets.delete({ where: { id } })
  // url = /uploads/livegen/<user>/<file> — ลบเฉพาะไฟล์ในโฟลเดอร์ของตัวเอง
  if (row.url.startsWith(`/uploads/livegen/${session.user.id}/`) && !row.url.includes("..")) {
    await unlink(livegenAssetDiskPath(row.url)).catch(() => {})
  }
  return NextResponse.json({ ok: true })
}
