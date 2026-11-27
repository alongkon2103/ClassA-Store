import type { Prisma } from '@prisma/client'
import { BundleError, freezeBundle, parseBundleSnapshot, type BundleSnapshot } from './bundles'
import { fulfillBundleInTransaction } from './bundleFulfillment'
import { reverseBundleInTransaction } from './bundleReversal'
import { EMAIL_WHITELIST_NOTE, RETIRED_EMAIL_WHITELIST_NOTE, literalInsensitive } from './manualWhitelistEmail'
import type { RobloxBinding } from './integrations/tikkiesRoblox'

export const MANUAL_BUNDLE_NOTE = 'aclass:whitelist-membership:v1'

export async function retireManualBundles(tx: Prisma.TransactionClient, productId: string, ign: string) {
  const parents = await tx.orders.findMany({ where: {
    product_id: productId, whitelisted_username: literalInsensitive(ign),
    payment_method: 'admin_manual', order_type: 'BUNDLE', bundle_parent_id: null,
    manual_note: { in: [MANUAL_BUNDLE_NOTE, EMAIL_WHITELIST_NOTE] }, status: 'paid',
  }, orderBy: { id: 'asc' } })
  for (const parent of parents) {
    await reverseBundleInTransaction(tx, parent.id, 'revoked')
    await tx.orders.update({ where: { id: parent.id }, data: { status: 'revoked', whitelist_status: 'revoked', manual_note: RETIRED_EMAIL_WHITELIST_NOTE } })
  }
  return parents
}

/** Caller holds the recipient and product/IGN locks. No monetary side effects. */
export async function grantManualBundle(tx: Prisma.TransactionClient, input: {
  productId: string; userId: string | null; email: string | null; ign: string;
  actorId: string; durationDays: number; isPermanent: boolean;
  robloxBinding: Partial<RobloxBinding>; now?: Date;
  snapshot?: BundleSnapshot; excludedProductIds?: string[];
}) {
  const product = await tx.products.findUnique({ where: { id: input.productId } })
  if (!product) throw new BundleError('bundle_invalid')
  if (product.type !== 'bundle' || product.is_consignment) throw new BundleError('bundle_invalid')
  const snapshot = input.snapshot ? parseBundleSnapshot(input.snapshot) : await freezeBundle(tx, product, {
    id: 'admin-selected-term', product_id: product.id, is_active: true, variant_type: 'normal',
    duration_type: input.isPermanent ? 'permanent' : 'days', duration_days: input.isPermanent ? null : input.durationDays,
  })
  if (!input.userId && !input.email) throw new BundleError('bundle_buyer_required')
  if (input.userId) {
    const buyer = await tx.users.findUnique({ where: { id: input.userId }, select: { nativeStatus: true } })
    if (!buyer || ['KICKED', 'BLOCKED', 'BANNED', 'SUSPENDED'].includes(buyer.nativeStatus.toUpperCase())) throw new BundleError('bundle_account_not_allowed')
  }
  await retireManualBundles(tx, product.id, input.ign)
  const parent = await tx.orders.create({ data: {
    product_id: product.id, user_id: input.userId, recorded_by_id: input.actorId,
    buyer_label: input.email, manual_note: input.email ? EMAIL_WHITELIST_NOTE : MANUAL_BUNDLE_NOTE,
    amount: 0, goods_amount: 0, discount_amount: 0, payment_method: 'admin_manual',
    order_type: 'BUNDLE', status: 'pending', whitelist_status: 'pending',
    bundle_snapshot: snapshot, whitelisted_username: input.ign, ...input.robloxBinding,
  } })
  // An edit preserves deliberately removed child games. A fresh POST is a new
  // grant and intentionally includes the whole package again.
  for (const productId of input.excludedProductIds ?? []) {
    await tx.orders.create({ data: {
      product_id: productId, user_id: input.userId, bundle_parent_id: parent.id,
      order_type: 'BUNDLE_GAME', payment_method: 'bundle', amount: 0,
      status: 'revoked', whitelist_status: 'revoked',
    } })
  }
  await fulfillBundleInTransaction(tx, parent.id, { robloxBinding: input.robloxBinding, now: input.now, allowUnclaimedEmail: !input.userId })
  const order = await tx.orders.findUniqueOrThrow({ where: { id: parent.id } })
  const whitelist = await tx.user_whitelist_access.upsert({
    where: { ign_product_id: { ign: input.ign, product_id: product.id } },
    create: { ign: input.ign, product_id: product.id, expires_at: order.expires_at!, is_premium: false },
    update: { expires_at: order.expires_at!, is_premium: false, updated_at: new Date() },
  })
  return { order, whitelist }
}
