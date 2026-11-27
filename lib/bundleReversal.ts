import type { Prisma } from '@prisma/client'
import { bundleOrderAllowsAccess, lockBundleEntitlement, readBundleGrantMetadata, readBundleRobloxGrantMetadata, type BundleGrantMetadata, type BundleRobloxGrantMetadata } from './bundleFulfillment'

/**
 * Caller verifies the refund/admin action and owns the transaction and monetary
 * reversal. Repeated calls are safe; the same parent lock orders payment/refund.
 * Aggregate access is recomputed only when a bundle provenance marker still
 * owns the row. Later independent/admin writers remain authoritative.
 */
export async function reverseBundleInTransaction(
  tx: Prisma.TransactionClient,
  parentId: string,
  status: 'refunded' | 'revoked' | 'disputed',
  opts: { now?: Date } = {},
): Promise<boolean> {
  await tx.$queryRaw`SELECT id FROM orders WHERE id = ${parentId}::uuid FOR UPDATE`
  const parent = await tx.orders.findUnique({ where: { id: parentId } })
  if (!parent || parent.bundle_parent_id || !parent.bundle_snapshot) return false
  const now = opts.now ?? new Date()
  const children = await tx.orders.findMany({ where: { bundle_parent_id: parentId } })
  const desktop = children.filter(child => !!readBundleGrantMetadata(child.manual_note)).sort((a, b) => a.product_id.localeCompare(b.product_id))
  const roblox = children.filter(child => !!readBundleRobloxGrantMetadata(child.manual_note)).sort((a, b) => a.product_id.localeCompare(b.product_id))
  for (const child of [...desktop, ...roblox].sort((a, b) => a.product_id.localeCompare(b.product_id))) {
    const isDesktop = !!readBundleGrantMetadata(child.manual_note)
    const principal = isDesktop ? child.user_id : child.whitelisted_username?.trim().toLowerCase()
    if (principal) await lockBundleEntitlement(tx, `${isDesktop ? 'desktop_program' : 'roblox_whitelist'}:${principal}:${child.product_id}`)
  }
  // Preserve refunded as the strongest terminal state, including on retries.
  for (const child of children) {
    await tx.orders.update({ where: { id: child.id }, data: { status: child.status === 'refunded' ? 'refunded' : status, whitelist_status: 'revoked', updated_at: now } })
  }
  for (const child of desktop) {
    if (!child.user_id) continue
    await tx.$queryRaw`SELECT id FROM user_program_access WHERE user_id = ${child.user_id}::uuid AND product_id = ${child.product_id}::uuid FOR UPDATE`
    const current = await tx.user_program_access.findUnique({ where: { user_id_product_id: { user_id: child.user_id, product_id: child.product_id } } })
    if (!current) continue
    const orders = await tx.orders.findMany({ where: { user_id: child.user_id, product_id: child.product_id }, select: { id: true, status: true, whitelist_status: true, expires_at: true, manual_note: true } })
    const metadata = orders.map(order => readBundleGrantMetadata(order.manual_note)).filter((m): m is BundleGrantMetadata => !!m)
    const writer = metadata.find(m => m.writtenAt === current.updated_at.toISOString() && m.writtenExpiry === current.expires_at.toISOString())
    // A later admin/independent writer owns this aggregate. Never overwrite it.
    if (!writer) continue
    const candidates = orders.filter(order => bundleOrderAllowsAccess(order) && order.expires_at).map(order => order.expires_at!)
    for (const m of metadata) if (m.generation === writer.generation && m.baseline?.status === 'ACTIVE') candidates.push(new Date(m.baseline.expiresAt))
    const expiry = candidates.reduce((best, candidate) => candidate > best ? candidate : best, new Date(0))
    const active = expiry > now
    const storedExpiry = active ? expiry : now
    await tx.user_program_access.update({ where: { user_id_product_id: { user_id: child.user_id, product_id: child.product_id } }, data: { expires_at: storedExpiry, status: active ? 'ACTIVE' : 'REVOKED', updated_at: now } })
    // Keep a provenance marker for a subsequent overlapping bundle reversal.
    const own = readBundleGrantMetadata(child.manual_note)!
    await tx.orders.update({ where: { id: child.id }, data: { manual_note: JSON.stringify({ ...own, generation: writer.generation, baseline: writer.baseline, writtenAt: now.toISOString(), writtenExpiry: storedExpiry.toISOString() }) } })
  }
  for (const child of roblox) {
    const ign = child.whitelisted_username?.trim()
    if (!ign) continue
    await tx.$queryRaw`SELECT id FROM user_whitelist_access WHERE ign = ${ign} AND product_id = ${child.product_id}::uuid FOR UPDATE`
    const current = await tx.user_whitelist_access.findUnique({ where: { ign_product_id: { ign, product_id: child.product_id } } })
    if (!current) continue
    const orders = await tx.orders.findMany({ where: { product_id: child.product_id, whitelisted_username: { equals: ign, mode: 'insensitive' } }, select: { status: true, whitelist_status: true, expires_at: true, is_premium_order: true, manual_note: true } })
    const metadata = orders.map(order => readBundleRobloxGrantMetadata(order.manual_note)).filter((m): m is BundleRobloxGrantMetadata => !!m)
    const writer = metadata.find(m => m.writtenAt === current.updated_at.toISOString() && m.writtenExpiry === current.expires_at.toISOString() && m.writtenPremium === current.is_premium)
    if (!writer) continue
    const remaining = orders.filter(order => bundleOrderAllowsAccess(order) && order.expires_at)
    const candidates = remaining.map(order => order.expires_at!)
    const baselines = metadata.filter(m => m.generation === writer.generation && m.baseline).map(m => m.baseline!)
    for (const baseline of baselines) candidates.push(new Date(baseline.expiresAt))
    const expiry = candidates.reduce((best, candidate) => candidate > best ? candidate : best, new Date(0))
    const premium = remaining.some(order => order.is_premium_order && order.expires_at! > now) || baselines.some(baseline => baseline.isPremium && new Date(baseline.expiresAt) > now)
    // Whitelist has no status column: an empty bundle-only grant must actually
    // expire so the legacy whitelist checker also denies a refunded bundle.
    await tx.user_whitelist_access.update({ where: { ign_product_id: { ign, product_id: child.product_id } }, data: { expires_at: expiry, is_premium: premium, updated_at: now } })
    const own = readBundleRobloxGrantMetadata(child.manual_note)!
    await tx.orders.update({ where: { id: child.id }, data: { manual_note: JSON.stringify({ ...own, generation: writer.generation, baseline: writer.baseline, writtenAt: now.toISOString(), writtenExpiry: expiry.toISOString(), writtenPremium: premium }) } })
  }
  return true
}
