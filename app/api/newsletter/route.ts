// POST /api/newsletter — รับอีเมลจากช่อง "รับข่าวสาร" ท้ายเว็บ
// สมัครซ้ำด้วยอีเมลเดิมถือว่าสำเร็จ (ไม่ต้องบอกผู้ใช้ว่ามีอยู่แล้ว)
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const email = String(body.email ?? "").trim().toLowerCase()
  const locale = typeof body.locale === "string" ? body.locale.slice(0, 8) : null

  if (!EMAIL_RE.test(email) || email.length > 190) {
    return NextResponse.json({ error: "invalid_email" }, { status: 400 })
  }

  await prisma.newsletter_subscribers.upsert({
    where: { email },
    create: { email, locale },
    update: {},
  })

  return NextResponse.json({ ok: true })
}
