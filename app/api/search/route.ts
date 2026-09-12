// GET /api/search?q=… — ค้นหาเกมสำหรับกล่องค้นหาใน navbar
// ค้นทั้งสินค้าเรา (products) และเกม partner ที่เปิดแสดง คืนสูงสุด 8 รายการ
// ผลลัพธ์แต่ละอันมี href พร้อมใช้: สินค้าเรา → หน้ารายละเอียด,
// partner → หน้าสินค้าพร้อม ?slug= ให้เปิด modal ของ partner (ไม่มีหน้าในเว็บเรา)
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { categorySelect, visibleCategory } from "@/lib/gameCategories"

export const runtime = "nodejs"

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 60)
  if (q.length < 1) return NextResponse.json({ items: [] })

  const [ours, partners] = await Promise.all([
    prisma.products.findMany({
      where: {
        is_active: true,
        OR: [
          { name_th: { contains: q, mode: "insensitive" } },
          { name_en: { contains: q, mode: "insensitive" } },
        ],
      },
      take: 8,
      orderBy: [{ is_featured: "desc" }, { created_at: "desc" }],
      select: {
        slug: true, name_th: true, name_en: true, price: true, category: categorySelect,
        product_images: { orderBy: { sort_order: "asc" }, take: 1, select: { url: true } },
        product_variants: { where: { is_active: true }, select: { price: true, variant_type: true } },
      },
    }),
    prisma.partner_products.findMany({
      where: {
        is_visible: true,
        partner: { is_active: true },
        OR: [
          { name_th: { contains: q, mode: "insensitive" } },
          { name_en: { contains: q, mode: "insensitive" } },
        ],
      },
      take: 4,
      select: { partner: { select: { integration: true } }, external_slug: true, name_th: true, name_en: true, thumbnail_url: true, price_from_thb: true, category: categorySelect },
    }),
  ])

  const items = [
    ...ours.map((p) => {
      const prices = p.product_variants.filter((v) => v.variant_type !== "premium").map((v) => Number(v.price))
      return {
        slug: p.slug,
        name_th: p.name_th,
        name_en: p.name_en,
        image: p.product_images[0]?.url ?? null,
        price: prices.length ? Math.min(...prices) : Number(p.price),
        partner: false,
        category: visibleCategory(p.category),
        href: `/products/${p.slug}`,
      }
    }),
    ...partners.map((p) => ({
      slug: p.external_slug,
      name_th: p.name_th,
      name_en: p.name_en,
      image: p.thumbnail_url,
      price: p.price_from_thb == null ? null : Number(p.price_from_thb),
      partner: true, // รูปเป็น URL เต็มของร้านพาร์ทเนอร์
      category: visibleCategory(p.category),
      href: p.partner?.integration === "maki_api" ? `/products/${p.external_slug}` : `/products?slug=${encodeURIComponent(p.external_slug)}`,
    })),
  ].slice(0, 8)

  return NextResponse.json({ items })
}
