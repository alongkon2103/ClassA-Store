// Stripe processing-fee model — the single source of truth for every admin
// revenue view (dashboard / analytics / partnership earnings).
//
// Rates (Stripe Thailand):
//   PromptPay        1.65%            (the ฿10 in Stripe's table is a REFUND fee,
//                                      not a per-transaction fee — so none here)
//   Card, Thai       3.65% + ฿10
//   Card, foreign    4.75% + ฿10      (+2% only if Stripe converts currency —
//                                      not applied: we price and settle in THB)
//
// Only Stripe-processed methods are charged: card + promptpay. PayPal,
// PayPal.me, admin-manual and free trials never touch Stripe, so they carry no
// Stripe fee (they're excluded from the fee base entirely).
//
// Unknown card_country (backfill hasn't reached it, or the webhook couldn't read
// it) is billed at the FOREIGN rate on purpose: most real cards here are foreign,
// so guessing "Thai" would understate the cost. Every view also surfaces how many
// orders are still unknown so the number is never silently wrong.

import type { Prisma } from "@prisma/client"

export const STRIPE_FEE = {
  promptpayPct: 1.65,
  cardThaiPct: 3.65,
  cardForeignPct: 4.75,
  cardFixed: 10,
} as const

/** Payment methods that Stripe actually processes (and therefore charges for). */
export const STRIPE_METHODS = ["card", "promptpay"] as const

/** Prisma `where` fragment matching exactly the rows the fee model applies to. */
export const stripeFeeWhere: {
  status: string
  order_type: { not: string }
  payment_method: { in: string[] }
} = {
  status: "paid",
  order_type: { not: "TRIAL" },
  payment_method: { in: [...STRIPE_METHODS] },
}

const r2 = (n: number) => Math.round(n * 100) / 100

/** Fee for a single order. Non-Stripe methods return 0. */
export function stripeFeeForOrder(o: {
  amount: number
  payment_method: string | null
  card_country: string | null
}): number {
  if (o.payment_method === "promptpay") return r2((o.amount * STRIPE_FEE.promptpayPct) / 100)
  if (o.payment_method !== "card") return 0
  const pct = o.card_country === "TH" ? STRIPE_FEE.cardThaiPct : STRIPE_FEE.cardForeignPct
  return r2((o.amount * pct) / 100 + STRIPE_FEE.cardFixed)
}

/**
 * Shape returned by
 *   prisma.orders.groupBy({ by: ["payment_method", "card_country"], _sum: { amount }, _count: { _all } })
 * Grouping keeps this exact (the +฿10 is per ORDER, so we need the count too)
 * without pulling every row.
 */
export type FeeGroup = {
  payment_method: string | null
  card_country: string | null
  _sum: { amount: Prisma.Decimal | null }
  _count: { _all: number }
}

export type StripeFeeBreakdownRow = {
  method: string
  orders: number
  gross: number
  fee: number
  net: number
  /** Orders in this row whose card country is still unknown (billed as foreign). */
  unknownCountry: number
}

export type StripeFeeSummary = {
  /** Gross of Stripe-processed orders only (not the store's whole revenue). */
  gross: number
  fee: number
  net: number
  orders: number
  unknownCountry: number
  byMethod: StripeFeeBreakdownRow[]
}

/** Roll grouped rows into totals + a per-method breakdown. */
export function summarizeStripeFees(groups: FeeGroup[]): StripeFeeSummary {
  const per = new Map<string, StripeFeeBreakdownRow>()

  for (const g of groups) {
    const method = g.payment_method ?? "unknown"
    if (!STRIPE_METHODS.includes(method as (typeof STRIPE_METHODS)[number])) continue

    const gross = Number(g._sum.amount ?? 0)
    const count = g._count._all
    const isCard = method === "card"
    const isThai = g.card_country === "TH"
    const pct = !isCard ? STRIPE_FEE.promptpayPct : isThai ? STRIPE_FEE.cardThaiPct : STRIPE_FEE.cardForeignPct
    const fee = (gross * pct) / 100 + (isCard ? STRIPE_FEE.cardFixed * count : 0)

    const row = per.get(method) ?? { method, orders: 0, gross: 0, fee: 0, net: 0, unknownCountry: 0 }
    row.orders += count
    row.gross += gross
    row.fee += fee
    if (isCard && g.card_country === null) row.unknownCountry += count
    per.set(method, row)
  }

  const byMethod = [...per.values()]
    .map((r) => ({ ...r, gross: r2(r.gross), fee: r2(r.fee), net: r2(r.gross - r.fee) }))
    .sort((a, b) => b.gross - a.gross)

  const gross = r2(byMethod.reduce((s, r) => s + r.gross, 0))
  const fee = r2(byMethod.reduce((s, r) => s + r.fee, 0))
  return {
    gross,
    fee,
    net: r2(gross - fee),
    orders: byMethod.reduce((s, r) => s + r.orders, 0),
    unknownCountry: byMethod.reduce((s, r) => s + r.unknownCountry, 0),
    byMethod,
  }
}
