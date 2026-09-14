// เท็มเพลตจากร้าน 1 อันให้ editor โหลดลง canvas — ลูกค้าเห็นเฉพาะที่เปิดแสดง · แอดมินเปิดดูอันที่ซ่อนได้ (ปุ่ม "เปิดใน editor")
import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getFeatureFlags } from "@/lib/featureFlags"

export const runtime = "nodejs"

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const flags = await getFeatureFlags()
  if (!flags.livegen_enabled) return NextResponse.json({ error: "disabled" }, { status: 404 })
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "not_found" }, { status: 404 })
  const session = await getServerSession(authOptions)
  const isAdmin = session?.user?.role === "admin"
  const template = await prisma.livegen_templates.findFirst({
    where: isAdmin ? { id } : { id, is_visible: true },
    select: { id: true, name: true, kind: true, orientation: true, image_url: true, canvas_json: true },
  })
  if (!template) return NextResponse.json({ error: "not_found" }, { status: 404 })
  return NextResponse.json({ template })
}
