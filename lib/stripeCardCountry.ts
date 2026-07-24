// Resolve the issuing country of the card behind a Stripe payment.
//
// Why: Stripe's fee tier depends on it — a Thai-issued card is 3.65% + ฿10 while
// a foreign card is 4.75% + ฿10 (+2% if currency conversion happens). Storing the
// country on the order lets us compute real net revenue per order later.
//
// Returns a 2-letter ISO country ("TH", "US", …), or null when the payment isn't
// a card (PromptPay), the charge isn't available yet, or Stripe didn't report it.
// Never throws — callers treat it as best-effort enrichment.

import type Stripe from "stripe"

// Throwing variant — Stripe errors propagate so callers (the backfill script)
// can show WHY a lookup failed instead of silently recording null.
export async function resolveStripeCardCountry(
  stripe: Stripe,
  opts: { sessionId?: string | null; paymentIntentId?: string | null },
): Promise<string | null> {
  let piId: string | null = opts.paymentIntentId ?? null

  // No PaymentIntent on hand → resolve it from the Checkout Session.
  if (!piId && opts.sessionId) {
    const s = await stripe.checkout.sessions.retrieve(opts.sessionId)
    piId = typeof s.payment_intent === "string" ? s.payment_intent : (s.payment_intent?.id ?? null)
  }
  if (!piId) return null

  // The card details live on the charge, not the PaymentIntent itself.
  const pi = await stripe.paymentIntents.retrieve(piId, { expand: ["latest_charge"] })
  const charge = pi.latest_charge as Stripe.Charge | null
  return charge?.payment_method_details?.card?.country ?? null
}

// Safe wrapper for request paths (webhook) — never throws, so a Stripe hiccup
// can't break fulfillment. Missing country is acceptable; the backfill can fill
// it in later.
export async function fetchStripeCardCountry(
  stripe: Stripe,
  opts: { sessionId?: string | null; paymentIntentId?: string | null },
): Promise<string | null> {
  try {
    return await resolveStripeCardCountry(stripe, opts)
  } catch {
    return null
  }
}
