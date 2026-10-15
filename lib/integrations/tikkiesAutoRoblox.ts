import type { PrismaClient } from '@prisma/client'
import { isPlausibleUsername } from '../roblox'
import { lookupTikkiesRobloxBatch } from './tikkiesRoblox'
import type { readTikkiesEntitlements } from './tikkies'

type Snapshot = Awaited<ReturnType<typeof readTikkiesEntitlements>>
type Db = Pick<PrismaClient, 'orders' | '$transaction'>
const cooldown = new Map<string, { until: number; cursor: number }>(), pending = new Map<string, Promise<boolean>>()

// Only fill missing IDs from this customer's eligible purchases; never replace a saved identity.
export async function resolvePurchasedAccounts(db: Db, snapshot: Snapshot): Promise<boolean> {
  const groups = new Map<string, string[]>()
  for (const row of snapshot.entitlements) {
    if (row.status !== 'account_unresolved' || row.roblox.userId || !row.purchasedUsername || !isPlausibleUsername(row.purchasedUsername)) continue
    const name = row.purchasedUsername.trim().toLowerCase()
    if (!groups.has(name)) groups.set(name, [])
    groups.get(name)!.push(row.entitlementId)
  }
  if (!groups.size) return false
  const customer = snapshot.customerId
  if (pending.has(customer)) return pending.get(customer)!
  const now = Date.now(), previous = cooldown.get(customer)
  if ((previous?.until ?? 0) > now || pending.size >= 4) return false
  const names = [...groups.keys()], start = (previous?.cursor ?? 0) % names.length
  const selected = Array.from({ length: Math.min(50, names.length) }, (_, i) => names[(start + i) % names.length])
  // Round-robin names and orders so failures or duplicate purchases cannot starve later accounts.
  const ids: string[] = []
  for (let round = 0; ids.length < 100; round++) {
    const before = ids.length
    for (const name of selected) { const id = groups.get(name)![round]; if (id && ids.length < 100) ids.push(id) }
    if (ids.length === before) break
  }
  cooldown.delete(customer)
  if (cooldown.size >= 1000) cooldown.delete(cooldown.keys().next().value!)
  cooldown.set(customer, { until: now + 60000, cursor: start + selected.length })
  const work = (async () => {
    const rows = await db.orders.findMany({ where: { user_id: customer, id: { in: ids }, roblox_user_id: null,
      status: { in: ['paid', 'Admin Buy'] }, whitelist_status: 'whitelisted', paid_at: { not: null } },
      take: 100, select: { id: true, whitelisted_username: true, roblox_user_id: true, roblox_resolved_for: true, tikkies_revision: true } })
    const names = [...new Set(rows.map(row => row.whitelisted_username?.trim().toLowerCase()).filter((name): name is string => !!name && isPlausibleUsername(name)))].slice(0, 50)
    if (!names.length) return false
    // Roblox runs outside a DB transaction, with one bounded request for all names.
    const identities = await lookupTikkiesRobloxBatch(names).catch(() => null)
    if (!identities?.size) return false
    return db.$transaction(async tx => {
      let changed = 0
      for (const row of rows) {
        const name = row.whitelisted_username?.trim().toLowerCase(), identity = name && identities.get(name)
        if (!identity) continue
        const result = await tx.orders.updateMany({ where: { id: row.id, user_id: customer, roblox_user_id: null,
          whitelisted_username: row.whitelisted_username, roblox_resolved_for: row.roblox_resolved_for, tikkies_revision: row.tikkies_revision,
          status: { in: ['paid', 'Admin Buy'] }, whitelist_status: 'whitelisted', paid_at: { not: null } },
          data: { roblox_user_id: identity.userId, roblox_username: identity.username, roblox_display_name: identity.displayName, roblox_resolved_for: name! } })
        changed += result.count
      }
      return changed > 0
    }, { timeout: 3000 })
  })().finally(() => pending.delete(customer))
  pending.set(customer, work)
  return work
}
