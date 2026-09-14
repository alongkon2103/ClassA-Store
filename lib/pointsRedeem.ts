// แลก AC Points (เฟส 2, 2026-09-14) — ของรางวัล 3 แบบที่แอดมินตั้งในหน้า AC Points › ของรางวัล
//   discount_code : ออกโค้ดส่วนลดร้านให้คนแลก (โค้ดใหม่ต่อครั้ง ใช้ได้ครั้งเดียว มีวันหมดอายุ)
//   external_code : แจกโค้ดโปรแกรมอื่นจากคลังที่แอดมินวางไว้ ทีละโค้ด
//   game_days     : ต่อวันเกม A Class ที่ระบุ — เกม PC ต่อให้บัญชีผู้ใช้ · เกม Roblox ต่อให้ IGN ที่กรอก (ทางเดียวกับตอนจ่ายเงินซื้อ)
// การหักแต้ม = transaction เดียว ล็อกต่อผู้ใช้ (advisory lock) กันกดซ้ำ/หลายแท็บ · บันทึก point_ledger type "redeem" + point_redemptions
import type { Prisma } from "@prisma/client"
import { randomBytes } from "crypto"
import { prisma } from "@/lib/prisma"
import { notify } from "@/lib/notifications"
import { getPointsConfig, pointsActive } from "@/lib/points"
import { isPlausibleUsername, lookupRobloxUser } from "@/lib/roblox"

export type RewardKind = "discount_code" | "external_code" | "game_days"
export const REWARD_KINDS: RewardKind[] = ["discount_code", "external_code", "game_days"]
export type DiscountCfg = { type: "fixed" | "percent"; value: number; product_id: string | null; valid_days: number }
export type GameDaysCfg = { product_id: string; days: number }
export type RedeemResult =
  | { code: string; expires_at: string } // discount_code
  | { code: string } // external_code
  | { product_id: string; ign: string | null; expires_at: string } // game_days

export type RedeemErrorCode =
  | "disabled" | "not_found" | "insufficient" | "limit_reached" | "out_of_stock"
  | "ign_required" | "ign_invalid" | "ign_not_found" | "already_permanent" | "product_unavailable"
export class RedeemError extends Error {
  constructor(public code: RedeemErrorCode) { super(code) }
}

const isUuid = (s: unknown): s is string => typeof s === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)
const PERMANENT_YEAR = 9000 // orderFulfillment ใช้ 9999-12-31 แทน "ถาวร"
const isPermanent = (d: Date | null | undefined) => !!d && d.getUTCFullYear() >= PERMANENT_YEAR
const DAY_MS = 24 * 3600_000
// ตัวอักษรชุดเดียวกับโค้ดส่วนลดในหน้า admin (ไม่มี I/O/0/1)
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
const genCode = (len: number) => Array.from(randomBytes(len), (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("")

export const discountCfg = (c: unknown): DiscountCfg => c as DiscountCfg
export const gameDaysCfg = (c: unknown): GameDaysCfg => c as GameDaysCfg

/* ══ admin: ตรวจ body ตอนสร้าง/แก้ของรางวัล ══ */
export type RewardInput = {
  kind: RewardKind; title_th: string; title_en: string; description_th: string | null; description_en: string | null
  image_url: string | null; cost: number; config: Prisma.InputJsonValue; stock: number | null; per_user_limit: number | null
  is_active: boolean; sort_order: number
}
export function parseRewardInput(body: unknown): { data: RewardInput } | { error: string } {
  if (!body || typeof body !== "object") return { error: "invalid_body" }
  const b = body as Record<string, unknown>
  const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "")
  const kind = b.kind as RewardKind
  if (!REWARD_KINDS.includes(kind)) return { error: "invalid_kind" }
  const title_th = str(b.title_th, 120), title_en = str(b.title_en, 120)
  if (!title_th && !title_en) return { error: "title_required" }
  const cost = Number(b.cost)
  if (!Number.isInteger(cost) || cost < 1 || cost > 10_000_000) return { error: "invalid_cost" }
  const optInt = (v: unknown, min: number) => {
    if (v === null || v === undefined || v === "") return null
    const n = Number(v)
    return Number.isInteger(n) && n >= min ? n : undefined
  }
  const stock = optInt(b.stock, 0), per_user_limit = optInt(b.per_user_limit, 1)
  if (stock === undefined) return { error: "invalid_stock" }
  if (per_user_limit === undefined) return { error: "invalid_per_user_limit" }
  const image = str(b.image_url, 500)
  if (image && !/^(\/uploads\/|https?:\/\/)/.test(image)) return { error: "invalid_image" }
  const c = (b.config && typeof b.config === "object" ? b.config : {}) as Record<string, unknown>
  let config: Prisma.InputJsonValue
  if (kind === "discount_code") {
    const type = c.type === "percent" ? "percent" : c.type === "fixed" ? "fixed" : null
    const value = Number(c.value), valid_days = Number(c.valid_days)
    if (!type || !Number.isFinite(value) || value <= 0 || (type === "percent" && value > 100)) return { error: "invalid_discount" }
    if (!Number.isInteger(valid_days) || valid_days < 1 || valid_days > 365) return { error: "invalid_valid_days" }
    const product_id = c.product_id ? (isUuid(c.product_id) ? c.product_id : undefined) : null
    if (product_id === undefined) return { error: "invalid_product" }
    config = { type, value, product_id, valid_days }
  } else if (kind === "game_days") {
    const days = Number(c.days)
    if (!isUuid(c.product_id)) return { error: "invalid_product" }
    if (!Number.isInteger(days) || days < 1 || days > 3650) return { error: "invalid_days" }
    config = { product_id: c.product_id, days }
  } else config = {}
  return {
    data: {
      kind, title_th: title_th || title_en, title_en: title_en || title_th,
      description_th: str(b.description_th, 2000) || null, description_en: str(b.description_en, 2000) || null,
      image_url: image || null, cost, config, stock, per_user_limit,
      is_active: b.is_active !== false, sort_order: Number.isInteger(Number(b.sort_order)) ? Number(b.sort_order) : 0,
    },
  }
}

/** เกมที่ config อ้างถึงต้องเป็นเกม A Class ที่มีอยู่ (ไม่ใช่เกมพาร์ทเนอร์) */
export async function rewardProductError(input: RewardInput): Promise<string | null> {
  const id = input.kind === "game_days" ? gameDaysCfg(input.config).product_id : input.kind === "discount_code" ? discountCfg(input.config).product_id : null
  if (!id) return null
  const p = await prisma.products.findUnique({ where: { id }, select: { id: true } })
  return p ? null : "product_not_found"
}

/* ══ ฝั่งลูกค้า: รายการของรางวัล ══ */
export type RewardProduct = { id: string; name_th: string; name_en: string; type: string }
export type RewardView = {
  id: string; kind: RewardKind; title_th: string; title_en: string; description_th: string | null; description_en: string | null
  image_url: string | null; cost: number
  available: number | null // ที่เหลือให้แลก (null = ไม่จำกัด)
  per_user_limit: number | null; mine: number // จำนวนครั้งที่ผู้ใช้คนนี้แลกไปแล้ว
  product: RewardProduct | null // game_days: เกมที่ต่อวัน · discount_code: เกมที่โค้ดใช้ได้ (null = ทุกเกม)
  discount: { type: "fixed" | "percent"; value: number; valid_days: number } | null
  days: number | null
}

async function productsById(ids: string[]): Promise<Map<string, RewardProduct>> {
  const uniq = [...new Set(ids.filter(isUuid))]
  if (!uniq.length) return new Map()
  const rows = await prisma.products.findMany({ where: { id: { in: uniq } }, select: { id: true, name_th: true, name_en: true, type: true } })
  return new Map(rows.map((p) => [p.id, p]))
}
const cfgProductId = (kind: string, config: unknown): string | null =>
  kind === "game_days" ? gameDaysCfg(config).product_id : kind === "discount_code" ? discountCfg(config).product_id : null

export async function listRewards(userId: string | null): Promise<RewardView[]> {
  const rewards = await prisma.point_rewards.findMany({ where: { is_active: true }, orderBy: [{ sort_order: "asc" }, { created_at: "asc" }] })
  const ids = rewards.map((r) => r.id)
  const [codeLeft, mine, products] = await Promise.all([
    prisma.point_reward_codes.groupBy({ by: ["reward_id"], where: { reward_id: { in: ids }, redemption_id: null }, _count: { _all: true } }),
    userId ? prisma.point_redemptions.groupBy({ by: ["reward_id"], where: { user_id: userId, reward_id: { in: ids } }, _count: { _all: true } }) : Promise.resolve([]),
    productsById(rewards.map((r) => cfgProductId(r.kind, r.config)).filter((x): x is string => !!x)),
  ])
  const left = new Map(codeLeft.map((x) => [x.reward_id, x._count._all]))
  const mineMap = new Map(mine.map((x) => [x.reward_id, x._count._all]))
  return rewards.map((r) => {
    const kind = r.kind as RewardKind
    const pid = cfgProductId(kind, r.config)
    return {
      id: r.id, kind, title_th: r.title_th, title_en: r.title_en, description_th: r.description_th, description_en: r.description_en,
      image_url: r.image_url, cost: r.cost,
      available: kind === "external_code" ? left.get(r.id) ?? 0 : r.stock,
      per_user_limit: r.per_user_limit, mine: mineMap.get(r.id) ?? 0,
      product: pid ? products.get(pid) ?? null : null,
      discount: kind === "discount_code" ? (({ type, value, valid_days }) => ({ type, value, valid_days }))(discountCfg(r.config)) : null,
      days: kind === "game_days" ? gameDaysCfg(r.config).days : null,
    }
  })
}

/* ══ ประวัติการแลก ══ */
export type RedemptionView = { id: string; created_at: string; kind: RewardKind; cost: number; title_th: string; title_en: string; result: RedeemResult; product: RewardProduct | null }
export async function listRedemptions(userId: string, limit = 50): Promise<RedemptionView[]> {
  const rows = await prisma.point_redemptions.findMany({
    where: { user_id: userId }, orderBy: { created_at: "desc" }, take: limit,
    include: { reward: { select: { title_th: true, title_en: true } } },
  })
  const products = await productsById(rows.map((r) => (r.result as { product_id?: string }).product_id ?? ""))
  return rows.map((r) => ({
    id: r.id, created_at: r.created_at.toISOString(), kind: r.kind as RewardKind, cost: r.cost,
    title_th: r.reward.title_th, title_en: r.reward.title_en, result: r.result as RedeemResult,
    product: products.get((r.result as { product_id?: string }).product_id ?? "") ?? null,
  }))
}

/** IGN ล่าสุดที่ผู้ใช้เคยซื้อเกมนี้ — เติมให้ก่อนในช่องกรอก */
export async function latestIgn(userId: string, productId: string): Promise<string | null> {
  const o = await prisma.orders.findFirst({
    where: { user_id: userId, product_id: productId, whitelisted_username: { not: null } },
    orderBy: { created_at: "desc" }, select: { whitelisted_username: true },
  })
  return o?.whitelisted_username ?? null
}

/* ══ แลก ══ */
export async function redeemReward(input: { userId: string; rewardId: string; ign?: string | null }): Promise<{ redemption: RedemptionView; balance: number }> {
  const { userId, rewardId } = input
  const cfg = await getPointsConfig()
  if (!pointsActive(cfg)) throw new RedeemError("disabled")
  const reward = await prisma.point_rewards.findUnique({ where: { id: rewardId } })
  if (!reward || !reward.is_active) throw new RedeemError("not_found")
  const kind = reward.kind as RewardKind

  // game_days: ตรวจเกม + IGN ก่อนเข้า transaction (เรียก Roblox API นอก tx)
  let game: { product: RewardProduct; days: number; ign: string | null } | null = null
  if (kind === "game_days") {
    const c = gameDaysCfg(reward.config)
    const product = await prisma.products.findUnique({ where: { id: c.product_id }, select: { id: true, name_th: true, name_en: true, type: true, is_active: true } })
    if (!product || !product.is_active) throw new RedeemError("product_unavailable")
    let ign: string | null = null
    if (product.type !== "desktop_program") {
      ign = (input.ign ?? "").trim()
      if (!ign) throw new RedeemError("ign_required")
      if (!isPlausibleUsername(ign)) throw new RedeemError("ign_invalid")
      // ยืนยันกับ Roblox แบบ best-effort: ชื่อไม่มีจริง → ปฏิเสธ · Roblox ล่ม (network) → ให้ผ่าน ไม่ให้ระบบแลกล้มตาม
      const r = await lookupRobloxUser(ign)
      if (!r.ok && r.reason !== "network") throw new RedeemError(r.reason === "invalid" ? "ign_invalid" : "ign_not_found")
    }
    game = { product, days: c.days, ign }
  }
  // discount_code: สุ่มโค้ดนอก tx (ชนกันแล้ว INSERT พังจะ abort tx ทั้งก้อน) — โอกาสชน 32^8 ต่ำมาก แต่เช็คก่อน
  let discountCode: string | null = null
  if (kind === "discount_code") {
    for (let i = 0; i < 5 && !discountCode; i++) {
      const code = "ACP" + genCode(8)
      if (!(await prisma.discount_codes.findUnique({ where: { code }, select: { id: true } }))) discountCode = code
    }
    if (!discountCode) throw new Error("code_generation_failed")
  }

  const now = new Date()
  const { redemptionId, balanceAfter } = await prisma.$transaction(async (tx) => {
    // ล็อกต่อผู้ใช้: กดแลกพร้อมกันหลายแท็บ/หลายครั้ง → ต่อคิว แล้วเช็คยอดใหม่ทุกครั้ง
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}))`
    const agg = await tx.point_ledger.aggregate({ where: { user_id: userId }, _sum: { delta: true } })
    const balance = agg._sum.delta ?? 0
    if (balance < reward.cost) throw new RedeemError("insufficient")
    if (reward.per_user_limit != null) {
      const n = await tx.point_redemptions.count({ where: { user_id: userId, reward_id: reward.id } })
      if (n >= reward.per_user_limit) throw new RedeemError("limit_reached")
    }
    // สต็อก: หักแบบ atomic (เฉพาะแถวที่ยังเปิดและเหลือ > 0)
    const gate = reward.stock != null
      ? await tx.point_rewards.updateMany({ where: { id: reward.id, is_active: true, stock: { gt: 0 } }, data: { stock: { decrement: 1 } } })
      : await tx.point_rewards.updateMany({ where: { id: reward.id, is_active: true }, data: { updated_at: reward.updated_at } })
    if (gate.count !== 1) throw new RedeemError(reward.stock != null ? "out_of_stock" : "not_found")

    const ledger = await tx.point_ledger.create({ data: { user_id: userId, delta: -reward.cost, type: "redeem", note: reward.title_th } })
    const red = await tx.point_redemptions.create({ data: { user_id: userId, reward_id: reward.id, kind, cost: reward.cost, result: {}, ledger_id: ledger.id } })

    let result: RedeemResult
    if (kind === "discount_code") {
      const c = discountCfg(reward.config)
      const expires_at = new Date(now.getTime() + c.valid_days * DAY_MS)
      await tx.discount_codes.create({
        data: {
          code: discountCode!, type: c.type, value: c.value, max_uses: 1, per_user_limit: 1, product_id: c.product_id,
          expires_at, is_active: true, is_public: false, note: `AC Points redeem ${red.id}`,
        },
      })
      result = { code: discountCode!, expires_at: expires_at.toISOString() }
    } else if (kind === "external_code") {
      const rows = await tx.$queryRaw<{ code: string }[]>`
        UPDATE point_reward_codes SET redemption_id = ${red.id}::uuid
        WHERE id = (SELECT id FROM point_reward_codes WHERE reward_id = ${reward.id}::uuid AND redemption_id IS NULL ORDER BY created_at LIMIT 1 FOR UPDATE SKIP LOCKED)
        RETURNING code`
      if (!rows.length) throw new RedeemError("out_of_stock")
      result = { code: rows[0].code }
    } else {
      const g = game!
      const add = g.days * DAY_MS
      if (g.product.type === "desktop_program") {
        const cur = await tx.user_program_access.findUnique({ where: { user_id_product_id: { user_id: userId, product_id: g.product.id } } })
        if (isPermanent(cur?.expires_at)) throw new RedeemError("already_permanent")
        const base = cur && cur.expires_at > now ? cur.expires_at : now
        const expires_at = new Date(base.getTime() + add)
        await tx.user_program_access.upsert({
          where: { user_id_product_id: { user_id: userId, product_id: g.product.id } },
          create: { user_id: userId, product_id: g.product.id, expires_at, status: "ACTIVE" },
          update: { expires_at, status: "ACTIVE", updated_at: now },
        })
        result = { product_id: g.product.id, ign: null, expires_at: expires_at.toISOString() }
      } else {
        const ign = g.ign!
        const cur = await tx.user_whitelist_access.findUnique({ where: { ign_product_id: { ign, product_id: g.product.id } } })
        if (isPermanent(cur?.expires_at)) throw new RedeemError("already_permanent")
        const base = cur && cur.expires_at > now ? cur.expires_at : now
        const expires_at = new Date(base.getTime() + add)
        await tx.user_whitelist_access.upsert({
          where: { ign_product_id: { ign, product_id: g.product.id } },
          create: { ign, product_id: g.product.id, is_premium: false, expires_at },
          update: { expires_at, updated_at: now },
        })
        result = { product_id: g.product.id, ign, expires_at: expires_at.toISOString() }
      }
    }
    await tx.point_redemptions.update({ where: { id: red.id }, data: { result } })
    return { redemptionId: red.id, balanceAfter: balance - reward.cost }
  })

  await notify({ userId, type: "points_redeemed", data: { points: reward.cost, title: reward.title_th }, link: "/account/redeem" })
  const [redemption] = await listRedemptions(userId, 1)
  return { redemption: redemption.id === redemptionId ? redemption : (await listRedemptions(userId, 20)).find((r) => r.id === redemptionId)!, balance: balanceAfter }
}

/* ══ admin ══ */
export type AdminRewardRow = Awaited<ReturnType<typeof adminListRewards>>[number]
export async function adminListRewards() {
  const rewards = await prisma.point_rewards.findMany({
    orderBy: [{ sort_order: "asc" }, { created_at: "asc" }],
    include: { _count: { select: { redemptions: true, codes: true } } },
  })
  const [left, products] = await Promise.all([
    prisma.point_reward_codes.groupBy({ by: ["reward_id"], where: { redemption_id: null }, _count: { _all: true } }),
    productsById(rewards.map((r) => cfgProductId(r.kind, r.config)).filter((x): x is string => !!x)),
  ])
  const leftMap = new Map(left.map((x) => [x.reward_id, x._count._all]))
  return rewards.map((r) => {
    const pid = cfgProductId(r.kind, r.config)
    return {
      id: r.id, kind: r.kind as RewardKind, title_th: r.title_th, title_en: r.title_en, description_th: r.description_th, description_en: r.description_en,
      image_url: r.image_url, cost: r.cost, config: r.config as Record<string, unknown>, stock: r.stock, per_user_limit: r.per_user_limit,
      is_active: r.is_active, sort_order: r.sort_order, created_at: r.created_at.toISOString(),
      redemptions: r._count.redemptions, codes_total: r._count.codes, codes_left: leftMap.get(r.id) ?? 0,
      product: pid ? products.get(pid) ?? null : null,
    }
  })
}

/** วางโค้ดหลายบรรทัด → เก็บเฉพาะที่ยังไม่มี (ซ้ำในคลังเดิมข้าม) */
export async function adminAddCodes(rewardId: string, raw: string): Promise<{ added: number; skipped: number }> {
  const codes = [...new Set(raw.split(/[\r\n,;]+/).map((s) => s.trim()).filter((s) => s.length > 0 && s.length <= 200))]
  if (!codes.length) return { added: 0, skipped: 0 }
  const r = await prisma.point_reward_codes.createMany({ data: codes.map((code) => ({ reward_id: rewardId, code })), skipDuplicates: true })
  return { added: r.count, skipped: codes.length - r.count }
}

/** ลบของรางวัล — มีประวัติแลกแล้วลบไม่ได้ (FK Restrict) ให้ปิดแทน */
export async function adminDeleteReward(id: string): Promise<"ok" | "has_redemptions" | "not_found"> {
  const n = await prisma.point_redemptions.count({ where: { reward_id: id } })
  if (n > 0) return "has_redemptions"
  const r = await prisma.point_rewards.deleteMany({ where: { id } })
  return r.count ? "ok" : "not_found"
}
