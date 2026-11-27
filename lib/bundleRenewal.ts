import type { Prisma } from '@prisma/client'
import { BundleError, bundleTermExpiry, parseBundleSnapshot, type BundleSnapshot } from './bundles'
import { normalizeEmail } from './verifiedEmail'
import { EMAIL_WHITELIST_NOTE, literalInsensitive } from './whitelistGrantIdentity'

/** Caller serializes the product/player in its READ COMMITTED transaction.
 * Only valid frozen parent terms owned by this recipient supply remaining time. */
export async function renewBundleSnapshot(db: Pick<Prisma.TransactionClient, 'orders'>, snapshot: BundleSnapshot, input: {
  productId: string; userId: string | null; email?: string | null; ign: string; now: Date;
}): Promise<BundleSnapshot> {
  if (snapshot.durationType === 'permanent') return snapshot
  const owners: Prisma.ordersWhereInput[] = []
  if (input.userId) owners.push({ user_id: input.userId })
  const email = normalizeEmail(input.email)
  if (email) owners.push({ user_id: null, buyer_label: literalInsensitive(email), payment_method: 'admin_manual', manual_note: EMAIL_WHITELIST_NOTE })
  if (!owners.length) throw new BundleError('bundle_buyer_required')
  const previous = await db.orders.findMany({ where: {
    product_id: input.productId, whitelisted_username: literalInsensitive(input.ign),
    order_type: 'BUNDLE', bundle_parent_id: null, status: 'paid', whitelist_status: 'whitelisted',
    paid_at: { not: null, lte: input.now }, fulfilled_at: { not: null, lte: input.now }, expires_at: { gt: input.now },
    OR: owners,
  }, take: 1001 })
  if (previous.length > 1000) throw new BundleError('bundle_membership_capacity_exceeded', 503)
  let base = input.now.getTime()
  for (const parent of previous) {
    try {
      const terms = parseBundleSnapshot(parent.bundle_snapshot)
      base = Math.max(base, Math.min(parent.expires_at!.getTime(), bundleTermExpiry(terms, parent.fulfilled_at!).getTime()))
    } catch { /* Corrupt historical terms cannot manufacture remaining time. */ }
  }
  if (base === Date.parse('9999-12-31T00:00:00Z')) return { ...snapshot, durationType: 'permanent', durationDays: null }
  return base > input.now.getTime() ? parseBundleSnapshot({ ...snapshot, renewalBaseExpiresAt: new Date(base).toISOString() }) : snapshot
}
