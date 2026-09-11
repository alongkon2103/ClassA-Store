// ออเดอร์เกม Maki ที่เราขายเอง: สร้างลิงก์จ่าย → ลูกค้าจ่ายที่ Stripe ของ Maki → เรา poll สถานะ → paid = Maki ส่งสิทธิ์
// เข้าบัญชี Discord/Google ของลูกค้าแล้ว เราแค่บันทึกและให้ AC Points · ไม่มีคีย์ ไม่มี fulfillment ฝั่งเรา
import { randomUUID } from "crypto"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { MakiError, makiCreateOrder, makiGetOrder, makiListOrders, planAvailable, toPlanRows, withLiveMinimums, type MakiAccess, type MakiPlanRow } from "@/lib/maki"
import { awardPointsForPartnerOrder } from "@/lib/points"
import { capPartnerDiscount, countUserRedemptions, evaluateDiscount, releasePartnerOrderDiscount } from "@/lib/discountCodes"
import type { discount_codes } from "@prisma/client"

export type MakiCheckoutCode = "not_found" | "unavailable" | "no_identity" | "onboarding" | "below_min" | "maki_error" | "discount" // discount: message = DiscountErrorCode
export class MakiCheckoutError extends Error {
  constructor(public code: MakiCheckoutCode, message?: string) { super(message ?? code); this.name = "MakiCheckoutError" }
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXTAUTH_URL || ""

/** สร้างออเดอร์ + ขอลิงก์จ่ายจาก Maki — ถ้ามีออเดอร์ค้างของแพลนเดียวกันที่ยังไม่หมดอายุ ใช้ลิงก์เดิม */
export async function createMakiCheckout(input: { userId: string; provider: string | null | undefined; partnerProductId: string; planKey: string; locale: string; discountCode?: string | null }) {
  const row = await prisma.partner_products.findFirst({
    where: { id: input.partnerProductId, is_visible: true, coming_soon: false, partner: { is_active: true, integration: "maki_api" } },
  })
  if (!row) throw new MakiCheckoutError("not_found")
  const [live] = await withLiveMinimums([row])
  const plans: MakiPlanRow[] = toPlanRows(live.plans)
  const plan = plans.find((p) => p.key === input.planKey)
  if (!plan || !planAvailable(plan)) throw new MakiCheckoutError("unavailable")

  // บัญชีที่จะรับสิทธิ์ = provider ที่ล็อกอินอยู่ (ไม่มีค่อยหยิบ discord/google ที่ผูกไว้) — Maki ต้องการ id ตัวเลข ไม่ใช่ชื่อ/อีเมล
  const accounts = await prisma.accounts.findMany({
    where: { user_id: input.userId, provider: { in: ["discord", "google"] } },
    select: { provider: true, provider_account_id: true },
  })
  const acct = accounts.find((a) => a.provider === input.provider) ?? accounts[0]
  if (!acct) throw new MakiCheckoutError("no_identity")

  // โค้ดส่วนลดร้านเรา (เหมือนเกมเรา) — ตัดให้ราคาไม่ต่ำกว่าขั้นต่ำ Maki · โค้ดนายหน้าใช้ไม่ได้ (PARTNER_GAME)
  const sell = plan.sell_price_thb as number
  let codeRow: discount_codes | null = null
  let discount = 0
  if (input.discountCode?.trim()) {
    codeRow = await prisma.discount_codes.findUnique({ where: { code: input.discountCode.trim().toUpperCase() } })
    const used = codeRow ? await countUserRedemptions(prisma, codeRow.id, input.userId) : 0
    const ev = evaluateDiscount(codeRow, sell, `partner:${row.id}`, used, new Date(), { partner: true })
    if (!ev.ok) throw new MakiCheckoutError("discount", ev.errorCode)
    discount = capPartnerDiscount(ev.amountOff, sell, plan.min_price_thb)
    if (discount <= 0) throw new MakiCheckoutError("discount", "NO_EFFECT")
  }
  const finalPrice = Math.round((sell - discount) * 100) / 100

  const existing = await prisma.partner_orders.findFirst({
    where: {
      user_id: input.userId, plan_key: input.planKey, status: "pending", payment_url: { not: null },
      expires_at: { gt: new Date(Date.now() + 10 * 60_000) }, discount_code_id: codeRow?.id ?? null,
    },
    orderBy: { created_at: "desc" },
  })
  if (existing?.payment_url) return { id: existing.id, payment_url: existing.payment_url, reused: true }

  const id = randomUUID()
  const ref = `ACS-${id}`
  // จองสิทธิ์โค้ด + สร้างแถวใน transaction เดียว (atomic กันแย่งสิทธิ์ เหมือน checkout สินค้าเรา)
  await prisma.$transaction(async (tx) => {
    if (codeRow && discount > 0) {
      const reserved = await tx.discount_codes.updateMany({
        where: { id: codeRow.id, is_active: true, ...(codeRow.max_uses === null ? {} : { used_count: { lt: codeRow.max_uses } }) },
        data: { used_count: { increment: 1 } },
      })
      if (reserved.count === 0) throw new MakiCheckoutError("discount", "LIMIT_REACHED")
    }
    await tx.partner_orders.create({
      data: {
        id, partner_order_ref: ref, user_id: input.userId, partner_product_id: row.id, plan_key: plan.key,
        price_thb: finalPrice, min_price_thb: plan.min_price_thb,
        list_price_thb: discount > 0 ? sell : null, discount_code_id: codeRow && discount > 0 ? codeRow.id : null, discount_amount: discount > 0 ? discount : null,
        customer_provider: acct.provider, customer_id: acct.provider_account_id,
      },
    })
    if (codeRow && discount > 0) {
      await tx.discount_redemptions.create({ data: { discount_code_id: codeRow.id, partner_order_id: id, user_id: input.userId, amount_off: discount } })
    }
  })
  try {
    const prefix = input.locale === "en" ? "" : `/${input.locale}`
    const res = await makiCreateOrder({
      items: { [plan.key]: 1 },
      price_thb: finalPrice,
      customer: { provider: acct.provider as "discord" | "google", id: acct.provider_account_id },
      partner_order_ref: ref,
      ...(APP_URL ? { redirect_link: `${APP_URL}${prefix}/orders/maki/${id}` } : {}),
    })
    await prisma.partner_orders.update({
      where: { id },
      data: { maki_order_id: res.order_id, payment_url: res.payment_url, expires_at: res.expires_at ? new Date(res.expires_at) : null, status: res.status === "paid" ? "paid" : "pending" },
    })
    return { id, payment_url: res.payment_url, reused: false }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    // สร้างที่ Maki ไม่สำเร็จ → คืนสิทธิ์โค้ดแล้วมาร์ค failed
    await prisma.$transaction(async (tx) => {
      await releasePartnerOrderDiscount(tx, id)
      await tx.partner_orders.update({ where: { id }, data: { status: "failed", note: msg.slice(0, 500) } })
    }).catch(() => {})
    if (e instanceof MakiError) {
      if (e.status === 409) throw new MakiCheckoutError("onboarding", msg)
      if (e.status === 400 && /min/i.test(msg)) throw new MakiCheckoutError("below_min", msg)
    }
    throw new MakiCheckoutError("maki_error", msg)
  }
}

type Row = Prisma.partner_ordersGetPayload<Record<string, never>>

/** ถามสถานะจาก Maki แล้วอัปเดตของเรา — paid → บันทึก access + ให้ AC Points · Maki ล่มก็คงสถานะเดิม */
export async function syncMakiOrder(id: string): Promise<Row | null> {
  const row = await prisma.partner_orders.findUnique({ where: { id } })
  if (!row || !row.maki_order_id) return row
  const needAccess = row.status === "paid" && row.access == null
  if (row.status !== "pending" && !needAccess) return row
  let m
  try { m = await makiGetOrder(row.maki_order_id) } catch { return row }
  if (m.status === "paid") {
    const updated = await prisma.partner_orders.update({
      where: { id },
      data: {
        status: "paid",
        paid_at: row.paid_at ?? (m.stripe?.paid_at ? new Date(m.stripe.paid_at) : new Date()),
        ...(m.access ? { access: m.access as unknown as Prisma.InputJsonValue } : {}),
      },
    })
    await awardPointsForPartnerOrder(id)
    return updated
  }
  if (row.status !== "pending") return row
  // ลิงก์ตาย/ล้มเหลว → คืนสิทธิ์โค้ดส่วนลดด้วย (เหมือนออเดอร์สินค้าเราตอน expired)
  const close = (status: "expired" | "failed") => prisma.$transaction(async (tx) => {
    await releasePartnerOrderDiscount(tx, id)
    return tx.partner_orders.update({ where: { id }, data: { status } })
  })
  if (m.status === "expired" || m.status === "failed") return close(m.status)
  // ponytail: ถ้าเลยเวลาหมดอายุไป 1 ชม.แล้ว Maki ยังตอบ pending ถือว่าหมดอายุ กัน poll ค้างตลอดไป
  if (row.expires_at && row.expires_at.getTime() + 60 * 60_000 < Date.now()) return close("expired")
  return row
}

/** กวาดออเดอร์ค้าง (cron รายวัน / ตอนลูกค้าเปิดหน้าออเดอร์) เผื่อลูกค้าจ่ายแล้วปิดเบราว์เซอร์ก่อนกลับมา */
export async function syncPendingMakiOrders(opts?: { userId?: string; limit?: number }) {
  const rows = await prisma.partner_orders.findMany({
    where: { maki_order_id: { not: null }, OR: [{ status: "pending" }, { status: "paid", access: { equals: Prisma.DbNull } }], ...(opts?.userId ? { user_id: opts.userId } : {}) },
    select: { id: true }, orderBy: { created_at: "asc" }, take: opts?.limit ?? 100,
  })
  let paid = 0
  for (const r of rows) if ((await syncMakiOrder(r.id))?.status === "paid") paid++
  return { checked: rows.length, paid }
}

export type MakiOrderView = {
  id: string
  status: string
  plan_key: string
  plan: Pick<MakiPlanRow, "label_th" | "label_en" | "duration_days" | "is_lifetime"> | null
  price_thb: number
  list_price_thb: number | null // ราคาก่อนส่วนลด (null = ไม่มีส่วนลด)
  discount_amount: number | null
  customer_provider: string
  customer_id: string
  access: MakiAccess[] | null
  payment_url: string | null
  expires_at: string | null
  paid_at: string | null
  created_at: string
  product: { slug: string; name_th: string; name_en: string; image: string | null } | null
  preset_link: string | null
}
type ProductLite = { external_slug: string; name_th: string; name_en: string; thumbnail_url: string | null; images: unknown; plans: unknown } | null

export function toMakiOrderView(row: Row, product: ProductLite): MakiOrderView {
  const plan = product ? toPlanRows(product.plans).find((p) => p.key === row.plan_key) ?? null : null
  const images = Array.isArray(product?.images) ? (product!.images as string[]) : []
  return {
    id: row.id, status: row.status, plan_key: row.plan_key,
    plan: plan ? { label_th: plan.label_th, label_en: plan.label_en, duration_days: plan.duration_days, is_lifetime: plan.is_lifetime } : null,
    price_thb: Number(row.price_thb), list_price_thb: row.list_price_thb != null ? Number(row.list_price_thb) : null, discount_amount: row.discount_amount != null ? Number(row.discount_amount) : null,
    customer_provider: row.customer_provider, customer_id: row.customer_id,
    access: Array.isArray(row.access) ? (row.access as unknown as MakiAccess[]) : null,
    payment_url: row.status === "pending" ? row.payment_url : null,
    expires_at: row.expires_at?.toISOString() ?? null, paid_at: row.paid_at?.toISOString() ?? null, created_at: row.created_at.toISOString(),
    product: product ? { slug: product.external_slug, name_th: product.name_th, name_en: product.name_en, image: product.thumbnail_url ?? images[0] ?? null } : null,
    preset_link: plan?.preset_link ?? null,
  }
}

/**
 * เทียบกับรายการฝั่ง Maki (GET /orders 200 รายการล่าสุด) — ออเดอร์ที่ Maki บอกจ่ายแล้วแต่ของเรายังไม่ใช่ → sync ให้
 * (รวมแถวที่เคย failed ตอนบันทึกไม่สำเร็จแต่ Maki สร้างสำเร็จ) · ref ที่ไม่มีในระบบเราแจ้งให้แอดมินดู
 */
export async function reconcileWithMaki() {
  const { orders } = await makiListOrders({ limit: 200 })
  const ours = await prisma.partner_orders.findMany({
    where: { partner_order_ref: { in: orders.map((o) => o.partner_order_ref) } },
    select: { id: true, partner_order_ref: true, status: true, maki_order_id: true },
  })
  const byRef = new Map(ours.map((o) => [o.partner_order_ref, o]))
  let updated = 0
  const unknown: string[] = []
  for (const m of orders) {
    const o = byRef.get(m.partner_order_ref)
    if (!o) { unknown.push(m.partner_order_ref); continue }
    if (o.status === m.status) continue
    if (m.status === "paid" || (o.status === "pending" && (m.status === "expired" || m.status === "failed"))) {
      // ให้ syncMakiOrder เป็นคนอัปเดต (บันทึก access + ให้แต้ม) — เติม maki_order_id / ปลดสถานะ failed ก่อน
      await prisma.partner_orders.update({ where: { id: o.id }, data: { maki_order_id: o.maki_order_id ?? m.order_id, ...(o.status === "failed" ? { status: "pending", note: null } : {}) } })
      const r = await syncMakiOrder(o.id)
      if (r && r.status !== o.status) updated++
    }
  }
  const paid = orders.filter((o) => o.status === "paid")
  return {
    maki_count: orders.length, matched: orders.length - unknown.length, updated, unknown,
    maki_paid: paid.length,
    maki_sales: paid.reduce((n, o) => n + Number(o.price_thb), 0),
    maki_share: paid.reduce((n, o) => n + Number(o.price_thb) - Number(o.min_total_thb), 0),
  }
}
