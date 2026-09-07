// ข้อมูลบัญชี — PATCH แก้ชื่อที่แสดง (username) ของตัวเอง
// อีเมล/รูปมาจาก Discord/Google ตอนล็อกอิน เลยไม่ให้แก้ตรงนี้
import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const username = typeof body.username === "string" ? body.username.trim() : ""
  if (username.length < 2 || username.length > 32) {
    return NextResponse.json({ error: "invalid_username" }, { status: 400 })
  }

  const user = await prisma.users.update({
    where: { id: session.user.id },
    data: { username },
    select: { username: true },
  })
  return NextResponse.json({ ok: true, username: user.username })
}
