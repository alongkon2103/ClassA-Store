// เกมในร้านมี 2 แบบ: เกมเรา (products) กับเกม Maki (partner_products) — หน้า /products/<slug> ใช้ร่วมกัน
// รีวิว / กดใจ / รายการโปรด / แต้มรีวิว เก็บในตารางเดียวกันโดยใช้คอลัมน์ product_id หรือ partner_product_id
import { prisma } from "@/lib/prisma"

export type GameRef = { kind: "product" | "partner"; id: string }

/** slug → เกมเรา หรือ เกม Maki (เฉพาะร้านที่ขายผ่าน Partner API) */
export async function gameBySlug(slug: string): Promise<GameRef | null> {
  const p = await prisma.products.findFirst({ where: { slug }, select: { id: true } })
  if (p) return { kind: "product", id: p.id }
  const pp = await prisma.partner_products.findFirst({ where: { external_slug: slug, partner: { integration: "maki_api" } }, select: { id: true } })
  return pp ? { kind: "partner", id: pp.id } : null
}

/** where ของแถวที่ผูกกับเกมนี้ (รีวิว/กดใจ/ledger) */
export const gameWhere = (g: GameRef) => (g.kind === "product" ? { product_id: g.id } : { partner_product_id: g.id })

/** unique key (เกม + ผู้ใช้) สำหรับ findUnique/upsert ของ product_reviews / product_favorites */
export const gameUserKey = (g: GameRef, userId: string) =>
  g.kind === "product"
    ? { product_id_user_id: { product_id: g.id, user_id: userId } }
    : { partner_product_id_user_id: { partner_product_id: g.id, user_id: userId } }

/** เคยซื้อและจ่ายแล้ว (รวมทดลองใช้ของเกมเรา — สิทธิ์เขียนรีวิวเหมือนเดิม) */
export async function hasPurchased(userId: string, g: GameRef): Promise<boolean> {
  const n = g.kind === "product"
    ? await prisma.orders.count({ where: { user_id: userId, product_id: g.id, status: "paid" } })
    : await prisma.partner_orders.count({ where: { user_id: userId, partner_product_id: g.id, status: "paid" } })
  return n > 0
}

/** เกมที่ "ซื้อจริง" (ไม่ใช่ทดลองใช้ ยอด > 0) — ใช้ตัดสินแต้มรีวิว คืนชุด id ที่ผ่าน */
export async function realPurchaseIds(userId: string, refs: GameRef[]): Promise<Set<string>> {
  const ours = refs.filter((r) => r.kind === "product").map((r) => r.id)
  const maki = refs.filter((r) => r.kind === "partner").map((r) => r.id)
  const [a, b] = await Promise.all([
    ours.length
      ? prisma.orders.findMany({ where: { user_id: userId, product_id: { in: ours }, status: "paid", order_type: { not: "TRIAL" }, amount: { gt: 0 } }, select: { product_id: true }, distinct: ["product_id"] })
      : Promise.resolve([]),
    maki.length
      ? prisma.partner_orders.findMany({ where: { user_id: userId, partner_product_id: { in: maki }, status: "paid", price_thb: { gt: 0 } }, select: { partner_product_id: true }, distinct: ["partner_product_id"] })
      : Promise.resolve([]),
  ])
  return new Set([...a.map((x) => x.product_id), ...b.map((x) => x.partner_product_id)])
}
