// Live Stripe reporting for the /admin/stripe page. The SINGLE source of the
// REAL numbers (unlike lib/stripeFees.ts which *estimates* from our DB): every
// figure here comes straight from Stripe's Balance Transactions — the actual
// fee, net, refund and payout Stripe recorded, not a modelled rate.
//
// Money: Stripe amounts are in the currency's smallest unit. THB is a
// two-decimal currency (charged in satang) → divide by 100. A few currencies
// are zero-decimal (no division); handled below. We convert to MAJOR units here
// so the API/UI layer never needs to know Stripe's minor-unit rule.
//
// Time: everything is bucketed by Asia/Bangkok day via lib/bangkokTz — Stripe's
// `created` is a UTC epoch, so we convert per-txn. Thailand has no DST (fixed
// +07:00), so day enumeration by +24h steps is exact.

import Stripe from "stripe"
import { bangkokDayKey, bangkokDayStart } from "@/lib/bangkokTz"

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

// Zero-decimal currencies charged in whole units (no /100). THB is NOT one.
const ZERO_DECIMAL = new Set(["jpy", "krw", "vnd", "clp", "bif", "djf", "gnf", "kmf", "mga", "pyg", "rwf", "ugx", "vuv", "xaf", "xof", "xpf"])

/** Stripe minor units → major units, respecting zero-decimal currencies. */
export function stripeMajor(amount: number, currency: string): number {
  return ZERO_DECIMAL.has(currency.toLowerCase()) ? amount : amount / 100
}

const round2 = (n: number) => Math.round(n * 100) / 100

export type StripeDaily = {
  day: string // Bangkok "YYYY-MM-DD"
  gross: number
  fee: number
  net: number
  refunds: number
  count: number
}

export type StripeReport = {
  currency: string
  gross: number // sum of charge amounts (before fee)
  fee: number // real Stripe processing fee on those charges
  net: number // gross − fee − refunds (money actually kept)
  refunds: number // total refunded to customers (positive number)
  refundCount: number
  count: number // number of successful charges
  adjustments: number // disputes/chargebacks & other adjustments (signed)
  otherFees: number // stripe_fee/billing type entries (monthly fees etc.)
  daily: StripeDaily[]
}

// ── tiny module-level cache (per web process) ────────────────────────────────
// A month of balance transactions is several paginated calls; avoid re-pulling
// on every dashboard poll. TTL is short so numbers stay near-live.
const CACHE_TTL_MS = 60_000
const cache = new Map<string, { at: number; data: StripeReport }>()

function emptyDay(day: string): StripeDaily {
  return { day, gross: 0, fee: 0, net: 0, refunds: 0, count: 0 }
}

/** Every Bangkok day key in [fromMs, toMs], inclusive of both ends' days. */
function bangkokDayKeysInRange(fromMs: number, toMs: number): string[] {
  const keys: string[] = []
  let cursor = bangkokDayStart(new Date(fromMs)).getTime()
  const endDayStart = bangkokDayStart(new Date(toMs)).getTime()
  // +24h steps are exact in a DST-free zone; guard the loop regardless.
  for (let i = 0; cursor <= endDayStart && i < 400; i++) {
    keys.push(bangkokDayKey(new Date(cursor)))
    cursor += 24 * 60 * 60 * 1000
  }
  return keys
}

/**
 * Pull + aggregate Stripe balance transactions for [fromMs, toMs].
 * `fresh` bypasses the cache read (a manual refresh always re-pulls).
 */
export async function getStripeReport(fromMs: number, toMs: number, fresh = false): Promise<StripeReport> {
  const key = `${fromMs}:${toMs}`
  const hit = cache.get(key)
  if (!fresh && hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.data

  // autoPagingToArray caps `limit` at 10,000; use autoPagingEach to iterate
  // every page with no such cap, guarded by a safety ceiling so a pathological
  // range can never OOM the web process.
  const SAFETY_CAP = 100_000
  const txns: BalanceTxnInput[] = []
  await stripe.balanceTransactions
    .list({
      created: { gte: Math.floor(fromMs / 1000), lte: Math.floor(toMs / 1000) },
      limit: 100,
    })
    .autoPagingEach((tx) => {
      txns.push(tx)
      if (txns.length >= SAFETY_CAP) return false // stop paging
    })

  const data = aggregateBalanceTxns(txns, fromMs, toMs)
  cache.set(key, { at: Date.now(), data })
  return data
}

/** The txn fields the aggregation needs (subset of Stripe.BalanceTransaction). */
export type BalanceTxnInput = {
  type: string
  amount: number
  fee: number
  net: number
  currency: string
  created: number // unix seconds
}

/**
 * Pure aggregation of balance transactions into a StripeReport. Split out from
 * the network fetch so the money math + Bangkok-day bucketing are unit-testable
 * without hitting Stripe. Amounts in → major units out.
 */
export function aggregateBalanceTxns(txns: BalanceTxnInput[], fromMs: number, toMs: number): StripeReport {
  // Seed every day in range so the chart has no gaps.
  const byDay = new Map<string, StripeDaily>()
  for (const dk of bangkokDayKeysInRange(fromMs, toMs)) byDay.set(dk, emptyDay(dk))

  let currency = "thb"
  let gross = 0, fee = 0, refunds = 0, refundCount = 0, count = 0, adjustments = 0, otherFees = 0

  for (const tx of txns) {
    currency = tx.currency || currency
    const amt = stripeMajor(tx.amount, tx.currency)
    const txFee = stripeMajor(tx.fee, tx.currency)
    const txNet = stripeMajor(tx.net, tx.currency)
    const dk = bangkokDayKey(new Date(tx.created * 1000))
    const day = byDay.get(dk) ?? emptyDay(dk)

    switch (tx.type) {
      case "charge":
      case "payment": {
        gross += amt
        fee += txFee
        count += 1
        day.gross += amt
        day.fee += txFee
        day.net += txNet
        day.count += 1
        break
      }
      case "refund":
      case "payment_refund": {
        // amount is negative (money leaving). Track as positive "refunds".
        refunds += -amt
        refundCount += 1
        day.refunds += -amt
        day.net += txNet
        break
      }
      case "adjustment": {
        // Disputes / chargebacks (signed — can be negative or a reversal).
        adjustments += amt
        break
      }
      case "stripe_fee":
      case "stripe_fx_fee":
      case "tax_fee": {
        // Stripe's own fees (monthly billing, FX, tax) — net is negative.
        otherFees += -txNet
        break
      }
      // payout / payout_cancel / transfer: money movement to bank — surfaced
      // separately via the Payouts API, not counted as revenue here.
      default:
        break
    }
    byDay.set(dk, day)
  }

  const daily = [...byDay.values()]
    .map((d) => ({ day: d.day, gross: round2(d.gross), fee: round2(d.fee), net: round2(d.net), refunds: round2(d.refunds), count: d.count }))
    .sort((a, b) => (a.day < b.day ? -1 : 1))

  return {
    currency,
    gross: round2(gross),
    fee: round2(fee),
    // Net kept = gross − fee − refunds. (Sum of charge `net` already = gross−fee;
    // refund `net` entries then subtract the refunded money.)
    net: round2(gross - fee - refunds),
    refunds: round2(refunds),
    refundCount,
    count,
    adjustments: round2(adjustments),
    otherFees: round2(otherFees),
    daily,
  }
}

export type StripeBalance = {
  available: { amount: number; currency: string }[]
  pending: { amount: number; currency: string }[]
}

/** Current Stripe balance (money on hand / still clearing). */
export async function getStripeBalance(): Promise<StripeBalance> {
  const b = await stripe.balance.retrieve()
  const conv = (arr: { amount: number; currency: string }[]) =>
    arr.map((x) => ({ amount: round2(stripeMajor(x.amount, x.currency)), currency: x.currency }))
  return { available: conv(b.available), pending: conv(b.pending) }
}

export type StripePayout = {
  id: string
  amount: number
  currency: string
  status: string // paid | pending | in_transit | canceled | failed
  method: string | null // standard | instant
  created: string // ISO
  arrival_date: string // ISO (expected/actual bank arrival)
}

/** Recent bank payouts (money Stripe sent / is sending to the bank account). */
export async function getStripePayouts(limit = 12): Promise<StripePayout[]> {
  const res = await stripe.payouts.list({ limit })
  return res.data.map((p) => ({
    id: p.id,
    amount: round2(stripeMajor(p.amount, p.currency)),
    currency: p.currency,
    status: p.status,
    method: p.method ?? null,
    created: new Date(p.created * 1000).toISOString(),
    arrival_date: new Date(p.arrival_date * 1000).toISOString(),
  }))
}

// ── Charge-level detail: method / card-country breakdown, drill-down, risk ────
// Balance transactions don't carry the payment method, so we pull the Charges
// (with the balance_transaction expanded for the REAL fee/net) — Charges have
// payment_method_details inline (type + card brand/last4/country).

export type ChargeRow = {
  id: string
  created: string // ISO
  amount: number // gross (major)
  fee: number // real Stripe fee (major)
  net: number // amount − fee (major)
  method: string // 'card' | 'promptpay' | ...
  brand: string | null // card brand
  last4: string | null
  country: string | null // card issuing country (ISO-2)
  status: string // succeeded | failed | pending
  blocked: boolean // Radar-blocked
  refunded: number // amount refunded on this charge (major)
}

/** Bucket a charge into the fee-model's categories. */
export function chargeMethodKey(method: string, country: string | null): "card_th" | "card_foreign" | "promptpay" | "other" {
  if (method === "promptpay") return "promptpay"
  if (method === "card") return country === "TH" ? "card_th" : "card_foreign"
  return "other"
}

export type MethodBreakdownRow = {
  key: "card_th" | "card_foreign" | "promptpay" | "other"
  gross: number
  fee: number
  net: number
  count: number
  unknownCountry: number // card rows with no issuing country reported
}

export type StripeRisk = {
  succeeded: { count: number; amount: number }
  blocked: { count: number; amount: number }
  failed: { count: number; amount: number }
  successRate: number // 0–100, over succeeded+blocked+failed
}

export type ChargeSummary = {
  byMethod: MethodBreakdownRow[]
  risk: StripeRisk
  transactions: ChargeRow[] // recent successful charges (already trimmed)
}

/**
 * Pure aggregation of charge rows → method breakdown + risk + a recent-txn list.
 * Split from the fetch so the classification/rollup is unit-testable.
 * `txnLimit` caps the drill-down list (most-recent successful first).
 */
export function summarizeCharges(rows: ChargeRow[], txnLimit = 50): ChargeSummary {
  const per = new Map<MethodBreakdownRow["key"], MethodBreakdownRow>()
  const risk: StripeRisk = {
    succeeded: { count: 0, amount: 0 },
    blocked: { count: 0, amount: 0 },
    failed: { count: 0, amount: 0 },
    successRate: 0,
  }

  for (const r of rows) {
    if (r.blocked) { risk.blocked.count++; risk.blocked.amount += r.amount; continue }
    if (r.status === "failed") { risk.failed.count++; risk.failed.amount += r.amount; continue }
    if (r.status !== "succeeded") continue // pending/other: not counted in risk or revenue

    risk.succeeded.count++; risk.succeeded.amount += r.amount

    const key = chargeMethodKey(r.method, r.country)
    const row = per.get(key) ?? { key, gross: 0, fee: 0, net: 0, count: 0, unknownCountry: 0 }
    row.gross += r.amount
    row.fee += r.fee
    row.net += r.net
    row.count += 1
    if (r.method === "card" && r.country === null) row.unknownCountry += 1
    per.set(key, row)
  }

  const decided = risk.succeeded.count + risk.blocked.count + risk.failed.count
  risk.successRate = decided > 0 ? round2((risk.succeeded.count / decided) * 100) : 0
  risk.succeeded.amount = round2(risk.succeeded.amount)
  risk.blocked.amount = round2(risk.blocked.amount)
  risk.failed.amount = round2(risk.failed.amount)

  const order: MethodBreakdownRow["key"][] = ["card_th", "card_foreign", "promptpay", "other"]
  const byMethod = [...per.values()]
    .map((r) => ({ ...r, gross: round2(r.gross), fee: round2(r.fee), net: round2(r.net) }))
    .sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key))

  const transactions = rows
    .filter((r) => r.status === "succeeded" && !r.blocked)
    .sort((a, b) => (a.created < b.created ? 1 : -1))
    .slice(0, txnLimit)

  return { byMethod, risk, transactions }
}

const chargeCache = new Map<string, { at: number; data: ChargeSummary }>()

/** Fetch + summarize charges in [fromMs, toMs] (method breakdown, risk, table). */
export async function getStripeChargeSummary(fromMs: number, toMs: number, fresh = false): Promise<ChargeSummary> {
  const key = `${fromMs}:${toMs}`
  const hit = chargeCache.get(key)
  if (!fresh && hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.data

  const SAFETY_CAP = 100_000
  const rows: ChargeRow[] = []
  await stripe.charges
    .list({
      created: { gte: Math.floor(fromMs / 1000), lte: Math.floor(toMs / 1000) },
      limit: 100,
      expand: ["data.balance_transaction"],
    })
    .autoPagingEach((c) => {
      const bt = typeof c.balance_transaction === "object" && c.balance_transaction ? c.balance_transaction : null
      const pmd = c.payment_method_details
      const card = pmd?.card ?? null
      const amount = stripeMajor(c.amount, c.currency)
      rows.push({
        id: c.id,
        created: new Date(c.created * 1000).toISOString(),
        amount,
        fee: bt ? round2(stripeMajor(bt.fee, bt.currency)) : 0,
        net: bt ? round2(stripeMajor(bt.net, bt.currency)) : 0,
        method: pmd?.type ?? "unknown",
        brand: card?.brand ?? null,
        last4: card?.last4 ?? null,
        country: card?.country ?? null,
        status: c.status,
        blocked: c.outcome?.type === "blocked",
        refunded: round2(stripeMajor(c.amount_refunded, c.currency)),
      })
      if (rows.length >= SAFETY_CAP) return false
    })

  const data = summarizeCharges(rows)
  chargeCache.set(key, { at: Date.now(), data })
  return data
}

export type DisputeRow = {
  id: string
  amount: number // major
  currency: string
  status: string // needs_response | under_review | won | lost | warning_* ...
  reason: string
  created: string // ISO
  charge: string | null
}

/** Card disputes / chargebacks opened in the range. */
export async function getStripeDisputes(fromMs: number, toMs: number, limit = 50): Promise<DisputeRow[]> {
  const res = await stripe.disputes.list({
    created: { gte: Math.floor(fromMs / 1000), lte: Math.floor(toMs / 1000) },
    limit,
  })
  return res.data.map((d) => ({
    id: d.id,
    amount: round2(stripeMajor(d.amount, d.currency)),
    currency: d.currency,
    status: d.status,
    reason: d.reason,
    created: new Date(d.created * 1000).toISOString(),
    charge: typeof d.charge === "string" ? d.charge : d.charge?.id ?? null,
  }))
}
