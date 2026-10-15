import type { Prisma } from "@prisma/client"

export type Identity = { provider: "google" | "discord"; providerAccountId: string }
export class TikkiesError extends Error {
  constructor(public code: string, public status: number) { super(code) }
}
const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v)
export function parseIdentities(body: unknown): Identity[] {
  if (!isRecord(body) || Object.keys(body).some(k => k !== "identities") || !Array.isArray(body.identities) || body.identities.length < 1 || body.identities.length > 10) throw new TikkiesError("invalid_input", 400)
  const identities: Identity[] = []
  for (const item of body.identities) {
    if (!isRecord(item) || Object.keys(item).some(k => !["provider", "providerAccountId"].includes(k)) || typeof item.provider !== "string" || !["google", "discord"].includes(item.provider) || typeof item.providerAccountId !== "string" || !/^[A-Za-z0-9._:-]{1,255}$/.test(item.providerAccountId)) throw new TikkiesError("invalid_input", 400)
    identities.push({ provider: item.provider as Identity["provider"], providerAccountId: item.providerAccountId })
  }
  return identities.filter((x, i) => identities.findIndex(y => y.provider === x.provider && y.providerAccountId === x.providerAccountId) === i)
}
export type TikkiesOrder = {
  id: string; product_id: string; status: string; whitelist_status: string | null; whitelisted_username: string | null
  paid_at: Date | null; expires_at: Date | null; tikkies_revision: number; tikkies_updated_at: Date
  roblox_user_id: string | null; roblox_username: string | null; roblox_display_name: string | null; roblox_resolved_for: string | null
  products: { id: string; name_en: string; type: string; roblox_universe_id: string | null; roblox_place_ids: string[] }
}
export type Whitelist = { ign: string; product_id: string; expires_at: Date }
export type EntitlementStatus = "active" | "pending" | "expired" | "revoked" | "refunded" | "account_unresolved"
const normalized = (name: string | null) => name?.trim().toLowerCase() ?? ""
const permanent = (d: Date | null) => d === null || d.getUTCFullYear() >= 9000
const idString = (s: string | null): s is string => !!s && /^[1-9][0-9]{0,31}$/.test(s)

export function evaluateTikkiesEntitlement(order: TikkiesOrder, access: Whitelist | null, now: Date, ownRewardExpiry?: Date) {
  let orderExpiry = order.expires_at
  if (ownRewardExpiry && !permanent(orderExpiry) && ownRewardExpiry > orderExpiry!) orderExpiry = ownRewardExpiry
  const dates = [orderExpiry, access?.expires_at ?? null].filter((x): x is Date => !permanent(x))
  const expiry = dates.length ? new Date(Math.min(...dates.map(x => x.getTime()))) : null
  const expired = !!expiry && expiry <= now
  let status: EntitlementStatus = "pending"
  let reason: string | null = null
  if (order.status === "refunded") status = "refunded"
  else if (["cancelled", "revoked", "disputed"].includes(order.status) || ["removed", "revoked", "suspended"].includes(order.whitelist_status ?? "")) status = "revoked"
  else if (order.status === "expired" || order.whitelist_status === "expired") status = "expired"
  else if (!["paid", "Admin Buy"].includes(order.status) || !order.paid_at || order.whitelist_status !== "whitelisted") status = "pending"
  else if (!access || access.product_id !== order.product_id || normalized(access.ign) !== normalized(order.whitelisted_username)) status = "revoked"
  else if (expired) status = "expired"
  else if (!idString(order.roblox_user_id) || normalized(order.roblox_resolved_for) !== normalized(order.whitelisted_username) || !order.roblox_username) { status = "account_unresolved"; reason = "roblox_identity_required" }
  else if (!idString(order.products.roblox_universe_id) || !order.products.roblox_place_ids.length || !order.products.roblox_place_ids.every(idString)) { status = "pending"; reason = "game_mapping_required" }
  else status = "active"
  const changedAt = expired && expiry! > order.tikkies_updated_at ? expiry! : order.tikkies_updated_at
  return {
    entitlementId: order.id, purchasedUsername: order.whitelisted_username, gameKey: order.product_id, gameName: order.products.name_en,
    universeId: order.products.roblox_universe_id, placeIds: order.products.roblox_place_ids,
    status, expiresAt: expiry?.toISOString() ?? null, updatedAt: changedAt.toISOString(),
    revision: order.tikkies_revision * 2 - 1 + (expired ? 1 : 0),
    roblox: { userId: order.roblox_user_id, username: order.roblox_username ?? order.whitelisted_username, displayName: order.roblox_display_name },
    ...(reason ? { resolution: { reason, orderId: order.id } } : {}),
  }
}

export async function readTikkiesEntitlements(db: Prisma.TransactionClient, identities: Identity[], now: Date) {
  const accounts = await db.accounts.findMany({
    where: { OR: identities.map(i => ({ provider: i.provider, provider_account_id: i.providerAccountId })) },
    select: { user_id: true, provider: true, provider_account_id: true },
  })
  const customers = [...new Set(accounts.map(a => a.user_id))]
  if (customers.length > 1) throw new TikkiesError("identity_conflict", 409)
  if (!customers.length) throw new TikkiesError("customer_not_found", 404)
  const customerId = customers[0]
  const orders = await db.orders.findMany({
    where: { user_id: customerId, products: { type: "roblox_whitelist" } }, take: 5001,
    orderBy: { id: "asc" },
    select: { id: true, product_id: true, status: true, whitelist_status: true, whitelisted_username: true, paid_at: true, expires_at: true,
      tikkies_revision: true, tikkies_updated_at: true, roblox_user_id: true, roblox_username: true, roblox_display_name: true, roblox_resolved_for: true,
      products: { select: { id: true, name_en: true, type: true, roblox_universe_id: true, roblox_place_ids: true } } },
  })
  if (orders.length > 5000) throw new TikkiesError("entitlement_capacity_exceeded", 503)
  const names = [...new Set(orders.map(o => normalized(o.whitelisted_username)).filter(Boolean))]
  const products = [...new Set(orders.map(o => o.product_id))]
  const access = names.length ? await db.user_whitelist_access.findMany({ where: { product_id: { in: products }, OR: names.map(ign => ({ ign: { equals: ign, mode: "insensitive" as const } })) }, select: { ign: true, product_id: true, expires_at: true }, take: 10001 }) : []
  if (access.length > 10000) throw new TikkiesError("entitlement_capacity_exceeded", 503)
  const rewards = orders.length ? await db.point_redemptions.findMany({ where: { user_id: customerId, kind: "game_days" }, select: { result: true }, take: 5001 }) : []
  if (rewards.length > 5000) throw new TikkiesError("entitlement_capacity_exceeded", 503)
  const rewardExpiry = new Map<string, Date>()
  for (const { result } of rewards) {
    if (!isRecord(result) || typeof result.product_id !== "string" || typeof result.ign !== "string" || typeof result.expires_at !== "string") continue
    const d = new Date(result.expires_at), key = `${result.product_id}:${normalized(result.ign)}`
    if (Number.isFinite(d.getTime()) && (!rewardExpiry.has(key) || d > rewardExpiry.get(key)!)) rewardExpiry.set(key, d)
  }
  const byGameName = new Map<string, Whitelist>()
  for (const row of access) {
    const key = `${row.product_id}:${normalized(row.ign)}`
    const previous = byGameName.get(key)
    // Case variants are the same Roblox account; keep the current grant, still capped by this user's own order.
    if (!previous || row.expires_at > previous.expires_at) byGameName.set(key, row)
  }
  const unmatched = identities.filter(i => !accounts.some(a => a.provider === i.provider && a.provider_account_id === i.providerAccountId)).map(i => i.provider)
  return { schemaVersion: 1, customerId, checkedAt: now.toISOString(), entitlements: orders.map(order => {
    const key = `${order.product_id}:${normalized(order.whitelisted_username)}`
    return evaluateTikkiesEntitlement(order, byGameName.get(key) ?? null, now, rewardExpiry.get(key))
  }), ...(unmatched.length ? { warnings: [{ code: "identity_link_required", providers: [...new Set(unmatched)] }] } : {}) }
}
