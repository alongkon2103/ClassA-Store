import { prisma } from "@/lib/prisma"
/**
 * โค้ดผูกเกม Maki: เลือกได้อย่างเดียว (เกมเรา หรือ เกม Maki) · ต้องเป็นเกม Maki จริง
 * · โค้ดนายหน้า (มีเจ้าของ) ผูกเกม Maki ไม่ได้ — ตอนจ่ายจะถูกปฏิเสธอยู่แล้ว (PARTNER_GAME)
 * ใช้ทั้ง POST (route.ts) และ PATCH ([id]/route.ts) — แยกไฟล์เพราะ route.ts export ได้เฉพาะ handler
 */
export async function checkPartnerScope(productId: string | null, partnerProductId: string | null, ownerUserId: string | null, gameScope: string = "all", productIds: string[] = []): Promise<string | null> {
  if (productIds.length) {
    if (productId || partnerProductId) return "Choose a game list or a single game, not both"
    if (gameScope === "partner") return "Selected games cannot use the Maki group scope"
    const count = await prisma.products.count({ where: { id: { in: productIds } } })
    if (count !== productIds.length) return "Selected game not found"
  }
  // ขอบเขต "ทุกเกมของ Maki" กับโค้ดนายหน้า: ใช้ไม่ได้เหมือนกัน (ตอนจ่ายถูกปฏิเสธ PARTNER_GAME)
  if (gameScope === "partner" && ownerUserId) return "Affiliate codes can't be limited to Maki games"
  if (!partnerProductId) return null
  if (productId) return "Choose either one of our games or a Maki game, not both"
  if (ownerUserId) return "Affiliate codes can't be limited to a Maki game"
  const ok = await prisma.partner_products.findFirst({ where: { id: partnerProductId, partner: { integration: "maki_api" } }, select: { id: true } })
  return ok ? null : "Maki game not found"
}
