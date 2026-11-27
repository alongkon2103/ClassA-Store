import assert from 'node:assert/strict'

const DAY = 86400000
async function main() {
  const url = 'postgresql://aclass_qa@127.0.0.1:55439/aclass_paid_renewal_qa'
  assert.equal(process.env.MEMBERSHIP_QA_PG_CONCURRENCY, 'true')
  assert.equal(process.env.DATABASE_URL, url, 'Only the dedicated temporary cluster is permitted')
  assert.ok(process.env.DOTENV_CONFIG_PATH?.endsWith('NO-REAL-ENV-FOR-MEMBERSHIP-QA.env'))
  const { PrismaClient } = await import('@prisma/client')
  const { PrismaPg } = await import('@prisma/adapter-pg')
  const { default: pg } = await import('pg')
  const pool = new pg.Pool({ connectionString: url, max: 6, application_name: 'aclass-renewal-qa' })
  const db = new PrismaClient({ adapter: new PrismaPg(pool) })
  globalThis.prisma = db
  const id = require.resolve('../lib/integrations/tikkiesRoblox')
  require.cache[id] = { id, filename: id, loaded: true, exports: { resolveTikkiesBinding: async (ign: string) => ({ roblox_user_id: '123456789', roblox_username: ign, roblox_resolved_for: ign.toLowerCase() }) } } as NodeModule
  globalThis.fetch = (async () => { throw new Error('External network forbidden in concurrency QA') }) as typeof fetch
  try {
    const user = await db.users.create({ data: { username: 'Synthetic concurrency buyer', email: 'concurrency@localhost.test' } })
    const actor = await db.users.create({ data: { username: 'Synthetic concurrency admin', role: 'admin' } })
    for (const [index, type] of ['roblox_whitelist', 'roblox_whitelist', 'desktop_program'].entries()) await db.products.create({ data: { slug: 'concurrency-' + index, name_th: 'Synthetic', name_en: 'Synthetic', type, price: 100, is_active: true, is_consignment: false } })
    const product = await db.products.create({ data: { slug: 'ac-games-membership', name_en: 'Synthetic membership', name_th: 'Synthetic membership', type: 'bundle', price: 100, is_active: true, is_consignment: false, bundle_all_ac_games: true, bundle_includes_tikkies: true } })
    const { freezeBundle } = await import('../lib/bundles')
    const { fulfillPaidOrder } = await import('../lib/orderFulfillment')
    const { grantManualBundle } = await import('../lib/manualBundleGrant')
    const { retryAbortedTransaction } = await import('../lib/transactionRetry')
    const draft = async (ign: string, days = 30) => {
      const variant = await db.product_variants.create({ data: { product_id: product.id, duration_type: 'days', duration_days: days, is_active: true, variant_type: 'normal', price: 100, label_th: 'QA', label_en: 'QA' } })
      return db.orders.create({ data: { product_id: product.id, variant_id: variant.id, user_id: user.id, amount: 100, goods_amount: 100, payment_method: 'card', order_type: 'BUNDLE', status: 'pending', whitelisted_username: ign, bundle_snapshot: await freezeBundle(db, product, variant) } })
    }
    // Hold the exact production renewal lock, start two independent operations,
    // and verify both database backends actually wait before releasing them.
    const contend = async (ign: string, operations: (() => Promise<unknown>)[], expectedWaiters: number) => {
      const blocker = await pool.connect()
      const monitor = await pool.connect()
      let running: Promise<unknown[]> | undefined
      try {
        await blocker.query('BEGIN')
        await blocker.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [product.id + ':' + ign.toLowerCase()])
        running = Promise.all(operations.map(operation => operation()))
        void running.catch(() => {})
        let waiters = 0
        for (let attempt = 0; attempt < 100; attempt++) {
          const result = await monitor.query("SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname=current_database() AND application_name='aclass-renewal-qa' AND wait_event='advisory'")
          waiters = result.rows[0].n
          if (waiters >= expectedWaiters) break
          await new Promise(resolve => setTimeout(resolve, 25))
        }
        assert.ok(waiters >= expectedWaiters, `Expected ${expectedWaiters} real advisory lock waiters; got ${waiters}`)
        await blocker.query('COMMIT')
        return await running
      } finally {
        await blocker.query('ROLLBACK').catch(() => {})
        await running?.catch(() => {})
        blocker.release(); monitor.release()
      }
    }
    const purchases = [await draft('QaConcurrentPaid'), await draft('QaConcurrentPaid')]
    assert.deepEqual(await contend('QaConcurrentPaid', purchases.map(order => () => fulfillPaidOrder(order.id)), 2), ['ok', 'ok'])
    const paid = await db.orders.findMany({ where: { id: { in: purchases.map(order => order.id) } }, orderBy: { expires_at: 'asc' } })
    assert.equal(paid[1].expires_at!.getTime(), paid[0].expires_at!.getTime() + 30 * DAY)
    assert.equal(await db.orders.count({ where: { bundle_parent_id: { in: purchases.map(order => order.id) } } }), 6)
    console.log('PASS real PostgreSQL: two payment backends contend on the renewal lock and retain both purchased periods')

    const replay = await draft('QaConcurrentReplay')
    const replayed = await contend('QaConcurrentReplay', [() => fulfillPaidOrder(replay.id), () => fulfillPaidOrder(replay.id)], 1)
    assert.deepEqual(replayed.sort(), ['already_paid', 'ok'])
    const once = await db.orders.findUniqueOrThrow({ where: { id: replay.id } })
    assert.equal(once.expires_at!.getTime(), once.fulfilled_at!.getTime() + 30 * DAY)
    assert.equal(await db.orders.count({ where: { bundle_parent_id: replay.id } }), 3)
    console.log('PASS real PostgreSQL: concurrent callbacks for one payment grant one period and one set of games')

    const initial = await draft('QaConcurrentMixed', 10)
    await fulfillPaidOrder(initial.id)
    const baseline = await db.orders.findUniqueOrThrow({ where: { id: initial.id } })
    const next = await draft('QaConcurrentMixed')
    await contend('QaConcurrentMixed', [
      () => fulfillPaidOrder(next.id),
      () => retryAbortedTransaction(() => db.$transaction(async tx => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${product.id + ':qaconcurrentmixed'},0))`
        return grantManualBundle(tx, { productId: product.id, userId: user.id, email: null, ign: 'QaConcurrentMixed', actorId: actor.id, durationDays: 7, isPermanent: false, robloxBinding: {} })
      }, { isolationLevel: 'ReadCommitted', timeout: 60000 })),
    ], 2)
    const latest = await db.orders.findFirstOrThrow({ where: { product_id: product.id, whitelisted_username: 'QaConcurrentMixed', status: 'paid' }, orderBy: { expires_at: 'desc' } })
    assert.equal(latest.expires_at!.getTime(), baseline.expires_at!.getTime() + 37 * DAY)
    console.log('PASS real PostgreSQL: simultaneous admin and payment renewal serialize without losing either added period')
  } finally { await db.$disconnect(); await pool.end() }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
