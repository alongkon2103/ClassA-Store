import type { Prisma } from '@prisma/client'
import { parseBundleSnapshot, readEligibleAcGames } from './bundles'
import { BUNDLE_BLOCKED_WHITELIST, materializeBundleGamesInTransaction } from './bundleFulfillment'

/** Add newly published AC games within the original purchased term. The caller
 * owns the transaction. Locking the same parent as payment/refund serializes
 * concurrent syncs and prevents grants after a completed reversal. */
export async function syncBundleMembershipInTransaction(
  tx: Prisma.TransactionClient,
  parentId: string,
  opts: { now?: Date } = {},
): Promise<number> {
  await tx.$queryRaw`SELECT id FROM orders WHERE id = ${parentId}::uuid FOR UPDATE`
  const parent = await tx.orders.findUnique({ where: { id: parentId } })
  const now = opts.now ?? new Date()
  if (!Number.isFinite(now.getTime()) || !parent || parent.bundle_parent_id || parent.order_type === 'BUNDLE_GAME' || parent.status !== 'paid' || !parent.user_id || !parent.paid_at || !parent.fulfilled_at || !parent.expires_at || parent.expires_at <= now || BUNDLE_BLOCKED_WHITELIST.includes(parent.whitelist_status ?? '')) return 0
  const snapshot = parseBundleSnapshot(parent.bundle_snapshot)
  if (!snapshot.allAcGames) return 0
  const buyer = await tx.users.findUnique({ where: { id: parent.user_id }, select: { nativeStatus: true } })
  if (!buyer || ['KICKED', 'BLOCKED', 'BANNED', 'SUSPENDED'].includes((buyer.nativeStatus ?? '').toUpperCase())) return 0
  // A mutable aggregate expiry can never lengthen the original snapshot term.
  const originalExpiry = snapshot.durationType === 'permanent' ? new Date('9999-12-31T00:00:00Z') : new Date(parent.paid_at.getTime() + snapshot.durationDays! * 86400000)
  const expiresAt = new Date(Math.min(parent.expires_at.getTime(), originalExpiry.getTime()))
  if (!Number.isFinite(expiresAt.getTime()) || expiresAt <= now) return 0
  const items = await readEligibleAcGames(tx)
  return materializeBundleGamesInTransaction(tx, parent, items, { expiresAt, paidAt: parent.paid_at, now })
}
