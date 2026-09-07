// ลบรูปที่อัปโหลด (ของตัวเอง) — ลบไฟล์แบบ best-effort ถ้าไฟล์หายไปแล้วก็ไม่ล้ม
import { unlink } from "fs/promises"
import path from "path"
import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
const BASE_UPLOAD_DIR =
  process.env.NODE_ENV === "production" ? "/var/www/uploads" : path.join(process.cwd(), "public", "uploads")

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  const { id } = await params
  const row = await prisma.livegen_assets.findUnique({ where: { id }, select: { user_id: true, url: true } })
  if (!row || row.user_id !== session.user.id) return NextResponse.json({ error: "not_found" }, { status: 404 })

  await prisma.livegen_assets.delete({ where: { id } })
  // url = /uploads/livegen/<user>/<file> → ตัด "/uploads/" ออกแล้วต่อกับโฟลเดอร์จริง
  const rel = row.url.replace(/^\/uploads\//, "")
  if (rel.startsWith(`livegen/${session.user.id}/`)) {
    await unlink(path.join(BASE_UPLOAD_DIR, rel)).catch(() => {})
  }
  return NextResponse.json({ ok: true })
}
