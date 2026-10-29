import { randomInt } from "node:crypto"
import type { Prisma, halloween_draws } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { isPlausibleUsername, lookupRobloxUser } from "@/lib/roblox"
import { HALLOWEEN_EVENT, HALLOWEEN_GAME_SLUGS, halloweenPhase, pickHalloweenPrize, type HalloweenDraw, type HalloweenGame, type HalloweenPrize, type HalloweenState } from "@/lib/halloweenEvent"

export class HalloweenError extends Error {
  constructor(public code: "upcoming" | "ended" | "unavailable" | "not_found" | "account_unavailable" | "ign_required" | "ign_invalid" | "ign_not_found" | "roblox_unavailable") { super(code) }
}
type Db = Prisma.TransactionClient
const key = (userId: string) => ({ event_key_user_id: { event_key: HALLOWEEN_EVENT.id, user_id: userId } })
const view = (row: halloween_draws): HalloweenDraw => ({
  id: row.id, prize: row.prize as HalloweenPrize, claimedAt: row.claimed_at?.toISOString() ?? null,
  result: row.result as HalloweenDraw["result"], orderId: row.order_id,
})

async function games(db: Db): Promise<HalloweenGame[]> {
  const rows = await db.products.findMany({
    where: { slug: { in: [...HALLOWEEN_GAME_SLUGS] }, is_active: true, type: { in: ["roblox_whitelist", "desktop_program"] } },
    select: { id: true, slug: true, name_th: true, name_en: true, type: true, product_images: { orderBy: [{ sort_order: "asc" }, { id: "asc" }], take: 1, select: { url: true } } },
  })
  return rows.map(({ product_images, ...row }) => ({ ...row, imageUrl: product_images[0]?.url ?? null }))
}
async function assertAccount(db: Db, userId: string) {
  const user = await db.users.findUnique({ where: { id: userId }, select: { nativeStatus: true } })
  if (!user || user.nativeStatus === "KICKED") throw new HalloweenError("account_unavailable")
}

export async function getHalloweenState(userId: string | null, now = new Date()): Promise<HalloweenState> {
  const [catalog, draw] = await Promise.all([games(prisma), userId ? prisma.halloween_draws.findUnique({ where: key(userId) }) : null])
  return {
    phase: halloweenPhase(now), signedIn: !!userId, available: catalog.length === 5,
    startsAt: HALLOWEEN_EVENT.startsAt, endsAt: HALLOWEEN_EVENT.endsAt, serverNow: now.toISOString(),
    games: catalog, draw: draw ? view(draw) : null,
  }
}

export async function drawHalloween(userId: string, now = new Date()): Promise<HalloweenDraw> {
  return prisma.$transaction(async tx => {
    // Same account lock as point redemption; database uniqueness is the final duplicate guard.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}))`
    await assertAccount(tx, userId)
    const existing = await tx.halloween_draws.findUnique({ where: key(userId) })
    if (existing) return view(existing)
    const phase = halloweenPhase(now)
    if (phase !== "active") throw new HalloweenError(phase)
    const catalog = await games(tx)
    if (catalog.length !== 5) throw new HalloweenError("unavailable")
    const prize = pickHalloweenPrize(catalog, randomInt(1500))
    const ledger = prize.kind === "points" ? await tx.point_ledger.create({
      data: { user_id: userId, delta: prize.amount, type: "earn_event", note: "Halloween 2026 · ฟักทองแจกโชค" },
    }) : null
    const draw = await tx.halloween_draws.create({ data: {
      event_key: HALLOWEEN_EVENT.id, user_id: userId, prize: prize as Prisma.InputJsonValue,
      ledger_id: ledger?.id ?? null, claimed_at: ledger ? now : null,
    } })
    return view(draw)
  }, { maxWait: 10000, timeout: 10000 })
}

export async function claimHalloween(userId: string, drawId: string, rawIgn: string | null, now = new Date()): Promise<HalloweenDraw> {
  const drawn = await prisma.halloween_draws.findFirst({ where: { id: drawId, user_id: userId, event_key: HALLOWEEN_EVENT.id } })
  if (!drawn) throw new HalloweenError("not_found")
  if (drawn.claimed_at) return view(drawn)
  const prize = drawn.prize as HalloweenPrize
  if (prize.kind !== "game") throw new HalloweenError("unavailable")
  let identity: { id: number; username: string; displayName: string } | null = null
  if (prize.product.type === "roblox_whitelist") {
    const ign = rawIgn?.trim() ?? ""
    if (!ign) throw new HalloweenError("ign_required")
    if (!isPlausibleUsername(ign)) throw new HalloweenError("ign_invalid")
    const lookup = await lookupRobloxUser(ign)
    if (!lookup.ok) throw new HalloweenError(lookup.reason === "network" ? "roblox_unavailable" : lookup.reason === "invalid" ? "ign_invalid" : "ign_not_found")
    identity = lookup.user
  }
  return prisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}))`
    await assertAccount(tx, userId)
    const current = await tx.halloween_draws.findUniqueOrThrow({ where: { id: drawId } })
    if (current.claimed_at) return view(current)
    const product = await tx.products.findUnique({ where: { id: prize.product.id }, select: { is_active: true, type: true } })
    if (!product?.is_active || product.type !== prize.product.type) throw new HalloweenError("unavailable")
    const ign = identity?.username ?? null
    // Different store accounts can claim into the same Roblox account; serialize that access too.
    const accessKey = `event-access:${prize.product.id}:${ign?.toLowerCase() ?? userId}`
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${accessKey}))`
    let granted: { expires_at: Date }[]
    const initialExpiry = new Date(now.getTime() + prize.days * 86400000)
    // Extend the value at write time: payment writers do not use the event advisory lock.
    if (product.type === "desktop_program") {
      granted = await tx.$queryRaw<{ expires_at: Date }[]>`
        INSERT INTO user_program_access (user_id, product_id, expires_at, status, updated_at)
        VALUES (${userId}::uuid, ${prize.product.id}::uuid, ${initialExpiry}, 'ACTIVE', ${now})
        ON CONFLICT (user_id, product_id) DO UPDATE SET
          expires_at = CASE WHEN user_program_access.expires_at >= timestamptz '9000-01-01'
            THEN user_program_access.expires_at ELSE GREATEST(user_program_access.expires_at, ${now}::timestamptz) + ${prize.days} * interval '1 day' END,
          status = CASE WHEN user_program_access.expires_at >= timestamptz '9000-01-01' THEN user_program_access.status ELSE 'ACTIVE' END,
          updated_at = ${now}
        RETURNING expires_at`
    } else {
      const access = await tx.user_whitelist_access.findFirst({ where: { product_id: prize.product.id, ign: { equals: ign!, mode: "insensitive" } }, orderBy: { expires_at: "desc" } })
      granted = await tx.$queryRaw<{ expires_at: Date }[]>`
        INSERT INTO user_whitelist_access (ign, product_id, expires_at, is_premium, updated_at)
        VALUES (${access?.ign ?? ign!}, ${prize.product.id}::uuid, ${initialExpiry}, false, ${now})
        ON CONFLICT (ign, product_id) DO UPDATE SET
          expires_at = CASE WHEN user_whitelist_access.expires_at >= timestamptz '9000-01-01'
            THEN user_whitelist_access.expires_at ELSE GREATEST(user_whitelist_access.expires_at, ${now}::timestamptz) + ${prize.days} * interval '1 day' END,
          updated_at = ${now}
        RETURNING expires_at`
    }
    const expiresAt = granted[0].expires_at
    const permanent = expiresAt.getUTCFullYear() >= 9000
    // A zero-value event order gives Orders and Tikkies a durable, attributable entitlement.
    const order = await tx.orders.create({ data: {
      user_id: userId, product_id: prize.product.id, amount: 0, goods_amount: 0, status: "paid", order_type: "EVENT",
      payment_method: "event", paid_at: now, fulfilled_at: now, expires_at: expiresAt,
      whitelist_status: "whitelisted", whitelisted_username: ign, manual_note: `Halloween reward ${drawId}`,
      ...(identity ? { roblox_user_id: String(identity.id), roblox_username: identity.username, roblox_display_name: identity.displayName, roblox_resolved_for: identity.username.toLowerCase() } : {}),
    } })
    const result = { expiresAt: expiresAt.toISOString(), ign, permanent }
    return view(await tx.halloween_draws.update({ where: { id: drawId }, data: { claimed_at: now, order_id: order.id, result } }))
  }, { maxWait: 10000, timeout: 10000 })
}
