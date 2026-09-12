// หมวดหมู่เกม (admin) ใช้ร่วมกันทั้งเกมเรา (products) และเกมพาร์ทเนอร์ (partner_products)
//   POST   { name_th, name_en }                       สร้างหมวด (ต่อท้ายลำดับ)
//   POST   { action: "starter" }                      ตอนยังไม่มีหมวด: สร้าง Roblox + Minecraft แล้วใส่ให้เกมที่ยังไม่มีหมวด
//                                                     (เกม desktop_program และเกม Maki = Minecraft · ที่เหลือ = Roblox)
//   PATCH  { id, name_th?, name_en?, is_visible? }    แก้หมวด · { order: [id, ...] } = เรียงใหม่ทั้งชุด
//   DELETE { id }                                     ลบหมวด (เกมในหมวดกลายเป็นไม่มีหมวด ด้วย FK ON DELETE SET NULL)
//   PUT    { kind: "product" | "partner", id, category_id | null }   ใส่/เอาหมวดออกจากเกม
// แก้เมื่อไหร่ revalidate ทั้งเว็บ (หน้าแรก/หน้าร้าน/หน้าเกมเป็น ISR) ให้ป้ายกับตัวกรองเปลี่ยนทันที
import { NextRequest, NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { validateAdmin } from "@/lib/adminAuth"

export const runtime = "nodejs"

const clean = (v: unknown) => (typeof v === "string" ? v.trim().slice(0, 40) : "")
const bad = (error: string) => NextResponse.json({ error }, { status: 400 })
const done = () => {
  revalidatePath("/", "layout")
  return NextResponse.json({ ok: true })
}

export async function POST(req: NextRequest) {
  const admin = await validateAdmin(["admin"])
  if (!admin.isValid) return admin.response
  const body = await req.json().catch(() => ({}))

  if (body.action === "starter") {
    if (await prisma.game_categories.count()) return NextResponse.json({ error: "not_empty" }, { status: 409 })
    const roblox = await prisma.game_categories.create({ data: { name_th: "Roblox", name_en: "Roblox", sort_order: 1 } })
    const minecraft = await prisma.game_categories.create({ data: { name_th: "Minecraft", name_en: "Minecraft", sort_order: 2 } })
    // ลำดับสำคัญ: ใส่ Minecraft ก่อน แล้วที่ยังว่างทั้งหมดค่อยเป็น Roblox
    await prisma.$transaction([
      prisma.products.updateMany({ where: { category_id: null, type: "desktop_program" }, data: { category_id: minecraft.id } }),
      prisma.products.updateMany({ where: { category_id: null }, data: { category_id: roblox.id } }),
      prisma.partner_products.updateMany({ where: { category_id: null, partner: { integration: "maki_api" } }, data: { category_id: minecraft.id } }),
      prisma.partner_products.updateMany({ where: { category_id: null }, data: { category_id: roblox.id } }),
    ])
    return done()
  }

  const name_th = clean(body.name_th), name_en = clean(body.name_en)
  if (!name_th && !name_en) return bad("name_required")
  const last = await prisma.game_categories.aggregate({ _max: { sort_order: true } })
  await prisma.game_categories.create({
    data: { name_th: name_th || name_en, name_en: name_en || name_th, sort_order: (last._max.sort_order ?? 0) + 1 },
  })
  return done()
}

export async function PATCH(req: NextRequest) {
  const admin = await validateAdmin(["admin"])
  if (!admin.isValid) return admin.response
  const body = await req.json().catch(() => ({}))

  if (Array.isArray(body.order)) {
    const ids = (body.order as unknown[]).filter((x): x is string => typeof x === "string")
    await prisma.$transaction(ids.map((id, i) => prisma.game_categories.updateMany({ where: { id }, data: { sort_order: i + 1 } })))
    return done()
  }
  if (typeof body.id !== "string") return bad("id_required")
  const data: { name_th?: string; name_en?: string; is_visible?: boolean } = {}
  if (clean(body.name_th)) data.name_th = clean(body.name_th)
  if (clean(body.name_en)) data.name_en = clean(body.name_en)
  if (typeof body.is_visible === "boolean") data.is_visible = body.is_visible
  await prisma.game_categories.updateMany({ where: { id: body.id }, data })
  return done()
}

export async function DELETE(req: NextRequest) {
  const admin = await validateAdmin(["admin"])
  if (!admin.isValid) return admin.response
  const body = await req.json().catch(() => ({}))
  if (typeof body.id !== "string") return bad("id_required")
  await prisma.game_categories.deleteMany({ where: { id: body.id } })
  return done()
}

export async function PUT(req: NextRequest) {
  const admin = await validateAdmin(["admin"])
  if (!admin.isValid) return admin.response
  const body = await req.json().catch(() => ({}))
  if (typeof body.id !== "string") return bad("id_required")
  const category_id = typeof body.category_id === "string" && body.category_id ? body.category_id : null
  if (body.kind === "product") await prisma.products.updateMany({ where: { id: body.id }, data: { category_id } })
  else if (body.kind === "partner") await prisma.partner_products.updateMany({ where: { id: body.id }, data: { category_id } })
  else return bad("bad_kind")
  return done()
}
