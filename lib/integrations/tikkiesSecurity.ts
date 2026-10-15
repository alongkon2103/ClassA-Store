import { createHash, createHmac, timingSafeEqual } from "node:crypto"
import type { Prisma } from "@prisma/client"
import { TikkiesError, type Identity } from "./tikkies"

export const MAX_BODY_BYTES = 8192
export function authenticateTikkies(req: Request, env = process.env): string {
  const header = req.headers.get("authorization") ?? ""
  const token = /^Bearer ([A-Za-z0-9_-]{32,256})$/i.exec(header)?.[1]
  if (!token) throw new TikkiesError("unauthorized", 401)
  const current = env.TIKKIES_API_KEY_SHA256 ?? ""
  const previous = env.TIKKIES_API_KEY_PREVIOUS_SHA256
  if (!/^[a-f0-9]{64}$/i.test(current) || (previous && !/^[a-f0-9]{64}$/i.test(previous))) throw new TikkiesError("integration_unavailable", 503)
  const supplied = createHash("sha256").update(token).digest()
  let valid = false
  for (const hash of [current, previous].filter((x): x is string => !!x)) valid = timingSafeEqual(supplied, Buffer.from(hash, "hex")) || valid
  if (!valid) throw new TikkiesError("unauthorized", 401)
  if (env.TIKKIES_API_ENABLED !== "true") throw new TikkiesError("integration_disabled", 403)
  const url = new URL(req.url)
  const local = env.NODE_ENV !== "production" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
  const secure = url.protocol === "https:" || (env.TIKKIES_TRUST_PROXY === "true" && req.headers.get("x-forwarded-proto") === "https")
  if (!secure && !local) throw new TikkiesError("https_required", 403)
  return current
}
export async function readTikkiesBody(req: Request, maxBytes = MAX_BODY_BYTES): Promise<unknown> {
  if (req.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") throw new TikkiesError("invalid_input", 400)
  const length = req.headers.get("content-length")
  if (length && (!/^\d+$/.test(length) || Number(length) > maxBytes)) throw new TikkiesError("body_too_large", 400)
  const reader = req.body?.getReader()
  if (!reader) throw new TikkiesError("invalid_input", 400)
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > maxBytes) { await reader.cancel(); throw new TikkiesError("body_too_large", 400) }
      chunks.push(value)
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"))
  } catch (error) {
    if (error instanceof TikkiesError) throw error
    throw new TikkiesError("invalid_input", 400)
  } finally { reader.releaseLock() }
}
function quota(value: string | undefined, fallback: number) {
  if (value === undefined) return fallback
  if (!/^\d+$/.test(value) || Number(value) < 1 || Number(value) > 1_000_000) throw new TikkiesError("integration_unavailable", 503)
  return Number(value)
}
export async function limitTikkies(db: Prisma.TransactionClient, identities: Identity[], secret: string, env = process.env) {
  const globalMax = quota(env.TIKKIES_RATE_LIMIT_PER_MINUTE, 6000)
  const subjectMax = quota(env.TIKKIES_CUSTOMER_RATE_LIMIT_PER_MINUTE, 60)
  const global = createHash("sha256").update("tikkies:global").digest("hex")
  const subject = createHmac("sha256", secret).update(JSON.stringify([...identities].sort((a, b) => `${a.provider}:${a.providerAccountId}`.localeCompare(`${b.provider}:${b.providerAccountId}`)))).digest("hex")
  const rows = await db.$queryRaw<{ key_hash: string; count: number; reset_at: Date }[]>`
    INSERT INTO tikkies_rate_limits (key_hash, count, reset_at)
    VALUES (${global}, 1, clock_timestamp() + interval '60 seconds'), (${subject}, 1, clock_timestamp() + interval '60 seconds')
    ON CONFLICT (key_hash) DO UPDATE SET
      count = CASE WHEN tikkies_rate_limits.reset_at <= clock_timestamp() THEN 1 ELSE tikkies_rate_limits.count + 1 END,
      reset_at = CASE WHEN tikkies_rate_limits.reset_at <= clock_timestamp() THEN clock_timestamp() + interval '60 seconds' ELSE tikkies_rate_limits.reset_at END
    RETURNING key_hash, count, reset_at`
  if (rows.length !== 2 || ![global, subject].every(key => rows.some(r => r.key_hash === key && Number.isInteger(r.count) && r.count > 0 && r.reset_at instanceof Date && Number.isFinite(r.reset_at.getTime())))) throw new TikkiesError("integration_unavailable", 503)
  const blocked = rows.filter(r => r.count > (r.key_hash === global ? globalMax : subjectMax))
  // Bounded cleanup by indexed expiry; no timers/jobs and no raw identities in the table.
  await db.$executeRaw`DELETE FROM tikkies_rate_limits WHERE key_hash IN (SELECT key_hash FROM tikkies_rate_limits WHERE reset_at < clock_timestamp() - interval '60 seconds' LIMIT 100)`
  return blocked.length ? Math.max(1, ...blocked.map(r => Math.ceil((r.reset_at.getTime() - Date.now()) / 1000))) : null
}
