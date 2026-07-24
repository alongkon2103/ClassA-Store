// Backfill orders.card_country from Stripe for historical orders.
//
//   orders (card_country IS NULL, has a Stripe id)
//        → Stripe: session → payment_intent → latest_charge
//        → payment_method_details.card.country
//        → UPDATE orders.card_country
//
// Read-only against Stripe; the ONLY write is orders.card_country. Safe to
// re-run — already-filled rows are skipped, and a row Stripe can't resolve is
// left null (it just gets retried next run).
//
//   npx tsx --env-file=.env scripts/backfill-card-country.ts            # dry run, 50 orders
//   npx tsx --env-file=.env scripts/backfill-card-country.ts 500 apply  # write up to 500
//
// PromptPay orders resolve to null (no card) — that's expected and correct.

import Stripe from "stripe"
import { prisma } from "@/lib/prisma"
import { resolveStripeCardCountry } from "@/lib/stripeCardCountry"

const limit = Number(process.argv[2] || 50)
const apply = process.argv[3] === "apply"

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function main() {
  if (!process.env.STRIPE_SECRET_KEY) {
    console.error("STRIPE_SECRET_KEY missing — check .env")
    process.exit(1)
  }

  const orders = await prisma.orders.findMany({
    where: {
      card_country: null,
      // Only PAID orders can have a charge. Pending/expired sessions were never
      // completed, so Stripe has no card details for them — querying those just
      // burns API calls and prints noise.
      status: "paid",
      OR: [{ stripe_session_id: { not: null } }, { stripe_payment_intent: { not: null } }],
    },
    orderBy: { created_at: "desc" },
    take: limit,
    select: {
      id: true, created_at: true, amount: true, payment_method: true,
      stripe_session_id: true, stripe_payment_intent: true,
    },
  })

  // Guard: a test-mode key cannot read live-mode sessions (and vice versa).
  // Without this check every lookup just returns "—" and looks like no data.
  const keyMode = (process.env.STRIPE_SECRET_KEY || "").startsWith("sk_live") ? "live" : "test"
  const dataMode = orders.find((o) => o.stripe_session_id)?.stripe_session_id?.startsWith("cs_live") ? "live" : "test"
  console.log(`Stripe key: ${keyMode.toUpperCase()} | order data: ${dataMode.toUpperCase()}`)
  if (keyMode !== dataMode) {
    console.error(
      `\n✗ MODE MISMATCH — a ${keyMode} key cannot read ${dataMode} objects.\n` +
      `  Run this on the server whose .env holds the ${dataMode} STRIPE_SECRET_KEY.\n`,
    )
    process.exit(1)
  }

  console.log(`${apply ? "APPLY" : "DRY RUN"} — ${orders.length} order(s) to check (limit ${limit})\n`)
  if (orders.length === 0) return

  let filled = 0, empty = 0, failed = 0
  const seenErrors = new Set<string>()
  for (const [i, o] of orders.entries()) {
    let country: string | null = null
    let note = ""
    try {
      country = await resolveStripeCardCountry(stripe, {
        sessionId: o.stripe_session_id,
        paymentIntentId: o.stripe_payment_intent,
      })
    } catch (e) {
      failed++
      const msg = (e as Error)?.message?.slice(0, 120) ?? "unknown error"
      note = `  ⚠ ${msg}`
      // Surface each distinct failure reason once so the log stays readable.
      if (!seenErrors.has(msg)) seenErrors.add(msg)
    }

    const tag = country ?? "—"
    console.log(
      `[${i + 1}/${orders.length}] ${o.id.slice(0, 8)} ${o.payment_method ?? "?"} ฿${Number(o.amount)} → ${tag}${note}`,
    )

    if (country) {
      if (apply) await prisma.orders.update({ where: { id: o.id }, data: { card_country: country } })
      filled++
    } else {
      empty++
    }

    // Stay well under Stripe's rate limit (2 API calls per order).
    await sleep(120)
  }

  console.log(
    `\nDone — resolved: ${filled}, no card country (PromptPay/unavailable): ${empty}, errors: ${failed}` +
    (apply ? "" : "\n(dry run — nothing written. Re-run with `apply` to save.)"),
  )
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
