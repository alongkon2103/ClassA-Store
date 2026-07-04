// PayPal.me email-verification worker — runs as its OWN PM2 process, separate
// from the Next.js web app (they must not share resources).
//
// Phase 3 scope: poll Gmail, verify each new PayPal email (DKIM/SPF + sender),
// and log it raw to paypal_email_log. It does NOT parse amounts or match orders
// yet — that's Phase 4 (parser) and Phase 5 (matcher).
//
// Run locally:   npx tsx --env-file=.env worker/paypalWorker.ts
// Run under PM2: pm2 start ecosystem.paypal-worker.config.js

import type { gmail_v1 } from "@googleapis/gmail"
import { prisma } from "@/lib/prisma"
import { getGmailClient } from "@/lib/gmail"
import { getHeader, getHeaderAll, extractBodies } from "@/lib/gmailMessage"
import { verifyPayPalEmail } from "@/lib/paypalMailVerify"
import { parsePayPalReceivedEmail } from "@/lib/paypalMailParse"
import { matchAndProcessPayment } from "@/lib/paypalMatcher"
import { expireStalePayPalMeOrders } from "@/lib/paypalMe"

// 15s default: fast enough that a paying customer rarely waits more than one
// cycle, while sipping Gmail quota (~5.7k list calls/day ≈ 3% of the daily cap).
// The real floor on confirmation speed is PayPal→Gmail delivery, not this number,
// so going lower buys little. Override with PAYPAL_MAIL_POLL_MS if needed.
const POLL_INTERVAL_MS = Number(process.env.PAYPAL_MAIL_POLL_MS || 15_000)
const INITIAL_LOOKBACK_MS = Number(process.env.PAYPAL_MAIL_INITIAL_LOOKBACK_MS || 10 * 60 * 1000)
const EXPIRE_SWEEP_MS = Number(process.env.PAYPAL_EXPIRE_SWEEP_MS || 60_000) // expire stale orders at most once/min
const CURSOR_OVERLAP_SEC = 60 // re-list a minute of overlap; dedupe by id handles the rest
const MAX_PER_CYCLE = 25 // ~10 orders/day — one page is always plenty
const CURSOR_KEY = "paypal_mail_cursor"
const GMAIL_QUERY = "from:paypal.com"

const log = (...a: unknown[]) => console.log(new Date().toISOString(), "[paypal-worker]", ...a)

async function getCursor(): Promise<number> {
  const row = await prisma.system_configs.findUnique({ where: { key: CURSOR_KEY } })
  const n = row?.value ? parseInt(row.value, 10) : NaN
  if (Number.isFinite(n)) return n
  // First run: don't dump the whole history — start a short lookback ago.
  return Math.floor((Date.now() - INITIAL_LOOKBACK_MS) / 1000)
}

async function setCursor(sec: number): Promise<void> {
  await prisma.system_configs.upsert({
    where: { key: CURSOR_KEY },
    create: { key: CURSOR_KEY, value: String(sec) },
    update: { value: String(sec) },
  })
}

async function alreadyLogged(gmailMessageId: string): Promise<boolean> {
  const row = await prisma.paypal_email_log.findUnique({
    where: { gmail_message_id: gmailMessageId },
    select: { id: true },
  })
  return !!row
}

async function processMessage(gmail: gmail_v1.Gmail, id: string): Promise<number | null> {
  if (await alreadyLogged(id)) return null

  const full = await gmail.users.messages.get({ userId: "me", id, format: "full" })
  const msg = full.data
  const internalMs = Number(msg.internalDate || 0)
  const receivedAt = internalMs ? new Date(internalMs) : new Date()

  const from = getHeader(msg, "From")
  const subject = getHeader(msg, "Subject")
  const authResults = getHeaderAll(msg, "Authentication-Results")
  const verify = verifyPayPalEmail(from, authResults)
  const { text, html } = extractBodies(msg)
  const body = text || html || ""

  // SECURITY: only ever parse the CONTENT of an email that passed verification.
  // Unverified email content is untrusted and must never drive matching.
  const parsed = verify.ok ? parsePayPalReceivedEmail(subject, body) : null

  const rawHeaders = JSON.stringify(
    {
      From: from,
      Subject: subject,
      Date: getHeader(msg, "Date"),
      "Message-Id": getHeader(msg, "Message-Id"),
      "Return-Path": getHeader(msg, "Return-Path"),
      "Authentication-Results": authResults,
    },
    null,
    2,
  )

  try {
    await prisma.paypal_email_log.create({
      data: {
        gmail_message_id: id,
        received_at: receivedAt,
        verified: verify.ok,
        parse_ok: parsed?.ok ?? false,
        error: !verify.ok ? verify.reason : parsed && !parsed.ok ? parsed.reason : null,
        raw_headers: rawHeaders,
        raw_body: body || msg.snippet || "",
      },
    })
  } catch (e: unknown) {
    // Unique violation = another pass logged it first; that's fine.
    if ((e as { code?: string })?.code === "P2002") return internalMs ? Math.floor(internalMs / 1000) : null
    throw e
  }

  const tag = !verify.ok ? `✗ rejected (${verify.reason})` : parsed?.ok ? "✓ parsed" : "· ignored"
  log(tag, "|", (subject || "(no subject)").slice(0, 60))

  // Match + fulfil verified, parseable money-received emails. Matcher is
  // idempotent (unique txn_id) and never throws fatally into the loop.
  if (verify.ok && parsed?.ok) {
    try {
      const result = await matchAndProcessPayment(parsed, { gmailMessageId: id })
      log(
        `   → ${result.outcome}`,
        result.orderId ? `order=${result.orderId}` : "",
        `[$${parsed.grossAmount} ${parsed.currency} txn=${parsed.txnId}]`,
      )
    } catch (e: unknown) {
      log("   → matcher error:", (e as Error)?.message || e)
    }
  }

  return internalMs ? Math.floor(internalMs / 1000) : null
}

async function processOnce(gmail: gmail_v1.Gmail): Promise<void> {
  const cursor = await getCursor()
  const after = Math.max(0, cursor - CURSOR_OVERLAP_SEC)

  const list = await gmail.users.messages.list({
    userId: "me",
    q: `${GMAIL_QUERY} after:${after}`,
    maxResults: MAX_PER_CYCLE,
  })
  const msgs = list.data.messages ?? []
  if (msgs.length === 0) return

  // Gmail returns newest-first; process oldest-first so the cursor only advances.
  const ordered = [...msgs].reverse()
  let maxTs = cursor

  for (const ref of ordered) {
    if (!ref.id) continue
    try {
      const ts = await processMessage(gmail, ref.id)
      if (ts && ts > maxTs) maxTs = ts
    } catch (e: unknown) {
      log("error on message", ref.id, "-", (e as Error)?.message || e)
    }
  }

  if (maxTs > cursor) await setCursor(maxTs)
}

async function main(): Promise<void> {
  log("starting — polling every", POLL_INTERVAL_MS / 1000, "s as", process.env.GMAIL_USER || "(unknown)")
  const gmail = getGmailClient()

  // Fail fast if credentials are wrong, so PM2 surfaces it immediately.
  await gmail.users.getProfile({ userId: "me" })

  // Sweep expired orders in-process so no external scheduler is needed. Runs at
  // most once per EXPIRE_SWEEP_MS regardless of the (shorter) poll interval.
  let lastSweep = 0
  const maybeSweep = async () => {
    if (Date.now() - lastSweep < EXPIRE_SWEEP_MS) return
    lastSweep = Date.now()
    try {
      const n = await expireStalePayPalMeOrders()
      if (n > 0) log(`expired ${n} stale order(s)`)
    } catch (e: unknown) {
      log("expiry sweep error:", (e as Error)?.message || e)
    }
  }

  // Sequential loop — never let two poll cycles overlap.
  for (;;) {
    try {
      await processOnce(gmail)
      await maybeSweep()
    } catch (e: unknown) {
      log("poll cycle error:", (e as Error)?.message || e)
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS))
  }
}

main().catch((e: unknown) => {
  log("fatal:", (e as Error)?.message || e)
  process.exit(1)
})
