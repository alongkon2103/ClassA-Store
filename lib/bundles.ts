import type { Prisma } from '@prisma/client'

export class BundleError extends Error {
  constructor(public readonly code: string, public readonly status = 400) {
    super(code)
    this.name = 'BundleError'
  }
}

export type BundleSnapshot = {
  version: 1
  durationType: 'permanent' | 'days'
  durationDays: number | null
  tikkiesMembership?: true
  allAcGames?: true
  items: { productId: string; nameTh: string; nameEn: string; type: 'roblox_whitelist' | 'desktop_program' }[]
}
export type BundleProductInput = {
  id: string; type?: string | null; is_active?: boolean | null
  is_consignment?: boolean | null; bundle_product_ids?: unknown
  bundle_includes_tikkies?: boolean | null
  bundle_all_ac_games?: boolean | null
}
export type BundleVariantInput = {
  id: string; product_id: string; is_active?: boolean | null; variant_type?: string | null
  duration_type: string; duration_days?: number | null
}
type CatalogDb = Pick<Prisma.TransactionClient, 'products'>
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DAY = 86400000
const PERMANENT = new Date('9999-12-31T00:00:00Z').getTime()

export function validateBundleTikkiesFlag(value: unknown, type: string): boolean {
  if (value === undefined) return false
  if (typeof value !== 'boolean' || (value && type !== 'bundle')) throw new BundleError('bundle_invalid_tikkies_membership')
  return value
}

export function validateBundleAllAcGamesFlag(value: unknown, type: string): boolean {
  if (value === undefined) return false
  if (typeof value !== 'boolean' || (value && type !== 'bundle')) throw new BundleError('bundle_invalid_all_games')
  return value
}

export function validateBundleProductIds(value: unknown, selfId?: string, maxItems = 50): string[] {
  if (!Array.isArray(value) || value.length < 2 || value.length > maxItems || value.some(id => typeof id !== 'string' || !UUID.test(id))) throw new BundleError('bundle_invalid_members')
  const ids = value.map(id => (id as string).toLowerCase())
  if (new Set(ids).size !== ids.length || (selfId && ids.includes(selfId.toLowerCase()))) throw new BundleError('bundle_invalid_members')
  return ids
}

/** All store-owned active games. Partner/consignment inventory never joins membership. */
export async function readEligibleAcGames(db: CatalogDb): Promise<BundleSnapshot['items']> {
  const products = await db.products.findMany({
    where: { is_active: true, type: { in: ['roblox_whitelist', 'desktop_program'] }, OR: [{ is_consignment: false }, { is_consignment: null }] },
    select: { id: true, name_th: true, name_en: true, type: true, is_active: true, is_consignment: true },
    orderBy: [{ display_order: 'asc' }, { id: 'asc' }], take: 501,
  })
  const ids = validateBundleProductIds(products.map(product => product.id), undefined, 500)
  return products.map((product,index) => {
    if (product.is_active !== true || product.is_consignment || !['roblox_whitelist','desktop_program'].includes(product.type)) throw new BundleError('bundle_invalid_members')
    return { productId: ids[index], nameTh: product.name_th, nameEn: product.name_en, type: product.type as BundleSnapshot['items'][number]['type'] }
  })
}

export async function validateBundleMembers(db: CatalogDb, input: string[], selfId?: string): Promise<BundleSnapshot['items']> {
  const ids = validateBundleProductIds(input, selfId)
  const products = await db.products.findMany({
    where: { id: { in: ids } },
    select: { id: true, name_th: true, name_en: true, type: true, is_active: true, is_consignment: true },
  })
  const byId = new Map(products.map(product => [product.id.toLowerCase(), product]))
  return ids.map(id => {
    const product = byId.get(id)
    if (!product || product.is_active !== true || product.is_consignment || !['roblox_whitelist', 'desktop_program'].includes(product.type)) throw new BundleError('bundle_invalid_members')
    return { productId: id, nameTh: product.name_th, nameEn: product.name_en, type: product.type as BundleSnapshot['items'][number]['type'] }
  })
}

function validateDuration(type: unknown, days: unknown) {
  if (type === 'permanent' && days === null) return
  if (type !== 'days' || typeof days !== 'number' || !Number.isInteger(days) || days < 1 || days > 2147483647 || Date.now() + days * DAY >= PERMANENT) throw new BundleError('bundle_invalid_duration')
}

/** Validate immutable checkout terms; subsequent catalog edits cannot alter a purchase. */
export async function freezeBundle(db: CatalogDb, product: BundleProductInput, variant: BundleVariantInput | null | undefined): Promise<BundleSnapshot> {
  if (product.type !== 'bundle' || product.is_consignment) throw new BundleError('bundle_invalid')
  if (product.is_active !== true) throw new BundleError('bundle_inactive')
  if (!variant || variant.product_id !== product.id || variant.is_active !== true || (variant.variant_type && variant.variant_type !== 'normal')) throw new BundleError('bundle_invalid_variant')
  const durationDays = variant.duration_type === 'permanent' ? null : variant.duration_days
  validateDuration(variant.duration_type, durationDays)
  return { version: 1, durationType: variant.duration_type as BundleSnapshot['durationType'], durationDays: durationDays ?? null, ...(product.bundle_includes_tikkies === true ? { tikkiesMembership: true as const } : {}), ...(product.bundle_all_ac_games === true ? { allAcGames: true as const } : {}), items: product.bundle_all_ac_games === true ? await readEligibleAcGames(db) : await validateBundleMembers(db, validateBundleProductIds(product.bundle_product_ids, product.id), product.id) }
}

/** Strictly parse stored terms; never fall back to today's mutable catalog. */
export function parseBundleSnapshot(value: unknown): BundleSnapshot {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new BundleError('bundle_invalid_snapshot')
  const source = value as Record<string, unknown>
  if (source.version !== 1 || !Array.isArray(source.items)) throw new BundleError('bundle_invalid_snapshot')
  if (source.tikkiesMembership !== undefined && typeof source.tikkiesMembership !== 'boolean') throw new BundleError('bundle_invalid_snapshot')
  if (source.allAcGames !== undefined && typeof source.allAcGames !== 'boolean') throw new BundleError('bundle_invalid_snapshot')
  validateDuration(source.durationType, source.durationDays)
  const ids = validateBundleProductIds(source.items.map(item => item && typeof item === 'object' ? (item as Record<string, unknown>).productId : null), undefined, source.allAcGames === true ? 500 : 50)
  const items = source.items.map((item, index) => {
    const row = item as Record<string, unknown>
    if (typeof row.nameTh !== 'string' || typeof row.nameEn !== 'string' || !['roblox_whitelist', 'desktop_program'].includes(row.type as string)) throw new BundleError('bundle_invalid_snapshot')
    return { productId: ids[index], nameTh: row.nameTh, nameEn: row.nameEn, type: row.type as BundleSnapshot['items'][number]['type'] }
  })
  return { version: 1, durationType: source.durationType as BundleSnapshot['durationType'], durationDays: source.durationDays as number | null, ...(source.tikkiesMembership === true ? { tikkiesMembership: true as const } : {}), ...(source.allAcGames === true ? { allAcGames: true as const } : {}), items }
}
