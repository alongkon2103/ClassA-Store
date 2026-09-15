// PATCH /api/admin/partner-store/products/[id] — แก้ค่าที่เป็นของแอดมินบนเกมพาร์ทเนอร์
//   ทุกร้าน: is_visible / show_partner_badge / sort_order / preview_video_url
//   ร้านแบบ maki_api เพิ่ม: ชื่อ TH/EN, คำอธิบาย, รูปปก/แกลเลอรี, ราคาขายต่อแพลน (ต้อง ≥ ขั้นต่ำสดจาก Maki), โปรแกรมที่ต้องโหลด (downloads [{name,url}])
// ค่าพวกนี้ PRESERVED ตอน sync — sync ทับเฉพาะขั้นต่ำ/ลิงก์พรีเซ็ต
import { NextRequest, NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { validateAdmin } from "@/lib/adminAuth"
import { routing } from "@/i18n/routing"
import { getMakiCatalog, toPlanRows, toDownloads, priceFrom, asJson } from "@/lib/maki"

export const runtime = "nodejs"

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await validateAdmin(["admin"])
  if (!admin.isValid) return admin.response

  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const row = await prisma.partner_products.findUnique({ where: { id }, include: { partner: { select: { integration: true } } } })
  if (!row) return NextResponse.json({ error: "not_found" }, { status: 404 })
  const isMaki = row.partner.integration === "maki_api"

  const data: Record<string, unknown> = { updated_at: new Date() }
  if (typeof body.is_visible === "boolean") data.is_visible = body.is_visible
  if (typeof body.show_partner_badge === "boolean") data.show_partner_badge = body.show_partner_badge
  if (typeof body.sort_order === "number") data.sort_order = body.sort_order
  // "" หรือ null = ล้างคลิป · string = ตั้ง
  if ("preview_video_url" in body) data.preview_video_url = body.preview_video_url ? String(body.preview_video_url) : null

  if (isMaki) {
    const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : undefined)
    const name_th = str(body.name_th, 120), name_en = str(body.name_en, 120)
    if (name_th) data.name_th = name_th
    if (name_en) data.name_en = name_en
    if ("description_html_th" in body) data.description_html_th = str(body.description_html_th, 20000) || null
    if ("description_html_en" in body) data.description_html_en = str(body.description_html_en, 20000) || null
    if (Array.isArray(body.downloads)) data.downloads = asJson(toDownloads(body.downloads))
    if (body.sell_prices && typeof body.sell_prices === "object") {
      // ขั้นต่ำสดจาก Maki (cache 60 วิ) ถ้าเรียกไม่ได้ใช้ค่าที่ sync ไว้
      let live = new Map<string, number>()
      try { live = new Map((await getMakiCatalog()).products.map((p) => [p.key, p.min_price_thb])) } catch { /* ใช้ค่าใน DB */ }
      const plans = toPlanRows(row.plans)
      const below: { key: string; min: number }[] = []
      for (const pl of plans) {
        if (!(pl.key in body.sell_prices)) continue
        const raw = body.sell_prices[pl.key]
        const price = raw == null || raw === "" ? null : Math.round(Number(raw))
        if (price != null && !Number.isFinite(price)) return NextResponse.json({ error: "invalid_price", key: pl.key }, { status: 400 })
        const min = live.get(pl.key) ?? pl.min_price_thb
        pl.min_price_thb = min
        if (price != null && price < min) below.push({ key: pl.key, min })
        pl.sell_price_thb = price
      }
      if (below.length) return NextResponse.json({ error: "below_min", details: below }, { status: 400 })
      data.plans = asJson(plans)
      data.price_from_thb = priceFrom(plans)
    }
  }

  const updated = await prisma.partner_products.update({
    where: { id },
    data,
    select: { id: true, is_visible: true, sort_order: true, price_from_thb: true, external_slug: true },
  })
  // หน้าร้าน/หน้าสินค้าเป็น ISR — ให้เห็นราคา/รูปใหม่ทันที
  for (const locale of routing.locales) {
    revalidatePath(`/${locale}/products`)
    revalidatePath(`/${locale}/products/${updated.external_slug}`)
  }
  return NextResponse.json({ ...updated, price_from_thb: updated.price_from_thb == null ? null : Number(updated.price_from_thb) })
}
