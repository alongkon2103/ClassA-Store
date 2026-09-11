// AC Points เฟส 1: "ได้แต้มจากการซื้อ" เก็บเป็นสมุดบัญชี (point_ledger) ไว้ก่อน ระบบแลกค่อยต่อยอดทีหลัง
//
// กติกา (ตกลงกับเจ้าของร้าน 2026-09-10)
// · ฿100 ของราคาเกม = 1,000 แต้ม (points_per_baht = 10, แก้ได้ใน admin) ปัดเศษลง
// · คิดจากราคาเกมหลังหักส่วนลด "ไม่รวมค่าธรรมเนียมการชำระเงิน" → ใช้ orders.goods_amount (ถ้าไม่มีใช้ amount
//   ซึ่งเป็นช่องทางที่ไม่มีค่าธรรมเนียม เช่น สลิป/PromptPay)
// · ไม่ย้อนหลัง — นับเฉพาะออเดอร์ที่จ่ายหลัง points_start_at เท่านั้น
// · ออเดอร์ทดลองใช้ (TRIAL), ยอด ฿0, หรือไม่มี user_id (แอดมินบันทึกเอง) ไม่ได้แต้ม
// · ให้แต้มซ้ำไม่ได้: unique (order_id, type) → เรียก awardPointsForOrder ซ้ำจากทุกทางที่ออเดอร์กลายเป็น paid ได้ปลอดภัย
// · ยอดคงเหลือ = SUM(delta) ไม่เก็บซ้ำในตาราง users
import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { notify } from "@/lib/notifications"

export const POINTS_CONFIG_KEYS = {
  enabled: "points_enabled",
  perBaht: "points_per_baht",
  startAt: "points_start_at",
} as const
export const POINTS_DEFAULT_PER_BAHT = 10

export type PointsConfig = { enabled: boolean; perBaht: number; startAt: Date | null }
export type LedgerType = "earn_purchase" | "reverse_purchase" | "adjust_admin"

type Db = Prisma.TransactionClient | typeof prisma

// อ่านสดจาก system_configs ทุกครั้ง (เหมือน featureFlags) — แอดมินเปิด/ปิดแล้วมีผลทันที
export async function getPointsConfig(db: Db = prisma): Promise<PointsConfig> {
  const rows = await db.system_configs.findMany({ where: { key: { in: Object.values(POINTS_CONFIG_KEYS) } } })
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]))
  const perBaht = Number(map[POINTS_CONFIG_KEYS.perBaht])
  const startRaw = map[POINTS_CONFIG_KEYS.startAt]
  const startAt = startRaw ? new Date(startRaw) : null
  return {
    enabled: map[POINTS_CONFIG_KEYS.enabled] === "true",
    perBaht: Number.isFinite(perBaht) && perBaht > 0 ? perBaht : POINTS_DEFAULT_PER_BAHT,
    startAt: startAt && !Number.isNaN(startAt.getTime()) ? startAt : null,
  }
}

/** ระบบ "นับแต้มอยู่" = เปิดใช้และตั้งวันเริ่มแล้ว */
export const pointsActive = (cfg: PointsConfig) => cfg.enabled && cfg.startAt != null

export function pointsForAmount(baseThb: number, perBaht: number): number {
  if (!Number.isFinite(baseThb) || baseThb <= 0) return 0
  return Math.floor(baseThb * perBaht)
}

/** ยอดที่ใช้คิดแต้ม: ราคาสินค้าหลังส่วนลด ไม่รวมค่าธรรมเนียม */
export function orderPointsBase(o: {
  amount: Prisma.Decimal | number | string
  goods_amount?: Prisma.Decimal | number | string | null
}): number {
  const goods = o.goods_amount != null ? Number(o.goods_amount) : NaN
  return Number.isFinite(goods) ? goods : Number(o.amount)
}

type OrderForPoints = {
  id: string
  user_id: string | null
  status: string
  order_type: string
  amount: Prisma.Decimal
  goods_amount: Prisma.Decimal | null
  paid_at: Date | null
  created_at: Date | null
}

const ORDER_SELECT = {
  id: true, user_id: true, status: true, order_type: true, amount: true, goods_amount: true, paid_at: true, created_at: true,
} satisfies Prisma.ordersSelect

type Eligibility = { ok: true; base: number; points: number } | { ok: false; reason: string }

export function orderEligibility(order: OrderForPoints, cfg: PointsConfig): Eligibility {
  if (!pointsActive(cfg)) return { ok: false, reason: "disabled" }
  if (!order.user_id) return { ok: false, reason: "no_user" }
  if (order.status !== "paid") return { ok: false, reason: "not_paid" }
  if (order.order_type === "TRIAL") return { ok: false, reason: "trial" }
  const paidAt = order.paid_at ?? order.created_at
  if (!paidAt || paidAt < cfg.startAt!) return { ok: false, reason: "before_start" }
  const base = orderPointsBase(order)
  const points = pointsForAmount(base, cfg.perBaht)
  if (points <= 0) return { ok: false, reason: "zero" }
  return { ok: true, base, points }
}

/**
 * ให้แต้มกับออเดอร์ที่จ่ายสำเร็จ — best-effort (ไม่ throw ออกไปทำให้การจ่ายเงินล้ม) และทำซ้ำได้
 * คืน null เมื่อไม่เข้าเงื่อนไข, { created:false } เมื่อเคยให้ไปแล้ว
 */
export async function awardPointsForOrder(orderId: string, opts?: { silent?: boolean }): Promise<{ points: number; created: boolean } | null> {
  try {
    const cfg = await getPointsConfig()
    if (!pointsActive(cfg)) return null
    const order = await prisma.orders.findUnique({ where: { id: orderId }, select: ORDER_SELECT })
    if (!order) return null
    const e = orderEligibility(order, cfg)
    if (!e.ok) return null
    try {
      await prisma.point_ledger.create({
        data: { user_id: order.user_id!, delta: e.points, type: "earn_purchase", order_id: order.id, base_amount: e.base },
      })
    } catch (err) {
      if ((err as { code?: string })?.code === "P2002") return { points: e.points, created: false } // เคยให้แล้ว
      throw err
    }
    if (!opts?.silent) {
      await notify({ userId: order.user_id!, type: "points_earned", data: { points: e.points, order_id: order.id }, link: "/account/coins" })
    }
    return { points: e.points, created: true }
  } catch (err) {
    console.error("awardPointsForOrder failed (non-fatal):", err)
    return null
  }
}

/**
 * ให้แต้มออเดอร์เกมพาร์ทเนอร์ (Maki) ที่ Maki ยืนยันว่าจ่ายแล้ว — ลูกค้าจ่ายเท่าราคาขายเราพอดี ไม่มีค่าธรรมเนียมบวก
 * จึงคิดจาก price_thb ทั้งก้อน · กติกา/กันซ้ำเหมือน awardPointsForOrder (unique partner_order_id+type)
 */
export async function awardPointsForPartnerOrder(partnerOrderId: string, opts?: { silent?: boolean }): Promise<{ points: number; created: boolean } | null> {
  try {
    const cfg = await getPointsConfig()
    if (!pointsActive(cfg)) return null
    const o = await prisma.partner_orders.findUnique({ where: { id: partnerOrderId }, select: { id: true, user_id: true, status: true, price_thb: true, paid_at: true, created_at: true } })
    if (!o || o.status !== "paid") return null
    const paidAt = o.paid_at ?? o.created_at
    if (paidAt < cfg.startAt!) return null
    const base = Number(o.price_thb)
    const points = pointsForAmount(base, cfg.perBaht)
    if (points <= 0) return null
    try {
      await prisma.point_ledger.create({ data: { user_id: o.user_id, delta: points, type: "earn_purchase", partner_order_id: o.id, base_amount: base } })
    } catch (err) {
      if ((err as { code?: string })?.code === "P2002") return { points, created: false }
      throw err
    }
    if (!opts?.silent) await notify({ userId: o.user_id, type: "points_earned", data: { points, partner_order_id: o.id }, link: "/account/coins" })
    return { points, created: true }
  } catch (err) {
    console.error("awardPointsForPartnerOrder failed (non-fatal):", err)
    return null
  }
}

/** ออเดอร์ถูกยกเลิก/คืนเงินหลังได้แต้มไปแล้ว → หักคืนเท่าที่เคยให้ (ทำซ้ำได้ ไม่หักซ้ำ) คืนจำนวนที่หัก */
export async function reversePointsForOrder(orderId: string, db: Db = prisma): Promise<number> {
  const rows = await db.point_ledger.findMany({ where: { order_id: orderId, type: { in: ["earn_purchase", "reverse_purchase"] } } })
  const earn = rows.find((r) => r.type === "earn_purchase")
  if (!earn || rows.some((r) => r.type === "reverse_purchase")) return 0
  await db.point_ledger.create({
    data: { user_id: earn.user_id, delta: -earn.delta, type: "reverse_purchase", order_id: orderId, base_amount: earn.base_amount, note: "order cancelled" },
  })
  return earn.delta
}

export async function getPointsBalance(userId: string, db: Db = prisma): Promise<number> {
  const agg = await db.point_ledger.aggregate({ where: { user_id: userId }, _sum: { delta: true } })
  return agg._sum.delta ?? 0
}

// เงื่อนไขค้นหา "ออเดอร์จ่ายแล้วหลังวันเริ่ม ที่ยังไม่ได้แต้ม" ใช้ทั้ง reconcile รายคนและทั้งร้าน
function missingPointsWhere(startAt: Date, userId?: string): Prisma.ordersWhereInput {
  return {
    ...(userId ? { user_id: userId } : { user_id: { not: null } }),
    status: "paid",
    order_type: { not: "TRIAL" },
    OR: [{ paid_at: { gte: startAt } }, { paid_at: null, created_at: { gte: startAt } }],
    point_ledger: { none: { type: "earn_purchase" } },
  }
}

/** safety net: กวาดออเดอร์ของผู้ใช้คนนี้ที่จ่ายแล้วแต่ยังไม่ได้แต้ม (เผื่อทางไหนหลุด) คืนจำนวนที่เพิ่งให้ */
export async function reconcileUserPoints(userId: string): Promise<number> {
  const cfg = await getPointsConfig()
  if (!pointsActive(cfg)) return 0
  const [orders, partnerOrders] = await Promise.all([
    prisma.orders.findMany({ where: missingPointsWhere(cfg.startAt!, userId), select: { id: true }, take: 50 }),
    prisma.partner_orders.findMany({ where: missingPartnerPointsWhere(cfg.startAt!, userId), select: { id: true }, take: 50 }),
  ])
  let n = 0
  for (const o of orders) if ((await awardPointsForOrder(o.id))?.created) n++
  for (const o of partnerOrders) if ((await awardPointsForPartnerOrder(o.id))?.created) n++
  return n
}

// ออเดอร์ Maki ที่จ่ายแล้วหลังวันเริ่ม แต่ยังไม่ได้แต้ม
function missingPartnerPointsWhere(startAt: Date, userId?: string): Prisma.partner_ordersWhereInput {
  return {
    ...(userId ? { user_id: userId } : {}),
    status: "paid",
    OR: [{ paid_at: { gte: startAt } }, { paid_at: null, created_at: { gte: startAt } }],
    point_ledger: { none: { type: "earn_purchase" } },
  }
}

/** แอดมินกดจากหน้า AC Points: กวาดทั้งร้าน (ครั้งละไม่เกิน 500 ออเดอร์) */
export async function reconcileAllPoints(): Promise<{ awarded: number; scanned: number }> {
  const cfg = await getPointsConfig()
  if (!pointsActive(cfg)) return { awarded: 0, scanned: 0 }
  const [orders, partnerOrders] = await Promise.all([
    prisma.orders.findMany({ where: missingPointsWhere(cfg.startAt!), select: { id: true }, take: 500, orderBy: { paid_at: "asc" } }),
    prisma.partner_orders.findMany({ where: missingPartnerPointsWhere(cfg.startAt!), select: { id: true }, take: 500, orderBy: { paid_at: "asc" } }),
  ])
  let awarded = 0
  for (const o of orders) if ((await awardPointsForOrder(o.id))?.created) awarded++
  for (const o of partnerOrders) if ((await awardPointsForPartnerOrder(o.id))?.created) awarded++
  return { awarded, scanned: orders.length + partnerOrders.length }
}

export type LedgerEntry = {
  id: string
  delta: number
  type: string
  note: string | null
  created_at: string
  order: { id: string; product_th: string; product_en: string } | null
}

export type PointsSummary = { balance: number; perBaht: number; active: boolean; entries: LedgerEntry[] }

/** ยอด + ประวัติสำหรับหน้าบัญชี — ระหว่างนี้กวาดออเดอร์ที่ยังไม่ได้แต้มให้ด้วย (reconcile) */
export async function getPointsSummary(userId: string, opts?: { reconcile?: boolean; entries?: number }): Promise<PointsSummary> {
  if (opts?.reconcile !== false) await reconcileUserPoints(userId).catch(() => 0)
  const limit = opts?.entries ?? 100
  const [cfg, balance, rows] = await Promise.all([
    getPointsConfig(),
    getPointsBalance(userId),
    limit > 0
      ? prisma.point_ledger.findMany({
          where: { user_id: userId },
          orderBy: { created_at: "desc" },
          take: limit,
          include: {
            order: { select: { id: true, products: { select: { name_th: true, name_en: true } } } },
            partner_order: { select: { id: true, partner_product: { select: { name_th: true, name_en: true } } } },
          },
        })
      : Promise.resolve([]),
  ])
  return {
    balance,
    perBaht: cfg.perBaht,
    active: pointsActive(cfg),
    entries: rows.map((r) => ({
      id: r.id,
      delta: r.delta,
      type: r.type,
      note: r.note,
      created_at: r.created_at.toISOString(),
      order: r.order
        ? { id: r.order.id, product_th: r.order.products.name_th, product_en: r.order.products.name_en }
        : r.partner_order
          ? { id: r.partner_order.id, product_th: r.partner_order.partner_product.name_th, product_en: r.partner_order.partner_product.name_en }
          : null,
    })),
  }
}

/** แอดมินปรับแต้มเอง (+ เพิ่ม / − หัก) พร้อมเหตุผล — บันทึกเป็น adjust_admin และแจ้งเตือนลูกค้า */
export async function adminAdjustPoints(input: { userId: string; delta: number; note: string; adminId: string }) {
  if (!Number.isInteger(input.delta) || input.delta === 0) throw new Error("invalid_delta")
  const row = await prisma.point_ledger.create({
    data: { user_id: input.userId, delta: input.delta, type: "adjust_admin", note: input.note.trim() || null, created_by: input.adminId },
  })
  await notify({ userId: input.userId, type: "points_adjusted", data: { points: input.delta }, link: "/account/coins" })
  return row
}

/** แอดมิน "ตั้งยอด" ให้เท่ากับค่าที่กำหนด — คำนวณส่วนต่างในทรานแซกชันกันชนกัน คืน delta ที่บันทึก (0 = ยอดเท่าเดิม) */
export async function adminSetPoints(input: { userId: string; balance: number; note: string; adminId: string }): Promise<number> {
  if (!Number.isInteger(input.balance) || input.balance < 0) throw new Error("invalid_balance")
  const delta = await prisma.$transaction(async (tx) => {
    const current = await getPointsBalance(input.userId, tx)
    const d = input.balance - current
    if (d === 0) return 0
    await tx.point_ledger.create({
      data: { user_id: input.userId, delta: d, type: "adjust_admin", note: input.note.trim() || null, created_by: input.adminId },
    })
    return d
  })
  if (delta !== 0) await notify({ userId: input.userId, type: "points_adjusted", data: { points: delta }, link: "/account/coins" })
  return delta
}

/**
 * ยกเลิกรายการที่แอดมินปรับผิด — ไม่ลบแถวเดิม (เก็บร่องรอย) แต่สร้างรายการกลับค่าที่ชี้ reverses_id
 * unique(reverses_id) ทำให้ยกเลิกซ้ำไม่ได้ · ยกเลิกได้เฉพาะ adjust_admin ที่ไม่ใช่รายการยกเลิกเอง
 * (แต้มจากการซื้อให้ยกเลิกผ่านการเปลี่ยนสถานะออเดอร์แทน)
 */
export async function adminVoidEntry(input: { entryId: string; adminId: string; note?: string }): Promise<{ delta: number; userId: string }> {
  const entry = await prisma.point_ledger.findUnique({ where: { id: input.entryId } })
  if (!entry) throw new Error("not_found")
  if (entry.type !== "adjust_admin" || entry.reverses_id) throw new Error("void_not_allowed")
  try {
    await prisma.point_ledger.create({
      data: {
        user_id: entry.user_id, delta: -entry.delta, type: "adjust_admin", created_by: input.adminId, reverses_id: entry.id,
        note: (input.note?.trim() || `ยกเลิกรายการ: ${entry.note ?? entry.id.slice(0, 8)}`).slice(0, 200),
      },
    })
  } catch (err) {
    if ((err as { code?: string })?.code === "P2002") throw new Error("already_voided")
    throw err
  }
  await notify({ userId: entry.user_id, type: "points_adjusted", data: { points: -entry.delta }, link: "/account/coins" })
  return { delta: -entry.delta, userId: entry.user_id }
}
