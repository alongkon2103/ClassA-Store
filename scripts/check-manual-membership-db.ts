import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'

async function main() {
  const url = 'postgresql://postgres:local-real-membership@127.0.0.1:55433/postgres'
  assert.equal(process.env.MEMBERSHIP_QA_ISOLATED, 'true')
  assert.equal(process.env.DATABASE_URL, url, 'Never run fixtures against the store database')
  const { PrismaClient } = await import('@prisma/client')
  const { PrismaPg } = await import('@prisma/adapter-pg')
  const { default: pg } = await import('pg')
  const db = new PrismaClient({ adapter: new PrismaPg(new pg.Pool({ connectionString: url, max: 1 })) })
  globalThis.prisma = db
  const stub = (name: string, exports: unknown) => {
    const file = require.resolve(name)
    require.cache[file] = { id: file, filename: file, loaded: true, exports } as NodeModule
  }
  let authorized = true
  let adminId = ''
  stub('../lib/adminAuth', { validateAdmin: async () => authorized ? { isValid: true, session: { user: { id: adminId, role: 'admin' } } } : { isValid: false, response: new Response(null, { status: 403 }) } })
  stub('../lib/integrations/tikkiesRoblox', { resolveTikkiesBinding: async (ign: string) => ({ roblox_user_id: '123456789', roblox_username: ign, roblox_resolved_for: ign.toLowerCase() }) })
  globalThis.fetch = (async () => { throw new Error('No external network in disposable QA') }) as typeof fetch
  try {
    const admin = await db.users.create({ data: { username: 'QA admin', email: 'admin@localhost.test', role: 'admin' } })
    adminId = admin.id
    const buyer = await db.users.create({ data: { username: 'QA buyer', email: 'buyer@localhost.test' } })
    const game = (name: string, extra = {}) => db.products.create({ data: { slug: 'qa-' + name, name_en: name, name_th: name, price: 100, type: 'roblox_whitelist', is_active: true, is_consignment: false, ...extra } })
    const games = [await game('one'), await game('two'), await game('desktop', { type: 'desktop_program', program_key: 'qa_desktop' })]
    const partner = await game('partner', { is_consignment: true })
    const inactive = await game('inactive', { is_active: false })
    const membership = await db.products.create({ data: { slug: 'ac-games-membership', name_en: 'Membership', name_th: 'สมาชิก A Class Games', price: 619, type: 'bundle', is_active: true, is_consignment: false, bundle_all_ac_games: true, bundle_includes_tikkies: true } })
    const collection = await import('../app/api/admin/whitelist/route')
    const item = await import('../app/api/admin/whitelist/[id]/route')
    const POST = async (request: never) => { const response = await collection.POST(request); assert.ok(response); return response }
    const PATCH = async (request: never, context: { params: Promise<{ id: string }> }) => { const response = await item.PATCH(request, context); assert.ok(response); return response }
    const DELETE = async (request: never, context: { params: Promise<{ id: string }> }) => { const response = await item.DELETE(request, context); assert.ok(response); return response }
    const { readTikkiesMembership } = await import('../lib/integrations/tikkiesMembership')
    const { syncBundleMembershipInTransaction } = await import('../lib/bundleMembershipSync')
    const { claimEmailWhitelistOrders } = await import('../lib/manualWhitelistEmail')
    const request = (body: unknown) => new Request('https://qa.invalid/api/admin/whitelist', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }) as never
    const input = { userId: buyer.id, productId: membership.id, ign: 'QaMember', durationDays: 7, isPermanent: false, isPremium: true }
    authorized = false
    assert.equal((await POST(request(input))).status, 403)
    assert.equal(await db.orders.count(), 0)
    authorized = true
    const response = await POST(request(input))
    assert.equal(response.status, 200)
    const marker = await response.json()
    const parent = await db.orders.findFirstOrThrow({ where: { product_id: membership.id, user_id: buyer.id } })
    let children = await db.orders.findMany({ where: { bundle_parent_id: parent.id } })
    assert.equal(children.length, 3, 'Manual membership must grant every eligible game, including desktop')
    assert.equal(parent.order_type, 'BUNDLE')
    assert.equal(parent.amount.toString(), '0')
    assert.equal(parent.recorded_by_id, admin.id)
    assert.equal(parent.expires_at!.getTime() - parent.fulfilled_at!.getTime(), 7 * 86400000)
    assert.ok(children.every(child => child.expires_at!.getTime() === parent.expires_at!.getTime()))
    assert.ok(children.every(child => ![partner.id, inactive.id].includes(child.product_id)))
    assert.equal(await db.point_ledger.count(), 0)
    assert.equal(await db.affiliate_earnings.count(), 0)
    const rights = () => db.$transaction(tx => readTikkiesMembership(tx, buyer.email!, new Date()))
    assert.equal((await rights()).expiresAt, parent.expires_at!.toISOString())
    assert.equal((await db.$transaction(tx => readTikkiesMembership(tx, buyer.email!, parent.expires_at!))).allowed, false)
    const next = await game('future')
    assert.equal(await db.$transaction(tx => syncBundleMembershipInTransaction(tx, parent.id)), 1)
    assert.equal(await db.$transaction(tx => syncBundleMembershipInTransaction(tx, parent.id)), 0)
    assert.equal((await db.orders.findFirstOrThrow({ where: { bundle_parent_id: parent.id, product_id: next.id } })).expires_at!.getTime(), parent.expires_at!.getTime())
    console.log('PASS real POST: all games, desktop access, full Tikkies, exact selected duration, future games, expiry, authorization and zero monetary effects')

    const context = { params: Promise.resolve({ id: marker.id }) }
    assert.equal((await PATCH(request({ durationDays: 2, ign: input.ign, productId: membership.id }), context)).status, 200)
    assert.ok(Math.abs(Date.parse((await rights()).expiresAt!) - Date.now() - 2 * 86400000) < 10000)
    children = await db.orders.findMany({ where: { user_id: buyer.id, order_type: 'BUNDLE_GAME', status: 'paid' } })
    assert.ok(children.every(child => Math.abs(child.expires_at!.getTime() - Date.now() - 2 * 86400000) < 10000))
    assert.equal((await DELETE(request({}), context)).status, 200)
    assert.equal((await rights()).allowed, false)
    assert.equal(await db.orders.count({ where: { user_id: buyer.id, order_type: 'BUNDLE_GAME', status: 'paid' } }), 0)
    console.log('PASS membership edit/remove updates all game rights and full Tikkies together')

    const pendingInput = { ...input, userId: undefined, email: ' NEW@LOCALHOST.TEST ', ign: 'QaEmail', durationDays: 5 }
    const pending = await POST(request(pendingInput))
    assert.equal(pending.status, 200)
    assert.equal((await pending.json()).pendingEmail, 'new@localhost.test')
    assert.equal(await db.users.count({ where: { email: 'new@localhost.test' } }), 0, 'No placeholder accounts')
    const reserved = await db.orders.findFirstOrThrow({ where: { product_id: membership.id, buyer_label: 'new@localhost.test', status: 'paid' } })
    assert.equal(reserved.user_id, null)
    assert.equal(await db.orders.count({ where: { bundle_parent_id: reserved.id } }), 3, 'Roblox rights start immediately; account-bound desktop waits for verified claim')
    const later = await game('future-before-claim')
    assert.equal(await db.$transaction(tx => syncBundleMembershipInTransaction(tx, reserved.id)), 1)
    const customer = await db.users.create({ data: { username: 'Verified future login', email: 'new@localhost.test' } })
    assert.equal(await db.$transaction(tx => claimEmailWhitelistOrders(tx, customer.id, 'other@localhost.test')), 0)
    assert.ok(await db.$transaction(tx => claimEmailWhitelistOrders(tx, customer.id, customer.email!)) > 0)
    assert.equal(await db.$transaction(tx => claimEmailWhitelistOrders(tx, customer.id, customer.email!)), 0)
    assert.equal((await db.orders.findUniqueOrThrow({ where: { id: reserved.id } })).expires_at!.getTime(), reserved.expires_at!.getTime(), 'Claim never restarts the term')
    children = await db.orders.findMany({ where: { bundle_parent_id: reserved.id } })
    assert.equal(children.length, 5)
    assert.ok(children.every(child => child.user_id === customer.id))
    assert.ok(children.some(child => child.product_id === later.id))
    assert.ok(await db.user_program_access.findUnique({ where: { user_id_product_id: { user_id: customer.id, product_id: games[2].id } } }))
    assert.equal((await db.$transaction(tx => readTikkiesMembership(tx, customer.email!, new Date()))).expiresAt, reserved.expires_at!.toISOString())
    console.log('PASS unregistered email: immediate Roblox, future games before login, verified claim, all account-bound games/Tikkies, no phantom users and no term restart')

    // A failed replacement must roll back revocation and every partial game grant.
    await db.$executeRawUnsafe(`CREATE FUNCTION qa_fail_grant() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.order_type = 'BUNDLE_GAME' THEN RAISE EXCEPTION 'synthetic grant failure'; END IF; RETURN NEW; END $$`)
    await db.$executeRawUnsafe(`CREATE TRIGGER qa_fail_grant BEFORE INSERT ON orders FOR EACH ROW EXECUTE FUNCTION qa_fail_grant()`)
    const failure = await POST(request({ ...pendingInput, durationDays: 1 }))
    assert.equal(failure.status, 500)
    assert.equal((await db.orders.findUniqueOrThrow({ where: { id: reserved.id } })).status, 'paid')
    assert.equal((await db.$transaction(tx => readTikkiesMembership(tx, customer.email!, new Date()))).expiresAt, reserved.expires_at!.toISOString())
    await db.$executeRawUnsafe('DROP TRIGGER qa_fail_grant ON orders')
    console.log('PASS failed membership replacement rolls back parent revocation and partial game writes')

    const { freezeBundle } = await import('../lib/bundles')
    const { fulfillPaidOrder } = await import('../lib/orderFulfillment')
    const variant = await db.product_variants.create({ data: { product_id: membership.id, duration_type: 'days', duration_days: 30, is_active: true, variant_type: 'normal', price: 619, label_en: '30 days', label_th: '30 วัน' } })
    const snapshot = await freezeBundle(db, membership, variant)
    const paid = await db.orders.create({ data: { user_id: buyer.id, product_id: membership.id, variant_id: variant.id, amount: 619, goods_amount: 619, payment_method: 'card', status: 'pending', order_type: 'BUNDLE', whitelisted_username: 'QaPaid', bundle_snapshot: snapshot, roblox_user_id: '123456789', roblox_resolved_for: 'qapaid' } })
    assert.equal(await fulfillPaidOrder(paid.id), 'ok')
    assert.equal(await fulfillPaidOrder(paid.id), 'already_paid')
    const paidChildren = await db.orders.findMany({ where: { bundle_parent_id: paid.id } })
    assert.equal(paidChildren.length, 5)
    assert.ok(paidChildren.every(child => child.status === 'paid' && child.user_id === buyer.id))
    assert.equal((await rights()).allowed, true)
    console.log('PASS payment shared entry point: confirmed parent grants all games/full Tikkies and repeated confirmation is idempotent')

    // Exercise the production Stripe HTTP handler with authentic SDK-generated
    // local signatures. No real payment, provider account or network is used.
    const { default: Stripe } = await import('stripe')
    const { NextRequest } = await import('next/server')
    process.env.STRIPE_SECRET_KEY = 'sk_test_synthetic_membership_qa'
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_synthetic_membership_qa'
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
    let signature: string | null = null
    stub('next/headers', { headers: async () => new Headers(signature ? { 'stripe-signature': signature } : {}) })
    const webhook = (await import('../app/api/webhook/route')).POST
    const stripeParent = await db.orders.create({ data: { user_id: buyer.id, product_id: membership.id, variant_id: variant.id, amount: 619, goods_amount: 619, payment_method: 'card', stripe_session_id: 'cs_synthetic_qa', status: 'pending', order_type: 'BUNDLE', whitelisted_username: 'QaStripe', bundle_snapshot: snapshot } })
    const session = { id: 'cs_synthetic_qa', mode: 'payment', payment_status: 'paid', currency: 'thb', amount_total: 61900, payment_intent: 'pi_synthetic_qa', metadata: { orderId: stripeParent.id, productId: membership.id } }
    const stripeRequest = (patch = {}, signed = true) => {
      const payload = JSON.stringify({ id: 'evt_synthetic_qa', object: 'event', type: 'checkout.session.completed', data: { object: { ...session, ...patch } } })
      signature = signed ? stripe.webhooks.generateTestHeaderString({ payload, secret: process.env.STRIPE_WEBHOOK_SECRET! }) : null
      return new NextRequest('https://qa.invalid/api/webhook', { method: 'POST', body: payload })
    }
    assert.equal((await webhook(stripeRequest({}, false))).status, 400)
    assert.equal((await webhook(stripeRequest({ amount_total: 1 }))).status, 400)
    assert.equal((await webhook(stripeRequest({ payment_status: 'unpaid' }))).status, 200)
    assert.equal(await db.orders.count({ where: { bundle_parent_id: stripeParent.id } }), 0)
    assert.equal((await webhook(stripeRequest())).status, 200)
    assert.equal((await webhook(stripeRequest())).status, 200)
    assert.equal(await db.orders.count({ where: { bundle_parent_id: stripeParent.id, status: 'paid' } }), 5)
    console.log('PASS actual Stripe webhook + DB: signature required, unpaid/wrong amount denied, successful payment grants every game, replay no duplicates')

    let captures = 0
    let currency = 'THB'
    stub('../lib/paypal', { capturePayPalOrder: async () => { captures++; return { status: 'COMPLETED', captureId: 'qa_capture', amount: { value: '20.00', currency } } } })
    const paypal = (await import('../app/api/checkout/paypal/capture/route')).GET
    const paypalParent = await db.orders.create({ data: { user_id: buyer.id, product_id: membership.id, variant_id: variant.id, amount: 619, goods_amount: 619, payment_method: 'paypal', paypal_order_id: 'qa_paypal_order', expected_amount: 20, expected_currency: 'USD', status: 'pending', order_type: 'BUNDLE', whitelisted_username: 'QaPaypal', bundle_snapshot: snapshot } })
    const paypalRequest = (token = 'qa_paypal_order') => new NextRequest(`https://qa.invalid/api/checkout/paypal/capture?orderId=${paypalParent.id}&token=${token}&locale=th`, { headers: { host: 'qa.invalid', 'x-forwarded-proto': 'https' } })
    assert.match((await paypal(paypalRequest('wrong'))).headers.get('location')!, /paypal=mismatch/)
    assert.equal(captures, 0)
    assert.match((await paypal(paypalRequest())).headers.get('location')!, /paypal=mismatch/)
    assert.equal(await db.orders.count({ where: { bundle_parent_id: paypalParent.id } }), 0)
    currency = 'USD'
    await paypal(paypalRequest())
    await paypal(paypalRequest())
    assert.equal(captures, 2, 'Already fulfilled return does not capture again')
    assert.equal(await db.orders.count({ where: { bundle_parent_id: paypalParent.id, status: 'paid' } }), 5)
    console.log('PASS actual PayPal return + DB with synthetic provider capture: wrong token/currency denied, completed matching capture grants all games, replay no recapture')

    const left = await (await POST(request({ ...input, ign: 'QaRenameA' }))).json()
    await POST(request({ ...input, userId: customer.id, ign: 'QaRenameB' }))
    assert.equal((await PATCH(request({ ign: 'QaRenameB' }), { params: Promise.resolve({ id: left.id }) })).status, 409, 'Renaming must never replace another membership at the destination')
    assert.equal(await db.orders.count({ where: { product_id: membership.id, whitelisted_username: { in: ['QaRenameA', 'QaRenameB'] }, status: 'paid' } }), 2)
    console.log('PASS membership rename collision preserves both recipients and returns 409')

    const excluded = await (await POST(request({ ...input, ign: 'QaExclusion' }))).json()
    const excludedParent = await db.orders.findFirstOrThrow({ where: { product_id: membership.id, whitelisted_username: 'QaExclusion', status: 'paid' } })
    const removedGame = await db.user_whitelist_access.findUniqueOrThrow({ where: { ign_product_id: { ign: 'QaExclusion', product_id: games[0].id } } })
    assert.equal((await DELETE(request({}), { params: Promise.resolve({ id: removedGame.id }) })).status, 200)
    await db.products.update({ where: { id: membership.id }, data: { bundle_all_ac_games: false, bundle_includes_tikkies: false, bundle_product_ids: games.map(game => game.id) } })
    assert.equal((await PATCH(request({ durationDays: 3 }), { params: Promise.resolve({ id: excluded.id }) })).status, 200)
    assert.equal(await db.user_whitelist_access.count({ where: { ign: 'QaExclusion', product_id: games[0].id } }), 0, 'Editing does not restore removed games')
    const editedParent = await db.orders.findFirstOrThrow({ where: { product_id: membership.id, whitelisted_username: 'QaExclusion', status: 'paid' } })
    assert.deepEqual(Object.assign({}, editedParent.bundle_snapshot, { durationDays: 7 }), excludedParent.bundle_snapshot, 'Only explicit duration changes; frozen inclusion/full-app terms survive catalog edits')
    await db.$transaction(tx => syncBundleMembershipInTransaction(tx, editedParent.id))
    assert.equal(await db.user_whitelist_access.count({ where: { ign: 'QaExclusion', product_id: games[0].id } }), 0, 'Future-game worker preserves exclusion')
    await db.products.update({ where: { id: membership.id }, data: { bundle_all_ac_games: true, bundle_includes_tikkies: true } })
    console.log('PASS membership edits preserve frozen terms and individually removed game exclusions through future sync')

    const permanent = await POST(request({ ...input, isPermanent: true, ign: 'QaForever' }))
    assert.equal(permanent.status, 200)
    assert.equal((await rights()).expiresAt, '9999-12-31T00:00:00.000Z')
    assert.equal((await POST(request({ ...input, productId: randomUUID() }))).status, 400)
    assert.equal((await POST(request({ ...input, ign: 'bad name' }))).status, 400)
    const single = await POST(request({ ...input, productId: games[0].id, ign: 'QaSingle' }))
    assert.equal(single.status, 200)
    assert.equal((await db.orders.findFirstOrThrow({ where: { whitelisted_username: 'QaSingle' } })).order_type, 'TRIAL')
    console.log('PASS permanent membership, invalid product/IGN validation and unchanged individual-game grants')
  } finally { await db.$disconnect() }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
