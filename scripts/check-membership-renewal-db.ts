import assert from 'node:assert/strict'

const DAY = 86400000
const FOREVER = '9999-12-31T00:00:00.000Z'
async function main() {
  const url = 'postgresql://postgres:local-real-membership@127.0.0.1:55433/postgres'
  assert.equal(process.env.MEMBERSHIP_QA_ISOLATED, 'true')
  assert.equal(process.env.DATABASE_URL, url)
  const { PrismaClient } = await import('@prisma/client')
  const { PrismaPg } = await import('@prisma/adapter-pg')
  const { default: pg } = await import('pg')
  const db = new PrismaClient({ adapter: new PrismaPg(new pg.Pool({ connectionString: url, max: 1 })) })
  globalThis.prisma = db
  const stub = (name: string, exports: unknown) => { const id = require.resolve(name); require.cache[id] = { id, filename: id, loaded: true, exports } as NodeModule }
  let actor = ''
  stub('../lib/adminAuth', { validateAdmin: async () => ({ isValid: true, session: { user: { id: actor, role: 'admin' } } }) })
  stub('../lib/integrations/tikkiesRoblox', { resolveTikkiesBinding: async (ign: string) => ({ roblox_user_id: '123456789', roblox_username: ign, roblox_resolved_for: ign.toLowerCase() }) })
  globalThis.fetch = (async () => { throw new Error('No external network in renewal QA') }) as typeof fetch
  try {
    actor = (await db.users.create({ data: { username: 'QA admin', role: 'admin' } })).id
    const buyer = await db.users.create({ data: { username: 'QA member', email: 'renewal@localhost.test' } })
    const game = (name: string, extra = {}) => db.products.create({ data: { slug: 'renewal-' + name, name_th: name, name_en: name, price: 100, type: 'roblox_whitelist', is_active: true, is_consignment: false, ...extra } })
    const games = [await game('one'), await game('two'), await game('desktop', { type: 'desktop_program', program_key: 'qa_renewal' })]
    const membership = await db.products.create({ data: { slug: 'ac-games-membership', name_th: 'Membership', name_en: 'Membership', price: 619, type: 'bundle', is_active: true, is_consignment: false, bundle_all_ac_games: true, bundle_includes_tikkies: true } })
    const collection = await import('../app/api/admin/whitelist/route')
    const item = await import('../app/api/admin/whitelist/[id]/route')
    const { readTikkiesMembership } = await import('../lib/integrations/tikkiesMembership')
    const { syncBundleMembershipInTransaction } = await import('../lib/bundleMembershipSync')
    const { grantManualBundle } = await import('../lib/manualBundleGrant')
    const { claimEmailWhitelistOrders } = await import('../lib/manualWhitelistEmail')
    const { parseBundleSnapshot } = await import('../lib/bundles')
    const request = (body: unknown) => new Request('https://qa.invalid/api/admin/whitelist', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }) as never
    const grant = async (extra = {}) => {
      const response = await collection.POST(request({ userId: buyer.id, productId: membership.id, ign: 'QaRenew', durationDays: 7, isPermanent: false, ...extra }))
      assert.equal(response?.status, 200); return response!.json()
    }
    const parent = (ign: string) => db.orders.findFirstOrThrow({ where: { product_id: membership.id, whitelisted_username: ign, status: 'paid', payment_method: 'admin_manual' }, orderBy: { created_at: 'desc' } })
    const rights = (email = buyer.email!, now = new Date()) => db.$transaction(tx => readTikkiesMembership(tx, email, now))
    await grant()
    const first = await parent('QaRenew')
    const marker = await grant({ durationDays: 30 })
    let renewed = await parent('QaRenew')
    assert.equal(renewed.expires_at!.getTime(), first.expires_at!.getTime() + 30 * DAY, 'Active renewal adds days to the exact previous expiry, preserving fractional days')
    assert.ok(renewed.fulfilled_at! >= first.fulfilled_at!, 'Audit timestamps record the real renewal fulfillment')
    await grant({ durationDays: 2 })
    renewed = await parent('QaRenew')
    assert.equal(renewed.expires_at!.getTime(), first.expires_at!.getTime() + 32 * DAY)
    const expiry = renewed.expires_at!.getTime()
    assert.equal((await rights()).expiresAt, new Date(expiry).toISOString())
    const children = await db.orders.findMany({ where: { bundle_parent_id: renewed.id, status: 'paid' } })
    assert.equal(children.length, 3)
    assert.ok(children.every(child => child.expires_at!.getTime() === expiry))
    assert.ok((await db.user_whitelist_access.findMany({ where: { ign: 'QaRenew' } })).every(access => access.expires_at.getTime() === expiry))
    assert.equal((await db.user_program_access.findUniqueOrThrow({ where: { user_id_product_id: { user_id: buyer.id, product_id: games[2].id } } })).expires_at.getTime(), expiry)
    const future = await game('future')
    const later = new Date(renewed.fulfilled_at!.getTime() + 35 * DAY)
    assert.equal(await db.$transaction(tx => syncBundleMembershipInTransaction(tx, renewed.id, { now: later })), 1)
    assert.equal((await db.orders.findFirstOrThrow({ where: { bundle_parent_id: renewed.id, product_id: future.id } })).expires_at!.getTime(), expiry)
    assert.equal((await rights(buyer.email!, later)).expiresAt, new Date(expiry).toISOString(), 'Tikkies must not cap renewed rights to only the latest added days')
    assert.equal((await rights(buyer.email!, new Date(expiry))).allowed, false)
    assert.equal(await db.$transaction(tx => syncBundleMembershipInTransaction(tx, renewed.id, { now: new Date(expiry) })), 0)
    console.log('PASS active/repeated renewal: exact original expiry + days; games, desktop, full Tikkies and future games agree and expire together')

    const context = { params: Promise.resolve({ id: marker.id }) }
    assert.equal((await item.PATCH(request({ ign: 'QaRenamed' }), context))?.status, 200)
    assert.equal((await parent('QaRenamed')).expires_at!.getTime(), expiry, 'Name-only edit preserves accumulated expiry')
    const renamedMarker = await db.user_whitelist_access.findUniqueOrThrow({ where: { ign_product_id: { ign: 'QaRenamed', product_id: membership.id } } })
    assert.equal((await item.PATCH(request({ durationDays: 2 }), { params: Promise.resolve({ id: renamedMarker.id }) }))?.status, 200)
    const edited = await parent('QaRenamed')
    assert.equal(edited.expires_at!.getTime(), edited.fulfilled_at!.getTime() + 2 * DAY, 'Explicit duration editing still sets remaining time rather than adding it again')
    console.log('PASS editing: rename keeps accumulated time; explicit duration edit does not accidentally repeat the renewal')

    const stale = await db.$transaction(tx => grantManualBundle(tx, { productId: membership.id, userId: buyer.id, email: null, ign: 'QaExpired', actorId: actor, durationDays: 7, isPermanent: false, robloxBinding: {}, now: new Date(Date.now() - 10 * DAY) }))
    assert.ok(stale.order.expires_at! < new Date())
    await grant({ ign: 'QaExpired', durationDays: 30 })
    const restarted = await parent('QaExpired')
    assert.equal(restarted.expires_at!.getTime(), restarted.fulfilled_at!.getTime() + 30 * DAY)
    assert.ok(Math.abs(restarted.fulfilled_at!.getTime() - Date.now()) < 10000)
    console.log('PASS expired membership starts from actual current fulfillment time')

    await grant({ userId: undefined, email: 'pending@localhost.test', ign: 'QaPending', durationDays: 5 })
    const pendingFirst = await parent('QaPending')
    await grant({ userId: undefined, email: ' PENDING@LOCALHOST.TEST ', ign: 'QaPending', durationDays: 30 })
    const pendingRenewed = await parent('QaPending')
    assert.equal(pendingRenewed.expires_at!.getTime(), pendingFirst.expires_at!.getTime() + 30 * DAY)
    assert.equal(await db.users.count({ where: { email: 'pending@localhost.test' } }), 0)
    const owner = await db.users.create({ data: { username: 'Later verified owner', email: 'pending@localhost.test' } })
    assert.ok(await db.$transaction(tx => claimEmailWhitelistOrders(tx, owner.id, owner.email!)) > 0)
    assert.equal((await rights(owner.email!)).expiresAt, pendingRenewed.expires_at!.toISOString())
    assert.equal(await db.orders.count({ where: { bundle_parent_id: pendingRenewed.id, user_id: owner.id, expires_at: pendingRenewed.expires_at } }), 4)
    console.log('PASS pending-email renewal and verified claim retain exact accumulated game/Tikkies expiry, without placeholder users')

    await grant({ userId: undefined, email: 'before-signup@localhost.test', ign: 'QaSignup', durationDays: 5 })
    const beforeSignup = await parent('QaSignup')
    const signedUp = await db.users.create({ data: { username: 'Registered before claim', email: 'before-signup@localhost.test' } })
    await grant({ userId: signedUp.id, ign: 'QaSignup', durationDays: 30 })
    assert.equal((await parent('QaSignup')).expires_at!.getTime(), beforeSignup.expires_at!.getTime() + 30 * DAY, 'Selecting an existing account also retains its still-unclaimed email reservation')

    const paidOwner = await db.users.create({ data: { username: 'Paid membership owner', email: 'paid-member@localhost.test' } })
    const { freezeBundle } = await import('../lib/bundles')
    const { fulfillPaidBundleOrder } = await import('../lib/paidBundleOrder')
    const variant = await db.product_variants.create({ data: { product_id: membership.id, duration_type: 'days', duration_days: 30, price: 619, is_active: true, variant_type: 'normal', label_th: '30 วัน', label_en: '30 days' } })
    const frozen = await freezeBundle(db, membership, variant)
    const paidOrder = await db.orders.create({ data: { user_id: paidOwner.id, product_id: membership.id, variant_id: variant.id, amount: 619, goods_amount: 619, status: 'pending', payment_method: 'card', order_type: 'BUNDLE', whitelisted_username: 'QaPaidBase', bundle_snapshot: frozen } })
    assert.equal(await fulfillPaidBundleOrder(paidOrder.id), 'ok')
    const paidEnd = (await db.orders.findUniqueOrThrow({ where: { id: paidOrder.id } })).expires_at!
    await grant({ userId: paidOwner.id, ign: 'QaPaidBase', durationDays: 7 })
    assert.equal((await parent('QaPaidBase')).expires_at!.getTime(), paidEnd.getTime() + 7 * DAY)
    assert.equal((await rights(paidOwner.email!)).expiresAt, new Date(paidEnd.getTime() + 7 * DAY).toISOString())
    assert.equal((await db.orders.findUniqueOrThrow({ where: { id: paidOrder.id } })).status, 'paid', 'Admin top-up preserves independent paid purchase')
    console.log('PASS account registration before claim and admin top-up of paid membership both retain valid owned remaining time')

    await grant({ ign: 'QaInflated', durationDays: 7 })
    const bounded = await parent('QaInflated')
    await db.orders.update({ where: { id: bounded.id }, data: { expires_at: new Date(FOREVER) } })
    await grant({ ign: 'QaInflated', durationDays: 3 })
    assert.equal((await parent('QaInflated')).expires_at!.getTime(), bounded.expires_at!.getTime() + 3 * DAY, 'Mutable recorded expiry cannot inflate the frozen remaining term')
    console.log('PASS renewal bases are capped by frozen membership terms rather than mutable record expiry')

    await grant({ ign: 'QaPermanent', isPermanent: true })
    await grant({ ign: 'QaPermanent', durationDays: 30 })
    assert.equal((await parent('QaPermanent')).expires_at!.toISOString(), FOREVER)
    const other = await db.users.create({ data: { username: 'Different recipient', email: 'other@localhost.test' } })
    await grant({ ign: 'QaDifferent', durationDays: 365 })
    await grant({ userId: other.id, ign: 'QaDifferent', durationDays: 3 })
    const reassigned = await parent('QaDifferent')
    assert.equal(reassigned.expires_at!.getTime(), reassigned.fulfilled_at!.getTime() + 3 * DAY, 'Another recipient never inherits remaining membership time')
    await grant({ userId: undefined, email: 'first@localhost.test', ign: 'QaOtherEmail', durationDays: 365 })
    await grant({ userId: undefined, email: 'second@localhost.test', ign: 'QaOtherEmail', durationDays: 3 })
    const otherEmail = await parent('QaOtherEmail')
    assert.equal(otherEmail.expires_at!.getTime(), otherEmail.fulfilled_at!.getTime() + 3 * DAY)
    console.log('PASS permanent stays permanent; different users and email reservations never inherit each other\'s remaining days')

    const saved = parseBundleSnapshot(pendingRenewed.bundle_snapshot)
    for (const value of ['invalid', 123, '9999-12-31T00:00:00.000Z', '2026-11-27', null]) assert.throws(() => parseBundleSnapshot({ ...saved, renewalBaseExpiresAt: value }))
    assert.throws(() => parseBundleSnapshot({ ...saved, durationType: 'permanent', durationDays: null }))
    console.log('PASS malformed or overflowing renewal snapshots fail closed')
    assert.equal(await db.point_ledger.count(), 0, 'Points remain disabled in the synthetic payment fixture')
    assert.equal(await db.affiliate_earnings.count(), 0)
  } finally { await db.$disconnect() }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
