import type { Prisma } from '@prisma/client'
import { BundleError, bundleTermExpiry, parseBundleSnapshot, readEligibleAcGames, type BundleSnapshot } from './bundles'
import type { RobloxBinding } from './integrations/tikkiesRoblox'

const TERMINAL = ['paid', 'refunded', 'revoked', 'cancelled', 'disputed', 'expired', 'blocked', 'banned']
export const BUNDLE_BLOCKED_WHITELIST = ['removed', 'revoked', 'suspended', 'blocked', 'banned', 'rejected', 'expired']
export type BundleGrantMetadata = {
  kind: 'bundle_desktop_grant_v1'
  generation: string
  baseline: { expiresAt: string; status: string } | null
  writtenExpiry: string
  writtenAt: string
}
export type BundleRobloxGrantMetadata = {
  kind: 'bundle_roblox_grant_v1'
  generation: string
  baseline: { expiresAt: string; isPremium: boolean } | null
  writtenExpiry: string
  writtenPremium: boolean
  writtenAt: string
}

export function readBundleGrantMetadata(note: string | null | undefined): BundleGrantMetadata | null {
  if (!note) return null
  try {
    const value = JSON.parse(note) as BundleGrantMetadata
    if (value.kind !== 'bundle_desktop_grant_v1' || typeof value.generation !== 'string' || !Number.isFinite(Date.parse(value.writtenAt)) || !Number.isFinite(Date.parse(value.writtenExpiry))) return null
    if (value.baseline && (typeof value.baseline.status !== 'string' || !Number.isFinite(Date.parse(value.baseline.expiresAt)))) return null
    return value
  } catch { return null }
}

export function readBundleRobloxGrantMetadata(note: string | null | undefined): BundleRobloxGrantMetadata | null {
  if (!note) return null
  try {
    const value = JSON.parse(note) as BundleRobloxGrantMetadata
    if (value.kind !== 'bundle_roblox_grant_v1' || typeof value.generation !== 'string' || typeof value.writtenPremium !== 'boolean' || !Number.isFinite(Date.parse(value.writtenAt)) || !Number.isFinite(Date.parse(value.writtenExpiry))) return null
    if (value.baseline && (typeof value.baseline.isPremium !== 'boolean' || !Number.isFinite(Date.parse(value.baseline.expiresAt)))) return null
    return value
  } catch { return null }
}

export function bundleOrderAllowsAccess(order: { status: string; whitelist_status: string | null }) {
  return order.status === 'paid' && !BUNDLE_BLOCKED_WHITELIST.includes(order.whitelist_status ?? '')
}

type GrantParent = Pick<Prisma.ordersGetPayload<Record<string, never>>, 'id' | 'product_id' | 'user_id' | 'whitelisted_username' | 'roblox_user_id' | 'roblox_username' | 'roblox_display_name' | 'roblox_resolved_for'>

/** Parent must already be locked. Existing children, including revoked ones,
 * are authoritative. The DB's unique(parent, product) constraint is a backstop.
 * This helper creates entitlement children only; it has no payment side effects. */
export async function materializeBundleGamesInTransaction(
  tx: Prisma.TransactionClient,
  parent: GrantParent,
  items: BundleSnapshot['items'],
  opts: { expiresAt: Date; paidAt: Date; now: Date; robloxBinding?: Partial<RobloxBinding>; allowUnclaimedEmail?: boolean },
): Promise<number> {
  if (!parent.user_id && !opts.allowUnclaimedEmail) throw new BundleError('bundle_buyer_required')
  if (items.some(item => item.productId === parent.product_id)) throw new BundleError('bundle_invalid_snapshot')
  const ign = parent.whitelisted_username?.trim()
  if (items.some(item => item.type === 'roblox_whitelist') && (!ign || !/^[A-Za-z0-9_]{3,20}$/.test(ign))) throw new BundleError('bundle_roblox_username_required')
  const existing = await tx.orders.findMany({ where: { bundle_parent_id: parent.id }, select: { product_id: true } })
  const existingIds = new Set(existing.map(child => child.product_id))
  // Roblox is bound to IGN immediately. Account-bound desktop rights are
  // materialized after the reserved mailbox has a verified account owner.
  const missing = items.filter(item => !existingIds.has(item.productId) && (parent.user_id || item.type !== 'desktop_program')).sort((a, b) => a.productId.localeCompare(b.productId))
  const { expiresAt, now } = opts
  // Every grant and reversal uses the same product ordering, before row locks.
  for (const item of missing) {
    await lockBundleEntitlement(tx, `${item.type}:${item.type === 'desktop_program' ? parent.user_id : ign!.toLowerCase()}:${item.productId}`)
  }
  for (const item of missing) {
    let metadata: BundleGrantMetadata | BundleRobloxGrantMetadata
    if (item.type === 'desktop_program') {
      if (!parent.user_id) throw new BundleError('bundle_buyer_required')
      await tx.$queryRaw`SELECT id FROM user_program_access WHERE user_id = ${parent.user_id}::uuid AND product_id = ${item.productId}::uuid FOR UPDATE`
      const current = await tx.user_program_access.findUnique({ where: { user_id_product_id: { user_id: parent.user_id, product_id: item.productId } } })
      const priorOrders = await tx.orders.findMany({ where: { user_id: parent.user_id, product_id: item.productId }, select: { status: true, whitelist_status: true, expires_at: true, manual_note: true } })
      const priorMetadata = priorOrders.map(order => readBundleGrantMetadata(order.manual_note)).filter((m): m is BundleGrantMetadata => !!m)
      const previousWriter = current && priorMetadata.find(m => m.writtenAt === current.updated_at.toISOString() && m.writtenExpiry === current.expires_at.toISOString())
      const accountedFor = current && priorOrders.some(order => bundleOrderAllowsAccess(order) && order.expires_at?.getTime() === current.expires_at.getTime())
      const resultingExpiry = current && current.status === 'ACTIVE' && current.expires_at > expiresAt ? current.expires_at : expiresAt
      metadata = {
        kind: 'bundle_desktop_grant_v1', generation: previousWriter ? previousWriter.generation : `${parent.id}:${item.productId}`,
        baseline: previousWriter ? previousWriter.baseline : (current && !accountedFor ? { expiresAt: current.expires_at.toISOString(), status: current.status } : null),
        writtenAt: now.toISOString(), writtenExpiry: resultingExpiry.toISOString(),
      }
      await tx.user_program_access.upsert({
        where: { user_id_product_id: { user_id: parent.user_id, product_id: item.productId } },
        create: { user_id: parent.user_id, product_id: item.productId, expires_at: resultingExpiry, status: 'ACTIVE', updated_at: now },
        update: { expires_at: resultingExpiry, status: 'ACTIVE', updated_at: now },
      })
    } else {
      await tx.$queryRaw`SELECT id FROM user_whitelist_access WHERE ign = ${ign!} AND product_id = ${item.productId}::uuid FOR UPDATE`
      const current = await tx.user_whitelist_access.findUnique({ where: { ign_product_id: { ign: ign!, product_id: item.productId } } })
      const priorOrders = await tx.orders.findMany({ where: { product_id: item.productId, whitelisted_username: { equals: ign!, mode: 'insensitive' } }, select: { status: true, whitelist_status: true, expires_at: true, is_premium_order: true, manual_note: true } })
      const priorMetadata = priorOrders.map(order => readBundleRobloxGrantMetadata(order.manual_note)).filter((m): m is BundleRobloxGrantMetadata => !!m)
      const previousWriter = current && priorMetadata.find(m => m.writtenAt === current.updated_at.toISOString() && m.writtenExpiry === current.expires_at.toISOString() && m.writtenPremium === current.is_premium)
      const accountedFor = current && priorOrders.some(order => bundleOrderAllowsAccess(order) && order.expires_at?.getTime() === current.expires_at.getTime() && !!order.is_premium_order === current.is_premium)
      const resultingExpiry = current && current.expires_at > expiresAt ? current.expires_at : expiresAt
      metadata = {
        kind: 'bundle_roblox_grant_v1', generation: previousWriter ? previousWriter.generation : `${parent.id}:${item.productId}`,
        baseline: previousWriter ? previousWriter.baseline : (current && !accountedFor ? { expiresAt: current.expires_at.toISOString(), isPremium: current.is_premium } : null),
        writtenAt: now.toISOString(), writtenExpiry: resultingExpiry.toISOString(), writtenPremium: current?.is_premium ?? false,
      }
      await tx.user_whitelist_access.upsert({
        where: { ign_product_id: { ign: ign!, product_id: item.productId } },
        create: { ign: ign!, product_id: item.productId, expires_at: resultingExpiry, is_premium: false, updated_at: now },
        update: { expires_at: resultingExpiry, updated_at: now },
      })
    }
    await tx.orders.create({ data: {
      product_id: item.productId, user_id: parent.user_id, variant_id: null, bundle_parent_id: parent.id,
      amount: 0, goods_amount: 0, discount_amount: 0, payment_method: 'bundle', status: 'paid', order_type: 'BUNDLE_GAME',
      paid_at: opts.paidAt, fulfilled_at: now, expires_at: expiresAt, whitelist_status: 'whitelisted', is_premium_order: false,
      whitelisted_username: item.type === 'roblox_whitelist' ? ign : null,
      ...(item.type === 'roblox_whitelist' ? {
        roblox_user_id: parent.roblox_user_id, roblox_username: parent.roblox_username,
        roblox_display_name: parent.roblox_display_name, roblox_resolved_for: parent.roblox_resolved_for,
        ...opts.robloxBinding,
      } : {}),
      manual_note: JSON.stringify(metadata),
    } })
  }
  return missing.length
}

/** Serializes grants for the same principal/game, including different bundles. */
export async function lockBundleEntitlement(tx: Prisma.TransactionClient, key: string) {
  // PostgreSQL returns void here, which Prisma queryRaw cannot deserialize.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))`
}

/**
 * Must run in the caller's interactive transaction. No network, points, affiliate
 * earnings or nested transaction. The parent row lock is shared with reversal.
 * Prepare the Roblox binding once OUTSIDE the transaction and pass it below.
 */
export async function fulfillBundleInTransaction(
  tx: Prisma.TransactionClient,
  parentId: string,
  opts: { robloxBinding?: Partial<RobloxBinding>; now?: Date; allowUnclaimedEmail?: boolean } = {},
): Promise<'ok' | 'already_paid' | 'missing'> {
  await tx.$queryRaw`SELECT id FROM orders WHERE id = ${parentId}::uuid FOR UPDATE`
  const parent = await tx.orders.findUnique({ where: { id: parentId } })
  if (!parent) return 'missing'
  // Children are never a payment entry point, even if someone makes one pending.
  if (parent.bundle_parent_id || parent.order_type === 'BUNDLE_GAME' || TERMINAL.includes(parent.status) || BUNDLE_BLOCKED_WHITELIST.includes(parent.whitelist_status ?? '')) return 'already_paid'
  const snapshot = parseBundleSnapshot(parent.bundle_snapshot)
  const items = snapshot.allAcGames ? [...new Map([...snapshot.items, ...await readEligibleAcGames(tx)].map(item => [item.productId, item])).values()] : snapshot.items
  const now = opts.now ?? new Date()
  const expiresAt = bundleTermExpiry(snapshot, now)
  const allowUnclaimedEmail = opts.allowUnclaimedEmail === true && parent.payment_method === 'admin_manual' && parent.order_type === 'BUNDLE' && parent.manual_note === 'aclass:whitelist-email:v1' && !!parent.buyer_label
  await materializeBundleGamesInTransaction(tx, parent, items, { expiresAt, paidAt: now, now, robloxBinding: opts.robloxBinding, allowUnclaimedEmail })
  await tx.orders.update({ where: { id: parentId }, data: {
    status: 'paid', paid_at: now, fulfilled_at: now, expires_at: expiresAt, whitelist_status: 'whitelisted', is_premium_order: false,
    ...opts.robloxBinding,
  } })
  return 'ok'
}
