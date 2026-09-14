// ของรางวัลแลกแต้ม (admin)
//   GET                      รายการทั้งหมด + เกม A Class สำหรับ dropdown
//   POST   <RewardInput>     สร้าง
//   PATCH  { id, is_active } เปิด/ปิดอย่างเดียว · { id, ...RewardInput } แก้ทั้งรายการ
//   PUT    { id, codes }     วางโค้ดเพิ่มในคลัง (external_code) — ทีละหลายบรรทัด ซ้ำข้าม
//   DELETE { id }            ลบ (มีประวัติแลกแล้วลบไม่ได้ → 409 ให้ปิดแทน)
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { validateAdmin } from "@/lib/adminAuth"
import { adminAddCodes, adminDeleteReward, adminListRewards, parseRewardInput, rewardProductError } from "@/lib/pointsRedeem"

const isUuid = (s: unknown): s is string => typeof s === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)
const bad = (error: string, status = 400) => NextResponse.json({ error }, { status })

export async function GET() {
  const admin = await validateAdmin(["admin"])
  if (!admin.isValid) return admin.response
  const [rewards, products] = await Promise.all([
    adminListRewards(),
    prisma.products.findMany({ where: { is_active: true }, orderBy: { name_en: "asc" }, select: { id: true, name_th: true, name_en: true, type: true } }),
  ])
  return NextResponse.json({ rewards, products })
}

export async function POST(req: NextRequest) {
  const admin = await validateAdmin(["admin"])
  if (!admin.isValid) return admin.response
  const parsed = parseRewardInput(await req.json().catch(() => null))
  if ("error" in parsed) return bad(parsed.error)
  const pe = await rewardProductError(parsed.data)
  if (pe) return bad(pe)
  const row = await prisma.point_rewards.create({ data: parsed.data, select: { id: true } })
  return NextResponse.json({ ok: true, id: row.id })
}

export async function PATCH(req: NextRequest) {
  const admin = await validateAdmin(["admin"])
  if (!admin.isValid) return admin.response
  const body = await req.json().catch(() => ({}))
  if (!isUuid(body.id)) return bad("id_required")
  const keys = Object.keys(body).filter((k) => k !== "id")
  if (keys.length === 1 && keys[0] === "is_active") {
    await prisma.point_rewards.updateMany({ where: { id: body.id }, data: { is_active: !!body.is_active, updated_at: new Date() } })
    return NextResponse.json({ ok: true })
  }
  const parsed = parseRewardInput(body)
  if ("error" in parsed) return bad(parsed.error)
  const pe = await rewardProductError(parsed.data)
  if (pe) return bad(pe)
  const r = await prisma.point_rewards.updateMany({ where: { id: body.id }, data: { ...parsed.data, updated_at: new Date() } })
  return r.count ? NextResponse.json({ ok: true }) : bad("not_found", 404)
}

export async function PUT(req: NextRequest) {
  const admin = await validateAdmin(["admin"])
  if (!admin.isValid) return admin.response
  const body = await req.json().catch(() => ({}))
  if (!isUuid(body.id)) return bad("id_required")
  const reward = await prisma.point_rewards.findUnique({ where: { id: body.id }, select: { kind: true } })
  if (!reward) return bad("not_found", 404)
  if (reward.kind !== "external_code") return bad("not_code_reward")
  if (typeof body.codes !== "string" || body.codes.length > 200_000) return bad("codes_required")
  return NextResponse.json({ ok: true, ...(await adminAddCodes(body.id, body.codes)) })
}

export async function DELETE(req: NextRequest) {
  const admin = await validateAdmin(["admin"])
  if (!admin.isValid) return admin.response
  const body = await req.json().catch(() => ({}))
  if (!isUuid(body.id)) return bad("id_required")
  const r = await adminDeleteReward(body.id)
  if (r === "has_redemptions") return bad("has_redemptions", 409)
  if (r === "not_found") return bad("not_found", 404)
  return NextResponse.json({ ok: true })
}
