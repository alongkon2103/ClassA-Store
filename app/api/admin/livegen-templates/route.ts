// เท็มเพลตจากร้านของ livegen (หน้า admin: Game Templates)
//   POST   { name, kind: "image", image_url, orientation }               รูปเต็มพื้น (อัปโหลดผ่าน /api/admin/upload ก่อน)
//   POST   { name, kind: "canvas", canvas_json, orientation, thumbnail }  ไฟล์ดีไซน์ที่ส่งออกจาก editor
//   PATCH  { id, name?, is_visible?, cover_url? }                        เปลี่ยนชื่อ / เปิด-ปิดการแสดงผล / รูปปก (null = เอาออก)
//   DELETE { id }
// หน้า livegen เป็น force-dynamic อยู่แล้ว แก้แล้วลูกค้าเห็นทันที ไม่ต้อง revalidate
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { validateAdmin } from "@/lib/adminAuth"
import { parseTemplateBody, uploadPath } from "@/lib/livegen/validate"

export const runtime = "nodejs"

const bad = (error: string) => NextResponse.json({ error }, { status: 400 })

export async function POST(req: NextRequest) {
  const admin = await validateAdmin(["admin"])
  if (!admin.isValid) return admin.response
  const parsed = parseTemplateBody(await req.json().catch(() => null))
  if ("error" in parsed) return bad(parsed.error)
  const row = await prisma.livegen_templates.create({ data: parsed.data, select: { id: true } })
  return NextResponse.json({ ok: true, id: row.id })
}

export async function PATCH(req: NextRequest) {
  const admin = await validateAdmin(["admin"])
  if (!admin.isValid) return admin.response
  const b = await req.json().catch(() => ({}))
  if (typeof b.id !== "string") return bad("id_required")
  const data: { name?: string; is_visible?: boolean; cover_url?: string | null; updated_at: Date } = { updated_at: new Date() }
  const name = typeof b.name === "string" ? b.name.trim().slice(0, 80) : ""
  if (name) data.name = name
  if (typeof b.is_visible === "boolean") data.is_visible = b.is_visible
  if ("cover_url" in b) {
    const cover = b.cover_url === null ? null : uploadPath(b.cover_url)
    if (b.cover_url !== null && !cover) return bad("invalid_cover")
    data.cover_url = cover
  }
  await prisma.livegen_templates.updateMany({ where: { id: b.id }, data })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const admin = await validateAdmin(["admin"])
  if (!admin.isValid) return admin.response
  const b = await req.json().catch(() => ({}))
  if (typeof b.id !== "string") return bad("id_required")
  await prisma.livegen_templates.deleteMany({ where: { id: b.id } })
  return NextResponse.json({ ok: true })
}
