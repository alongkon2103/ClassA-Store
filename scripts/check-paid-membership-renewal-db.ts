import assert from 'node:assert/strict'

const DAY = 86400000
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
  stub('../lib/integrations/tikkiesRoblox', { resolveTikkiesBinding: async (ign: string) => ({ roblox_user_id: '123456789', roblox_username: ign, roblox_resolved_for: ign.toLowerCase() }) })
  globalThis.fetch = (async () => { throw new Error('No network in disposable paid renewal QA') }) as typeof fetch
  try {
    const buyer = await db.users.create({ data: { username: 'Synthetic paid member', email: 'paid-renewal@localhost.test' } })
    const admin = await db.users.create({ data: { username: 'Synthetic admin', role: 'admin' } })
    const game = (name: string, extra = {}) => db.products.create({ data: { slug: 'paid-renewal-' + name, name_en: name, name_th: name, price: 100, type: 'roblox_whitelist', is_active: true, is_consignment: false, ...extra } })
    const games = [await game('one'), await game('two'), await game('desktop', { type: 'desktop_program', program_key: 'qa_paid_renewal' })]
    const membership = await db.products.create({ data: { slug: 'ac-games-membership', name_en: 'Membership', name_th: 'Membership', price: 100, type: 'bundle', is_active: true, is_consignment: false, bundle_all_ac_games: true, bundle_includes_tikkies: true } })
    for (const [key, value] of Object.entries({ points_enabled: 'true', points_per_baht: '1', points_start_at: '2000-01-01T00:00:00Z' })) await db.system_configs.create({ data: { key, value } })
    const { freezeBundle } = await import('../lib/bundles')
    const { fulfillPaidOrder } = await import('../lib/orderFulfillment')
    const { fulfillBundleInTransaction } = await import('../lib/bundleFulfillment')
    const { readTikkiesMembership } = await import('../lib/integrations/tikkiesMembership')
    const { syncBundleMembershipInTransaction } = await import('../lib/bundleMembershipSync')
    const { grantManualBundle } = await import('../lib/manualBundleGrant')
    let sequence = 0
    const draft = async (ign: string, days = 30, method = 'card', userId = buyer.id, product = membership, permanent = false) => {
      const variant = await db.product_variants.create({ data: { product_id: product.id, duration_type: permanent ? 'permanent' : 'days', duration_days: permanent ? null : days, is_active: true, variant_type: 'normal', price: 100, label_en: 'Synthetic package', label_th: 'Synthetic package' } })
      const snapshot = await freezeBundle(db, product, variant)
      return db.orders.create({ data: { user_id: userId, product_id: product.id, variant_id: variant.id, amount: 100, goods_amount: 100, order_type: 'BUNDLE', status: 'pending', payment_method: method, stripe_session_id: 'cs_paid_renewal_' + ++sequence, whitelisted_username: ign, bundle_snapshot: snapshot } })
    }
    const read = (id: string) => db.orders.findUniqueOrThrow({ where: { id } })
    const rights = (email = buyer.email!, now = new Date()) => db.$transaction(tx => readTikkiesMembership(tx, email, now))
    const { default: Stripe } = await import('stripe')
    const { NextRequest } = await import('next/server')
    process.env.STRIPE_SECRET_KEY = 'sk_test_synthetic_paid_renewal'
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_synthetic_paid_renewal'
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
    let signature: string | null = null
    stub('next/headers', { headers: async () => new Headers(signature ? { 'stripe-signature': signature } : {}) })
    const webhook = (await import('../app/api/webhook/route')).POST
    const confirm = (order: Awaited<ReturnType<typeof draft>>, patch = {}, signed = true) => {
      const payload = JSON.stringify({ id: 'evt_synthetic', object: 'event', type: 'checkout.session.completed', data: { object: { id: order.stripe_session_id, mode: 'payment', payment_status: 'paid', currency: 'thb', amount_total: 10000, payment_intent: 'pi_' + order.id, metadata: { orderId: order.id, productId: order.product_id }, ...patch } } })
      signature = signed ? stripe.webhooks.generateTestHeaderString({ payload, secret: process.env.STRIPE_WEBHOOK_SECRET! }) : null
      return webhook(new NextRequest('https://qa.invalid/api/webhook', { method: 'POST', body: payload }))
    }
    const first = await draft('QaPaidRenew', 10)
    assert.equal((await confirm(first)).status, 200)
    const original = await read(first.id)
    const second = await draft('QaPaidRenew')
    assert.equal((await confirm(second, {}, false)).status, 400)
    assert.equal((await confirm(second, { amount_total: 1 })).status, 400)
    assert.equal((await confirm(second, { payment_status: 'unpaid' })).status, 200)
    assert.equal((await read(second.id)).status, 'pending')
    assert.equal(await db.orders.count({ where: { bundle_parent_id: second.id } }), 0)
    assert.equal((await confirm(second)).status, 200)
    const renewed = await read(second.id)
    assert.equal(renewed.expires_at!.getTime(), original.expires_at!.getTime() + 30 * DAY, 'Paid renewal adds purchased days to original expiry')
    assert.ok(renewed.fulfilled_at! >= original.fulfilled_at!)
    assert.equal((await rights()).expiresAt, renewed.expires_at!.toISOString())
    assert.ok((await db.orders.findMany({ where: { bundle_parent_id: second.id } })).every(child => child.expires_at!.getTime() === renewed.expires_at!.getTime()))
    assert.equal((await db.user_program_access.findUniqueOrThrow({ where: { user_id_product_id: { user_id: buyer.id, product_id: games[2].id } } })).expires_at.getTime(), renewed.expires_at!.getTime())
    const ledgerCount = await db.point_ledger.count()
    assert.equal(ledgerCount, 2, 'Each confirmed purchase earns points exactly once')
    assert.equal((await confirm(second)).status, 200)
    assert.equal((await read(second.id)).expires_at!.getTime(), renewed.expires_at!.getTime())
    assert.equal(await db.orders.count({ where: { bundle_parent_id: second.id } }), 3)
    assert.equal(await db.point_ledger.count(), ledgerCount)
    assert.equal((await read(first.id)).status, 'paid')
    const future = await game('future')
    const later = new Date(renewed.fulfilled_at!.getTime() + 35 * DAY)
    assert.equal(await db.$transaction(tx => syncBundleMembershipInTransaction(tx, second.id, { now: later })), 1)
    assert.equal((await db.orders.findFirstOrThrow({ where: { bundle_parent_id: second.id, product_id: future.id } })).expires_at!.getTime(), renewed.expires_at!.getTime())
    assert.equal((await rights(buyer.email!, later)).expiresAt, renewed.expires_at!.toISOString())
    assert.equal((await rights(buyer.email!, renewed.expires_at!)).allowed, false)
    console.log('PASS actual signed Stripe webhook: active renewal stacks exactly; invalid/unpaid denied; replay preserves expiry, games and points; future games/full Tikkies share the end')

    let captures = 0, currency = 'THB'
    stub('../lib/paypal', { capturePayPalOrder: async () => { captures++; return { status: 'COMPLETED', captureId: 'synthetic_paid_renewal_capture', amount: { value: '20.00', currency } } } })
    const paypal = (await import('../app/api/checkout/paypal/capture/route')).GET
    const paypalOrder = await draft('QaPaidRenew', 30, 'paypal')
    await db.orders.update({ where: { id: paypalOrder.id }, data: { paypal_order_id: 'synthetic_paypal_renewal', expected_amount: 20, expected_currency: 'USD' } })
    const paypalReq = (token = 'synthetic_paypal_renewal') => new NextRequest(`https://qa.invalid/api/checkout/paypal/capture?orderId=${paypalOrder.id}&token=${token}&locale=th`, { headers: { host: 'qa.invalid', 'x-forwarded-proto': 'https' } })
    assert.match((await paypal(paypalReq('wrong'))).headers.get('location')!, /mismatch/)
    assert.equal(captures, 0)
    assert.match((await paypal(paypalReq())).headers.get('location')!, /mismatch/)
    assert.equal((await read(paypalOrder.id)).status, 'pending')
    currency = 'USD'
    await paypal(paypalReq())
    const paypalPaid = await read(paypalOrder.id)
    assert.equal(paypalPaid.expires_at!.getTime(), renewed.expires_at!.getTime() + 30 * DAY)
    await paypal(paypalReq())
    assert.equal(captures, 2)
    assert.equal((await read(paypalOrder.id)).expires_at!.getTime(), paypalPaid.expires_at!.getTime())
    assert.equal((await rights()).expiresAt, paypalPaid.expires_at!.toISOString())
    const paypalMe = await draft('QaPaidRenew', 30, 'paypal_me')
    assert.equal(await fulfillPaidOrder(paypalMe.id), 'ok')
    assert.equal((await read(paypalMe.id)).expires_at!.getTime(), paypalPaid.expires_at!.getTime() + 30 * DAY)
    assert.equal(await fulfillPaidOrder(paypalMe.id), 'already_paid')
    console.log('PASS actual PayPal return + synthetic capture and PayPal.me shared fulfillment: cross-provider renewals stack; invalid terms/replays do not add days')

    const expired = await draft('QaExpiredPaid', 7)
    await db.$transaction(tx => fulfillBundleInTransaction(tx, expired.id, { now: new Date(Date.now() - 10 * DAY) }))
    const restart = await draft('QaExpiredPaid')
    await fulfillPaidOrder(restart.id)
    const restarted = await read(restart.id)
    assert.equal(restarted.expires_at!.getTime(), restarted.fulfilled_at!.getTime() + 30 * DAY)
    const other = await db.users.create({ data: { username: 'Different customer', email: 'other-paid@localhost.test' } })
    for (const order of [await draft('QaPaidRenew', 3, 'card', other.id), await draft('QaAnotherPlayer', 3)]) {
      await fulfillPaidOrder(order.id)
      const paid = await read(order.id)
      assert.equal(paid.expires_at!.getTime(), paid.fulfilled_at!.getTime() + 3 * DAY)
    }
    console.log('PASS expired membership starts now; another customer or player never inherits remaining time')

    const manual = await db.$transaction(tx => grantManualBundle(tx, { productId: membership.id, userId: buyer.id, email: null, ign: 'QaManualPaid', actorId: admin.id, durationDays: 7, isPermanent: false, robloxBinding: {} }))
    const afterManual = await draft('QaManualPaid')
    await fulfillPaidOrder(afterManual.id)
    const cross = await read(afterManual.id)
    assert.equal(cross.expires_at!.getTime(), manual.order.expires_at!.getTime() + 30 * DAY)
    const manualAgain = await db.$transaction(tx => grantManualBundle(tx, { productId: membership.id, userId: buyer.id, email: null, ign: 'QaManualPaid', actorId: admin.id, durationDays: 2, isPermanent: false, robloxBinding: {} }))
    assert.equal(manualAgain.order.expires_at!.getTime(), cross.expires_at!.getTime() + 2 * DAY)
    console.log('PASS admin/store cross-renewal uses one frozen term calculation')

    const otherMembership = await db.products.create({ data: { slug: 'separate-membership', name_en: 'Separate membership', name_th: 'Separate membership', price: 100, type: 'bundle', is_active: true, is_consignment: false, bundle_all_ac_games: true, bundle_includes_tikkies: true } })
    const separate = await draft('QaPaidRenew', 3, 'card', buyer.id, otherMembership)
    await fulfillPaidOrder(separate.id)
    const separatePaid = await read(separate.id)
    assert.equal(separatePaid.expires_at!.getTime(), separatePaid.fulfilled_at!.getTime() + 3 * DAY, 'A different membership product never inherits this package\'s remaining time')

    const refundBuyer = await db.users.create({ data: { username: 'Synthetic refund owner', email: 'paid-refund@localhost.test' } })
    const beforeRefund = await draft('QaRefundRenewal', 10, 'card', refundBuyer.id)
    await fulfillPaidOrder(beforeRefund.id)
    const originalRefundEnd = (await read(beforeRefund.id)).expires_at!
    const refundRenewal = await draft('QaRefundRenewal', 30, 'card', refundBuyer.id)
    await fulfillPaidOrder(refundRenewal.id)
    const { recordTikkiesReversal } = await import('../lib/integrations/tikkiesReversal')
    await recordTikkiesReversal(refundRenewal.id, 'refunded')
    assert.equal((await rights(refundBuyer.email!)).expiresAt, originalRefundEnd.toISOString())
    assert.equal((await db.user_program_access.findUniqueOrThrow({ where: { user_id_product_id: { user_id: refundBuyer.id, product_id: games[2].id } } })).expires_at.getTime(), originalRefundEnd.getTime())
    const afterRefund = await draft('QaRefundRenewal', 5, 'card', refundBuyer.id)
    await fulfillPaidOrder(afterRefund.id)
    assert.equal((await read(afterRefund.id)).expires_at!.getTime(), originalRefundEnd.getTime() + 5 * DAY, 'Refunded renewal cannot supply remaining time to a new purchase')
    console.log('PASS product separation and refund of a renewal: prior membership survives, refunded days cannot extend the next purchase')

    const queued = [await draft('QaQueued'), await draft('QaQueued')]
    await db.$executeRawUnsafe(`CREATE FUNCTION qa_fail_paid_renewal() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.bundle_parent_id = '${queued[0].id}'::uuid THEN RAISE EXCEPTION 'synthetic paid grant failure'; END IF; RETURN NEW; END $$`)
    await db.$executeRawUnsafe('CREATE TRIGGER qa_fail_paid_renewal BEFORE INSERT ON orders FOR EACH ROW EXECUTE FUNCTION qa_fail_paid_renewal()')
    await assert.rejects(fulfillPaidOrder(queued[0].id))
    assert.equal((await read(queued[0].id)).status, 'pending')
    assert.equal((await read(queued[0].id)).bundle_snapshot && 'renewalBaseExpiresAt' in ((await read(queued[0].id)).bundle_snapshot as object), false)
    assert.equal(await db.orders.count({ where: { bundle_parent_id: queued[0].id } }), 0)
    await db.$executeRawUnsafe('DROP TRIGGER qa_fail_paid_renewal ON orders')
    await Promise.all(queued.map(order => fulfillPaidOrder(order.id)))
    const committed = await Promise.all(queued.map(order => read(order.id)))
    const ordered = committed.sort((a, b) => a.expires_at!.getTime() - b.expires_at!.getTime())
    assert.equal(ordered[1].expires_at!.getTime(), ordered[0].expires_at!.getTime() + 30 * DAY)
    assert.equal(await db.orders.count({ where: { bundle_parent_id: { in: queued.map(order => order.id) } } }), 8)
    console.log('PASS failed payment fulfillment rolls back terms/children; two queued purchases retain both periods on retry (single-backend PGlite)')

    const lifetime = await draft('QaPaidLifetime', 30, 'card', buyer.id, membership, true)
    await fulfillPaidOrder(lifetime.id)
    const finite = await draft('QaPaidLifetime')
    await fulfillPaidOrder(finite.id)
    assert.equal((await read(finite.id)).expires_at!.toISOString(), '9999-12-31T00:00:00.000Z')
    console.log('PASS lifetime membership is never shortened by a finite repeat purchase')
  } finally { await db.$disconnect() }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
