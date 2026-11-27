import type { PrismaClient } from '@prisma/client'
import { normalizeEmail } from './verifiedEmail'

export const EMAIL_WHITELIST_NOTE = 'aclass:whitelist-email:v1'
export const RETIRED_EMAIL_WHITELIST_NOTE = 'aclass:whitelist-email:v1:retired'
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export class WhitelistGrantInputError extends Error {}
export function whitelistEmailLockKey(email: string) { return EMAIL_WHITELIST_NOTE + ':' + email }

/** An admin explicitly chooses a known recipient by email, just like the user picker. */
export async function resolveEmailWhitelistRecipient(db: Pick<PrismaClient,'$executeRaw'|'$queryRaw'>, address: string): Promise<string|null> {
  const email = normalizeEmail(address)
  if (!email) throw new WhitelistGrantInputError('Invalid email address')
  await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${whitelistEmailLockKey(email)}, 0))`
  const matches = await db.$queryRaw<{id:string}[]>`SELECT id FROM users WHERE lower(btrim(email)) = ${email} LIMIT 2`
  if (matches.length > 1) throw new WhitelistGrantInputError('This email matches multiple accounts. Select the intended existing account instead.')
  return matches[0]?.id ?? null
}
/** Prisma PostgreSQL insensitive equals is ILIKE, so escape its pattern syntax. */
export function literalInsensitive(value: string) {
  return { equals: value.replace(/[\\%_]/g, character => '\\' + character), mode: 'insensitive' as const }
}

export function parseWhitelistGrant(input: unknown) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new WhitelistGrantInputError('Invalid request')
  const body = input as Record<string, unknown>
  const userId = body.userId === undefined || body.userId === null || body.userId === '' ? null : body.userId
  const email = body.email === undefined || body.email === null || body.email === '' ? null : normalizeEmail(body.email)
  if (body.email && !email) throw new WhitelistGrantInputError('Invalid email address')
  if (userId !== null && (typeof userId !== 'string' || !uuid.test(userId))) throw new WhitelistGrantInputError('Invalid user')
  if (!!userId === !!email) throw new WhitelistGrantInputError('Choose either an existing user or an email address')
  if (typeof body.productId !== 'string' || !uuid.test(body.productId)) throw new WhitelistGrantInputError('Invalid product')
  if (typeof body.ign !== 'string' || !body.ign.trim() || body.ign.trim().length > 100) throw new WhitelistGrantInputError('Invalid in-game name')
  for (const field of ['isPremium','isPermanent']) if (body[field] !== undefined && typeof body[field] !== 'boolean') throw new WhitelistGrantInputError('Invalid access options')
  const isPermanent = body.isPermanent === true
  const durationDays = isPermanent ? 0 : body.durationDays
  if (!isPermanent && (typeof durationDays !== 'number' || !Number.isSafeInteger(durationDays) || durationDays <= 0 || !Number.isFinite(new Date(Date.now()+durationDays*86400000).getTime()))) throw new WhitelistGrantInputError('Duration must be a positive whole number of days')
  return { userId: userId as string | null, email, productId: body.productId, ign: body.ign.trim(), isPremium: body.isPremium === true, isPermanent, durationDays: durationDays as number }
}

/** A single conditional UPDATE makes claims idempotent and never transfers assigned orders. */
export async function claimEmailWhitelistOrders(db: Pick<PrismaClient,'$executeRaw'>, userId: string, address: string): Promise<number> {
  const email = normalizeEmail(address)
  if (!email || !uuid.test(userId)) throw new WhitelistGrantInputError('Invalid claim identity')
  return db.$executeRaw`
    UPDATE orders AS o SET user_id = ${userId}::uuid
    WHERE o.user_id IS NULL
      AND lower(btrim(o.buyer_label)) = ${email}
      AND o.manual_note = ${EMAIL_WHITELIST_NOTE}
      AND o.payment_method = 'admin_manual' AND o.order_type = 'TRIAL'
      AND o.status = 'paid' AND o.whitelist_status = 'whitelisted'
      AND o.expires_at > CURRENT_TIMESTAMP
      AND EXISTS (
        SELECT 1 FROM user_whitelist_access AS w
        WHERE w.product_id = o.product_id AND lower(w.ign) = lower(o.whitelisted_username)
          AND w.expires_at > CURRENT_TIMESTAMP
      )`
}

export async function withPendingWhitelistEmails<T extends { ign: string; product_id: string }>(db: Pick<PrismaClient,'orders'>, rows: T[]): Promise<(T & { pendingEmail: string | null })[]> {
  if (!rows.length) return []
  const pending = await db.orders.findMany({
    where: { user_id: null, manual_note: EMAIL_WHITELIST_NOTE, payment_method: 'admin_manual', order_type: 'TRIAL', status: 'paid', whitelist_status: 'whitelisted', expires_at: { gt: new Date() } },
    select: { buyer_label: true, product_id: true, whitelisted_username: true },
    orderBy: { created_at: 'desc' },
  })
  const emails = new Map<string,string>()
  for (const order of pending) {
    const key = order.product_id + ':' + order.whitelisted_username?.toLowerCase()
    const email = normalizeEmail(order.buyer_label)
    if (email && !emails.has(key)) emails.set(key,email)
  }
  return rows.map(row => ({ ...row, pendingEmail: emails.get(row.product_id+':'+row.ign.toLowerCase()) ?? null }))
}
