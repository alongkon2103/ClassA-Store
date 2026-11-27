/** Actual Prisma/PostgreSQL-compatible transactions, constraints and HTTP route
 * checks against the one disposable QA DB. Launch via .codex/real-membership-db-qa.cjs. */
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { createServer, type Server } from 'node:http'
import type { Prisma } from '@prisma/client'

async function main() {
  const expected = 'postgresql://postgres:local-real-membership@127.0.0.1:55433/postgres'
  assert.equal(process.env.MEMBERSHIP_QA_ISOLATED, 'true', 'Use the isolated launcher')
  assert.equal(process.env.DATABASE_URL, expected, 'Refusing every non-QA database')
  assert.ok(process.env.DOTENV_CONFIG_PATH?.endsWith('NO-REAL-ENV-FOR-MEMBERSHIP-QA.env'), 'Default .env loading must be disabled')
  const { PrismaClient } = await import('@prisma/client')
  const { PrismaPg } = await import('@prisma/adapter-pg')
  const { default: pg } = await import('pg')
  const pool = new pg.Pool({ connectionString: expected, max: 1, connectionTimeoutMillis: 5000 })
  const db = new PrismaClient({ adapter: new PrismaPg(pool) })
  globalThis.prisma = db
  const realFetch = globalThis.fetch
  let forbiddenRequests = 0
  globalThis.fetch = (async (input, init) => {
    const url = new URL(typeof input === 'string' || input instanceof URL ? input.toString() : input.url)
    if (url.origin !== 'http://127.0.0.1:3112') { forbiddenRequests++; throw new Error('External networking is forbidden in membership DB QA') }
    return realFetch(input, init)
  }) as typeof fetch
  let http: Server | undefined
  try {
    const { freezeBundle } = await import('../lib/bundles')
    const { fulfillBundleInTransaction } = await import('../lib/bundleFulfillment')
    const { fulfillPaidBundleOrder } = await import('../lib/paidBundleOrder')
    const { syncBundleMembershipInTransaction } = await import('../lib/bundleMembershipSync')
    const { recordTikkiesReversal } = await import('../lib/integrations/tikkiesReversal')
    const { readTikkiesMembership } = await import('../lib/integrations/tikkiesMembership')
    const { readTikkiesLibrary } = await import('../lib/integrations/tikkiesLibrary')
    const { readTikkiesEntitlements } = await import('../lib/integrations/tikkies')
    const { runMembershipBatch } = await import('../worker/membershipWorker')
    const { awardPointsForOrder } = await import('../lib/points')
    const admin = await db.users.create({ data: { username: 'Synthetic Membership Admin', email: 'qa-admin@localhost.test', role: 'user' } })
    const shopper = await db.users.create({ data: { username: 'Synthetic Nonmember', email: 'qa-user@localhost.test', role: 'user' } })
    const providerId = 'synthetic-google-membership-qa'
    await db.accounts.create({ data: { user_id: admin.id, provider: 'google', provider_account_id: providerId } })
    await db.accounts.create({data:{user_id:admin.id,provider:'discord',provider_account_id:'synthetic-discord-membership-qa'}})
    const ownedIdentities=[{provider:'google' as const,providerAccountId:providerId},{provider:'discord' as const,providerAccountId:'synthetic-discord-membership-qa'}]
    const game = async (name: string, extra: Partial<Prisma.productsUncheckedCreateInput> = {}) => db.products.create({ data: {
      id: randomUUID(), slug: `qa-${name}`, name_th: `Synthetic ${name}`, name_en: `Synthetic ${name}`, price: 100,
      type: 'roblox_whitelist', is_active: true, is_consignment: false,
      roblox_universe_id: String(100000 + Math.floor(Math.random() * 100000)), roblox_place_ids: [String(200000 + Math.floor(Math.random() * 100000))],
      ...extra,
    } })
    const games = [await game('own-one'), await game('own-two'), await game('desktop', { type: 'desktop_program', program_key: 'synthetic_qa_desktop' })]
    const partner = await game('partner', { is_consignment: true })
    const inactive = await game('inactive', { is_active: false })
    const bundle = await db.products.create({ data: { slug: 'ac-games-membership', name_th: 'Synthetic membership', name_en: 'Synthetic membership', price: 669,
      type: 'bundle', is_active: true, is_consignment: false, bundle_all_ac_games: true, bundle_includes_tikkies: true, bundle_product_ids: [] } })
    const variant = await db.product_variants.create({ data: { product_id: bundle.id, duration_type: 'days', duration_days: 30, label_th: '30 days', label_en: '30 days', price: 669, is_active: true, variant_type: 'normal' } })
    await db.$executeRaw`CREATE TABLE IF NOT EXISTS tikkies_checkout_codes (code_hash text PRIMARY KEY,user_id uuid REFERENCES users(id),challenge text NOT NULL,offer jsonb NOT NULL,expires_at timestamptz NOT NULL)`
    const {issueBrowserCheckout,startBrowserCheckout,confirmBrowserCheckout}=await import('../lib/tikkiesBrowserCheckout')
    const {ensureNativeStoreCustomer}=await import('../lib/tikkiesBrowserCheckout')
    assert.equal(typeof ensureNativeStoreCustomer,'function','fresh native OAuth automatically binds the same store owner')
    for(const provider of ['google','discord'] as const){
      const email=`first-${provider}@localhost.test`, other=provider==='google'?'discord':'google'
      const customer=await db.users.create({data:{email,username:'Synthetic first-link buyer',role:'user'}})
      await db.accounts.create({data:{user_id:customer.id,provider:other,provider_account_id:'website-'+provider}})
      const identity={provider,providerAccountId:'native-'+provider,name:'Synthetic native buyer',image:null,verifiedEmail:email,verifiedAt:Math.floor(Date.now()/1000)}
      const owned=[{provider,providerAccountId:identity.providerAccountId}]
      await db.$transaction(tx=>ensureNativeStoreCustomer(tx,identity,owned))
      await db.$transaction(tx=>ensureNativeStoreCustomer(tx,identity,owned))
      assert.equal((await db.accounts.findUniqueOrThrow({where:{provider_provider_account_id:{provider,provider_account_id:identity.providerAccountId}}})).user_id,customer.id)
      assert.equal(await db.users.count({where:{email}}),1)
      await assert.rejects(db.$transaction(tx=>ensureNativeStoreCustomer(tx,{...identity,providerAccountId:'stale-'+provider,verifiedAt:1},[{provider,providerAccountId:'stale-'+provider}])),/identity_verification_required/)
      await assert.rejects(db.$transaction(tx=>ensureNativeStoreCustomer(tx,{...identity,providerAccountId:'unverified-'+provider,verifiedEmail:undefined,verifiedAt:undefined},[{provider,providerAccountId:'unverified-'+provider}])),/identity_verification_required/)
    }
    const first={provider:'google' as const,providerAccountId:'first-native-new',name:'Native first',image:null,verifiedEmail:'native-first@localhost.test',verifiedAt:Math.floor(Date.now()/1000)}
    const firstLinked=await db.$transaction(tx=>ensureNativeStoreCustomer(tx,first,[{provider:first.provider,providerAccountId:first.providerAccountId}]))
    assert.equal((await db.users.findUniqueOrThrow({where:{id:firstLinked.id}})).role,'user')
    assert.equal(await db.users.count({where:{email:first.verifiedEmail}}),1)
    console.log('PASS real DB first native Google/Discord login binds existing opposite-provider buyer; native-first provisions one ordinary customer; stale/unverified denied')
    const {decode}=await import('next-auth/jwt')
    const previousSite=process.env.NEXTAUTH_URL;process.env.NEXTAUTH_URL='https://qa-store.invalid'
    try{for(const identity of ownedIdentities){
     const link=await issueBrowserCheckout(db,admin.email!,{code:`bundle:${bundle.id}:${variant.id}`,priceTHB:669,days:30},'en',{...identity,name:'Synthetic native buyer',image:null},ownedIdentities)
     const started=await startBrowserCheckout(db,new URL(link.url).hash.slice(8));const confirmed=await confirmBrowserCheckout(db,started.token,started.preview.nonce)
     const token=await decode({token:confirmed!.token,secret:process.env.NEXTAUTH_SECRET!});assert.equal(token!.id,admin.id);assert.equal(token!.role,'user');assert.equal(token!.provider,identity.provider)
    }}finally{process.env.NEXTAUTH_URL=previousSite}
    console.log('PASS actual DB native Google/Discord handoff signs the same ordinary store customer before purchase')
    for (const [key, value] of Object.entries({ points_enabled: 'true', points_per_baht: '10', points_start_at: '2000-01-01T00:00:00Z' })) await db.system_configs.create({ data: { key, value } })
    const frozen = await freezeBundle(db, bundle, variant)
    assert.equal(frozen.allAcGames, true)
    assert.equal(frozen.tikkiesMembership, true)
    assert.equal(frozen.items.length, 3)
    assert.ok(frozen.items.every(item => ![partner.id, inactive.id].includes(item.productId)))
    const forever = new Date('9999-12-31T00:00:00Z')
    await db.user_program_access.create({ data: { user_id: admin.id, product_id: games[2].id, expires_at: forever, status: 'ACTIVE' } })
    const makeParent = async (username: string, userId = admin.id) => db.orders.create({ data: { user_id: userId, product_id: bundle.id, variant_id: variant.id,
      amount: 669, goods_amount: 669, discount_amount: 0, status: 'pending', order_type: 'BUNDLE', payment_method: 'local_synthetic',
      bundle_snapshot: frozen, whitelisted_username: username, roblox_user_id: '123456789', roblox_username: username, roblox_display_name: 'Synthetic QA', roblox_resolved_for: username.toLowerCase(),
    } })
    const rollback = await makeParent('QARollback', shopper.id)
    await assert.rejects(db.$transaction(async tx => { await fulfillBundleInTransaction(tx, rollback.id); throw new Error('injected post-grant rollback') }, { timeout: 60000 }), /injected post-grant rollback/)
    assert.equal(await db.orders.count({ where: { bundle_parent_id: rollback.id } }), 0)
    assert.equal((await db.orders.findUniqueOrThrow({ where: { id: rollback.id } })).status, 'pending')
    assert.equal(await db.user_whitelist_access.count({ where: { ign: 'QARollback' } }), 0)
    assert.equal(await db.user_program_access.count({ where: { user_id: shopper.id } }), 0)
    await db.orders.delete({ where: { id: rollback.id } })
    console.log('PASS actual DB transaction rolls back children, parent and both aggregate access types')

    const parent = await makeParent('QAMembership')
    const paid = await Promise.all([fulfillPaidBundleOrder(parent.id), fulfillPaidBundleOrder(parent.id)])
    assert.deepEqual(paid.sort(), ['already_paid', 'ok'])
    let children = await db.orders.findMany({ where: { bundle_parent_id: parent.id } })
    assert.equal(children.length, 3)
    assert.ok(children.every(child => child.status === 'paid' && child.order_type === 'BUNDLE_GAME' && Number(child.amount) === 0 && Number(child.goods_amount) === 0))
    const committed = await db.orders.findUniqueOrThrow({ where: { id: parent.id } })
    assert.ok(committed.paid_at && committed.fulfilled_at && committed.expires_at)
    const originalExpiry = committed.expires_at.toISOString()
    assert.equal(committed.expires_at.getTime() - committed.paid_at.getTime(), 30 * 86400000)
    const program = await db.user_program_access.findUniqueOrThrow({ where: { user_id_product_id: { user_id: admin.id, product_id: games[2].id } } })
    assert.equal(program.expires_at.toISOString(), forever.toISOString())
    await assert.rejects(db.orders.create({ data: { user_id: admin.id, product_id: games[0].id, bundle_parent_id: parent.id, amount: 0, status: 'paid', order_type: 'BUNDLE_GAME' } }), (error: unknown) => (error as { code: string }).code === 'P2002')
    await assert.rejects(db.orders.create({ data: { user_id: admin.id, product_id: randomUUID(), amount: 0, status: 'paid' } }), (error: unknown) => (error as { code: string }).code === 'P2003')
    const positive = await db.orders.aggregate({ where: { status: 'paid' }, _sum: { amount: true, goods_amount: true } })
    assert.equal(Number(positive._sum.amount), 669)
    assert.equal(Number(positive._sum.goods_amount), 669)
    assert.equal(await db.point_ledger.count({ where: { type: 'earn_purchase' } }), 1)
    assert.equal(Number((await db.point_ledger.aggregate({ _sum: { delta: true } }))._sum.delta), 6690)
    assert.equal(await db.affiliate_earnings.count(), 0)
    console.log('PASS actual parent payment retries, DB unique/FK constraints, 3 zero-money games, preserved lifetime desktop and one 6690-point award')

    games.push(await game('published-later'))
    const ledgerBefore = await db.point_ledger.count()
    const sync = await Promise.all([
      db.$transaction(tx => syncBundleMembershipInTransaction(tx, parent.id), { timeout: 60000 }),
      db.$transaction(tx => syncBundleMembershipInTransaction(tx, parent.id), { timeout: 60000 }),
    ])
    assert.deepEqual(sync.sort(), [0, 1])
    const newChild = await db.orders.findUniqueOrThrow({ where: { bundle_parent_id_product_id: { bundle_parent_id: parent.id, product_id: games[3].id } } })
    assert.equal(newChild.expires_at?.toISOString(), originalExpiry)
    assert.equal(newChild.paid_at?.toISOString(), committed.paid_at.toISOString())
    assert.equal(newChild.roblox_user_id, '123456789')
    assert.equal(await awardPointsForOrder(newChild.id, { silent: true }), null)
    assert.equal(await db.point_ledger.count(), ledgerBefore)
    assert.equal(await db.affiliate_earnings.count(), 0)
    const afterSync = await db.orders.findUniqueOrThrow({ where: { id: parent.id } })
    assert.equal(afterSync.expires_at?.toISOString(), originalExpiry)
    assert.equal(afterSync.paid_at?.toISOString(), committed.paid_at.toISOString())
    console.log('PASS actual post-payment game sync retries create one bounded child with no payment/points/affiliate duplication')

    for (let i = 0; i < 4; i++) games.push(await game(`future-${i}`))
    const batch = await runMembershipBatch(db)
    assert.equal(batch.granted, 4)
    assert.equal((await runMembershipBatch(db)).granted, 0)
    children = await db.orders.findMany({ where: { bundle_parent_id: parent.id } })
    assert.equal(children.length, 8)
    assert.ok(children.every(child => child.expires_at?.toISOString() === originalExpiry))
    await db.accounts.delete({where:{provider_provider_account_id:{provider:'google',provider_account_id:providerId}}})
    assert.equal((await db.$transaction(tx=>readTikkiesMembership(tx,admin.email!,new Date(),[ownedIdentities[0]]))).allowed,false)
    await db.$transaction(tx=>ensureNativeStoreCustomer(tx,{...ownedIdentities[0],name:'Fresh native Google',image:null,verifiedEmail:admin.email!,verifiedAt:Math.floor(Date.now()/1000)},[ownedIdentities[0]]))
    const membership = await db.$transaction(tx => readTikkiesMembership(tx, admin.email!, new Date()))
    assert.deepEqual(membership, { email: admin.email, allowed: true, expiresAt: originalExpiry })
    const currentMailbox='current-store-owner@localhost.test';await db.users.update({where:{id:admin.id},data:{email:currentMailbox}})
    for(const identities of [[ownedIdentities[0]],[ownedIdentities[1]],ownedIdentities]){
     const right=await db.$transaction(tx=>readTikkiesMembership(tx,admin.email!,new Date(),identities));assert.equal(right.allowed,true);assert.equal(right.expiresAt,originalExpiry)
     const owned=await db.$transaction(tx=>readTikkiesLibrary(tx,admin.email!,new Date(),'http://127.0.0.1:3112',undefined,identities));assert.equal(owned.games.filter(g=>g.access==='owned').length,8,'games and full Tikkies resolve exactly the same durable customer')
     const only=await db.$transaction(tx=>readTikkiesLibrary(tx,admin.email!,new Date(),'http://127.0.0.1:3112',games[0].id,identities));assert.equal(only.games[0].access,'owned');assert.equal(only.games.length,1)
     assert.ok(children.every(c=>c.user_id===admin.id),'all game grants use the parent buyer, never a provider-specific mailbox customer')
    }
    assert.equal((await db.$transaction(tx=>readTikkiesLibrary(tx,admin.email!,new Date(),'http://127.0.0.1:3112',undefined,[{provider:'google',providerAccountId:'unlinked-foreign'}]))).customerLinked,false)
    await db.users.update({where:{id:admin.id},data:{email:admin.email}})
    console.log('PASS actual DB ordinary Google/Discord buyer: one customer for eight game grants, full Tikkies, changed mailbox and product-scoped rights')
    const expired = await db.$transaction(tx => readTikkiesMembership(tx, admin.email!, new Date(committed.expires_at!.getTime() + 1)))
    assert.equal(expired.allowed, false)
    assert.equal((await db.$transaction(tx => readTikkiesMembership(tx, shopper.email!, new Date()))).allowed, false)
    const library = await db.$transaction(tx => readTikkiesLibrary(tx, admin.email!, new Date(), 'http://127.0.0.1:3112'))
    assert.equal(library.games.filter(item => item.access === 'owned').length, 8)
    assert.equal(library.games.find(item => item.id === partner.id)?.access, 'locked')
    assert.equal(library.games.some(item => item.id === inactive.id), false)
    const entitlements = await db.$transaction(tx => readTikkiesEntitlements(tx, [{ provider: 'google', providerAccountId: providerId }], new Date()))
    assert.equal(entitlements.entitlements.length, 7)
    assert.ok(entitlements.entitlements.every(item => item.status === 'active' && item.universeId && item.placeIds.length === 1))
    console.log('PASS real worker expands to 8 owned games; library, seven synthetic Roblox mappings and full Tikkies active/expired/nonmember reads')

    const { NextRequest } = await import('next/server')
    const routes: Record<string, (request: InstanceType<typeof NextRequest>) => Promise<Response>> = {
      '/api/integrations/tikkies/membership': (await import('../app/api/integrations/tikkies/membership/route')).POST,
      '/api/integrations/tikkies/identity': (await import('../app/api/integrations/tikkies/identity/route')).POST,
      '/api/integrations/tikkies/library': (await import('../app/api/integrations/tikkies/library/route')).POST,
      '/api/integrations/tikkies/entitlements': (await import('../app/api/integrations/tikkies/entitlements/route')).POST,
      '/api/whitelist/check': (await import('../app/api/whitelist/check/route')).POST,
    }
    const identityRoute=routes['/api/integrations/tikkies/identity']
    const identityReq=(body:unknown,authorized=true)=>new NextRequest('http://127.0.0.1:3112/api/integrations/tikkies/identity',{method:'POST',headers:{'Content-Type':'application/json',...(authorized?{Authorization:'Bearer '+process.env.MEMBERSHIP_QA_TOKEN}:{})},body:JSON.stringify(body)})
    assert.equal((await identityRoute(identityReq({},false))).status,401)
    assert.equal((await identityRoute(identityReq({identity:{provider:'google',providerAccountId:'untrusted-stale',name:null,image:null,verifiedEmail:admin.email!,verifiedAt:1},identities:[{provider:'google',providerAccountId:'untrusted-stale'}]}))).status,403)
    assert.equal((await identityRoute(identityReq({}))).status,400)
    console.log('PASS first-link production HTTP handler requires integration authentication and fresh proof')
    // Real loopback HTTP transport to the production route handlers and real DB,
    // without starting or changing any Next dev/build process.
    http = createServer(async (req, res) => {
      try {
        const chunks: Buffer[] = []
        for await (const chunk of req) chunks.push(Buffer.from(chunk))
        const url = 'http://127.0.0.1:3112' + req.url
        const handler = routes[new URL(url).pathname]
        if (!handler || req.method !== 'POST') { res.writeHead(404).end(); return }
        const headers = new Headers()
        for (const [name, value] of Object.entries(req.headers)) if (value) headers.set(name, Array.isArray(value) ? value.join(',') : value)
        const response = await handler(new NextRequest(url, { method: 'POST', headers, body: Buffer.concat(chunks) }))
        res.writeHead(response.status, Object.fromEntries(response.headers))
        res.end(Buffer.from(await response.arrayBuffer()))
      } catch { res.writeHead(500).end('isolated_http_adapter_error') }
    })
    await new Promise<void>((resolve, reject) => { http!.once('error', reject); http!.listen(3112, '127.0.0.1', resolve) })
    const request = async (path: string, body: unknown, authorized = true) => fetch('http://127.0.0.1:3112' + path, { method: 'POST', headers: { 'content-type': 'application/json', ...(authorized ? { authorization: 'Bearer ' + process.env.MEMBERSHIP_QA_TOKEN! } : {}) }, body: JSON.stringify(body) })
    const memberPath = '/api/integrations/tikkies/membership'
    assert.equal((await request(memberPath, { email: admin.email }, false)).status, 401)
    assert.equal((await request(memberPath, { email: admin.email, allowed: true })).status, 400)
    const activeHttp = await request(memberPath, { email: admin.email })
    assert.equal(activeHttp.status, 200)
    assert.match(activeHttp.headers.get('cache-control')!, /no-store/)
    assert.deepEqual(await activeHttp.json(), membership)
    const libraryHttp = await request('/api/integrations/tikkies/library', { email: admin.email })
    assert.equal(libraryHttp.status, 200)
    assert.equal((await libraryHttp.json()).games.filter((item: { access: string }) => item.access === 'owned').length, 8)
    const entitlementsHttp = await request('/api/integrations/tikkies/entitlements', { identities: [{ provider: 'google', providerAccountId: providerId }] })
    assert.equal(entitlementsHttp.status, 200)
    assert.ok((await entitlementsHttp.json()).entitlements.every((item: { status: string }) => item.status === 'active'))
    await db.orders.update({ where: { id: parent.id }, data: { expires_at: new Date(Date.now() - 1000) } })
    assert.equal((await (await request(memberPath, { email: admin.email })).json()).allowed, false)
    assert.equal(await db.$transaction(tx => syncBundleMembershipInTransaction(tx, parent.id)), 0)
    await db.orders.update({ where: { id: parent.id }, data: { expires_at: committed.expires_at } })
    console.log('PASS real HTTP production handlers on 3112: dummy backend authentication, strict body, no-store, active/expired membership, library and entitlements')

    const racing = await game('published-before-refund-race')
    const refundRace = await Promise.all([
      recordTikkiesReversal(parent.id, 'refunded', admin.id),
      db.$transaction(tx => syncBundleMembershipInTransaction(tx, parent.id), { timeout: 60000 }),
    ])
    assert.equal(refundRace[0], true)
    assert.equal(refundRace[1], 0)
    assert.equal(await recordTikkiesReversal(parent.id, 'refunded', admin.id), true)
    assert.equal((await (await request(memberPath, { email: admin.email })).json()).allowed, false)
    children = await db.orders.findMany({ where: { bundle_parent_id: parent.id } })
    assert.equal(children.length, 8)
    assert.ok(children.every(child => child.status === 'refunded' && child.whitelist_status === 'revoked'))
    assert.equal(await db.orders.count({ where: { bundle_parent_id: parent.id, product_id: racing.id } }), 0)
    assert.equal(await db.user_whitelist_access.count({ where: { ign: 'QAMembership', product_id: racing.id } }), 0, 'a newly published game cannot grant after the queued refund')
    for (const own of games.filter(item => item.type === 'roblox_whitelist')) {
      const verdict = await request('/api/whitelist/check', { username: 'QAMembership', product_id: own.id })
      assert.equal(verdict.status, 200)
      assert.equal((await verdict.json()).allowed, false, 'legacy checker must deny refunded membership-only access')
    }
    const retained = await db.user_program_access.findUniqueOrThrow({ where: { user_id_product_id: { user_id: admin.id, product_id: games[2].id } } })
    assert.equal(retained.status, 'ACTIVE')
    assert.equal(retained.expires_at.toISOString(), forever.toISOString())
    assert.equal(await db.point_ledger.count({ where: { type: 'reverse_purchase' } }), 1)
    assert.equal(Number((await db.point_ledger.aggregate({ _sum: { delta: true } }))._sum.delta), 0)
    assert.equal(await db.$transaction(tx => syncBundleMembershipInTransaction(tx, parent.id)), 0)
    assert.equal(forbiddenRequests, 0)
    console.log('PASS actual refund/sync race and refund retries: full Tikkies denied, seven legacy Roblox checks denied, lifetime desktop preserved, points reversed once')
    console.log('LIMITATION PGlite has a single backend and pool max=1: Promise.all exercises real transaction queues/retries/constraints, not contested PostgreSQL multi-connection advisory locks. Schema came from Prisma diff; custom production triggers were not installed.')
  } finally {
    globalThis.fetch = realFetch
    if (http) await new Promise<void>(resolve => { http!.close(() => resolve()); http!.closeAllConnections() })
    await db.$disconnect()
    await pool.end()
    globalThis.prisma = undefined
  }
}

main().catch(error => { console.error(error); process.exitCode = 1 })
