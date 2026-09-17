import { prisma } from "@/lib/prisma"
import { requireUser } from "@/lib/requireUser"
import { setRequestLocale } from "next-intl/server"
import AccountFrame from "@/components/account/AccountFrame"
import CouponsClient from "./CouponsClient"

export const dynamic = "force-dynamic"

// คูปองของฉัน = โค้ดสาธารณะ (is_public) ที่ยังใช้ได้ตอนนี้ + ประวัติโค้ดที่ผู้ใช้เคยใช้
// โค้ดนายหน้า (owner_user_id) ไม่โชว์ — มันใช้ผ่านลิงก์ /r/<code> เท่านั้น
export default async function CouponsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  const { userId } = await requireUser(locale)
  const now = new Date()

  const [codes, redemptions] = await Promise.all([
    prisma.discount_codes.findMany({
      where: {
        is_active: true, is_public: true, owner_user_id: null,
        AND: [
          { OR: [{ expires_at: null }, { expires_at: { gt: now } }] },
          { OR: [{ starts_at: null }, { starts_at: { lte: now } }] },
        ],
      },
      include: {
        product: { select: { slug: true, name_th: true, name_en: true } },
        partner_product: { select: { external_slug: true, name_th: true, name_en: true } },
      },
      orderBy: [{ expires_at: "asc" }],
    }),
    prisma.discount_redemptions.findMany({
      where: { user_id: userId },
      include: {
        discount_codes: { select: { code: true } },
        orders: { select: { status: true, products: { select: { name_th: true, name_en: true } } } },
        // โค้ดที่ใช้กับเกมพาร์ทเนอร์ (Maki) ผูกกับ partner_order แทน orders
        partner_order: { select: { status: true, partner_product: { select: { name_th: true, name_en: true } } } },
      },
      orderBy: { redeemed_at: "desc" },
    }),
  ])

  const paidUsesOf = (codeId: string) =>
    redemptions.filter((r) => r.discount_code_id === codeId && (r.orders?.status ?? r.partner_order?.status) === "paid").length

  const coupons = codes.map((c) => ({
    id: c.id,
    code: c.code,
    type: c.type as "fixed" | "percent",
    value: Number(c.value),
    min_amount: c.min_amount != null ? Number(c.min_amount) : null,
    product: c.product
      ? { slug: c.product.slug, name_th: c.product.name_th, name_en: c.product.name_en }
      : c.partner_product
        ? { slug: c.partner_product.external_slug, name_th: c.partner_product.name_th, name_en: c.partner_product.name_en }
        : null,
    game_scope: (c.game_scope === "ours" || c.game_scope === "partner" ? c.game_scope : "all") as "all" | "ours" | "partner",
    expires_at: c.expires_at?.toISOString() ?? null,
    remaining: c.max_uses != null ? Math.max(0, c.max_uses - c.used_count) : null,
    used_by_me: paidUsesOf(c.id),
    per_user_limit: c.per_user_limit,
  }))

  const history = redemptions.map((r) => ({
    id: r.id,
    code: r.discount_codes.code,
    amount_off: Number(r.amount_off),
    redeemed_at: r.redeemed_at.toISOString(),
    status: r.orders?.status ?? r.partner_order?.status ?? "",
    product_th: r.orders?.products?.name_th ?? r.partner_order?.partner_product.name_th ?? "",
    product_en: r.orders?.products?.name_en ?? r.partner_order?.partner_product.name_en ?? "",
  }))

  return (
    <AccountFrame active="coupons">
      <CouponsClient coupons={coupons} history={history} />
    </AccountFrame>
  )
}
