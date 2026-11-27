import type { PrismaClient } from '@prisma/client'
import { BUNDLE_BLOCKED_WHITELIST } from '../lib/bundleFulfillment'
import { syncBundleMembershipInTransaction } from '../lib/bundleMembershipSync'

const PAGE_SIZE = 25
const POLL_MS = 60_000

function safeErrorCode(error: unknown): string {
  const code = (error as { code?: unknown } | null)?.code
  return typeof code === 'string' && /^[A-Z][A-Z0-9_]{0,39}$/.test(code) ? code : 'MEMBERSHIP_SYNC_FAILED'
}

/** One bounded page per poll. Advancing across ids prevents a permanently
 * failing or already-complete early parent from starving later memberships. */
export async function runMembershipBatch(db: Pick<PrismaClient, 'orders' | '$transaction'>, opts: { now?: Date; afterId?: string | null } = {}) {
  const now = opts.now ?? new Date()
  const parents = await db.orders.findMany({
    where: {
      ...(opts.afterId ? { id: { gt: opts.afterId } } : {}),
      bundle_parent_id: null, order_type: { not: 'BUNDLE_GAME' }, status: 'paid',
      fulfilled_at: { not: null }, paid_at: { not: null }, expires_at: { gt: now },
      bundle_snapshot: { path: ['allAcGames'], equals: true },
      OR: [{ whitelist_status: null }, { whitelist_status: { notIn: BUNDLE_BLOCKED_WHITELIST } }],
    },
    select: { id: true }, orderBy: { id: 'asc' }, take: PAGE_SIZE,
  })
  let granted = 0, failed = 0
  const errorCodes = new Set<string>()
  for (const parent of parents) {
    try {
      // With no test clock override, sync reads fresh time after obtaining the
      // parent lock; a slow preceding transaction cannot extend an expired term.
      granted += await db.$transaction(tx => syncBundleMembershipInTransaction(tx, parent.id, opts.now ? { now: opts.now } : {}), { maxWait: 5_000, timeout: 60_000 })
    } catch (error) {
      failed++
      errorCodes.add(safeErrorCode(error))
    }
  }
  return { scanned: parents.length, granted, failed, errorCodes: [...errorCodes], afterId: parents.length === PAGE_SIZE ? parents.at(-1)!.id : null }
}

async function main() {
  // Importing the batch helper in fixtures never constructs a client or reads
  // .env. The process receives its environment from the deployment launcher.
  const { prisma } = await import('../lib/prisma')
  const log = (event: string, data: Record<string, unknown>) => console.log(new Date().toISOString(), '[membership-worker]', event, JSON.stringify(data))
  let stopped = false, afterId: string | null = null
  let wake: (() => void) | undefined
  const stop = () => { stopped = true; wake?.() }
  process.once('SIGINT', stop)
  process.once('SIGTERM', stop)
  log('started', { pollMs: POLL_MS, pageSize: PAGE_SIZE })
  try {
    while (!stopped) {
      try {
        const result = await runMembershipBatch(prisma, { afterId })
        afterId = result.afterId
        if (result.granted || result.failed) log('batch', { scanned: result.scanned, granted: result.granted, failed: result.failed, errorCodes: result.errorCodes })
      } catch (error) {
        log('poll_failed', { code: safeErrorCode(error) })
      }
      if (!stopped) await new Promise<void>(resolve => {
        const timer = setTimeout(() => { wake = undefined; resolve() }, POLL_MS)
        wake = () => { clearTimeout(timer); wake = undefined; resolve() }
      })
    }
  } finally {
    process.removeListener('SIGINT', stop)
    process.removeListener('SIGTERM', stop)
    await prisma.$disconnect()
  }
}

if (require.main === module) main().catch(() => { console.error('[membership-worker] fatal', 'MEMBERSHIP_WORKER_FAILED'); process.exitCode = 1 })
