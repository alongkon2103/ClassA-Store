// Helpers for the PayPal.me email-verification checkout flow.
//
// The customer pays a PayPal.me link by hand, so the ONLY thing tying their
// payment back to an order is the exact amount they send. We therefore freeze a
// unique USD amount on the order at creation time:
//   expected_amount = (THB→USD converted price) + a small random cent offset
//                     that no other *recent* paypal_me order is using.
// "Recent" = still active OR expired within the last 24h, so a customer who pays
// late can't collide with a brand-new order that recycled the same amount.

import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { releaseOrderDiscount } from "@/lib/discountCodes"

export const PAYPAL_ME_CURRENCY = "USD" // default currency when none is configured
export const PAYPAL_ME_EXPIRY_MS = 30 * 60 * 1000 // order is payable for 30 minutes
export const PAYPAL_ME_RECYCLE_BUFFER_MS = 24 * 60 * 60 * 1000 // keep an amount reserved 24h past expiry

export type PayPalMeCurrency = "USD" | "THB"

const round2 = (n: number) => Math.round(n * 100) / 100

// PayPal.me link, admin-editable via system_configs, env fallback for first boot.
export async function getPayPalMeLink(): Promise<string> {
  const row = await prisma.system_configs.findUnique({ where: { key: "paypal_me_link" } })
  return (row?.value?.trim() || process.env.PAYPAL_ME_LINK || "").trim()
}

// Which currency the customer actually sends. Admin-switchable in Settings
// (system_configs key "paypal_me_currency"); defaults to USD. THB mode exists so
// the shop owner can test the whole match flow with a Thai PayPal account, which
// can only send THB — the matcher keys on amount + currency either way.
export async function getPayPalMeCurrency(): Promise<PayPalMeCurrency> {
  const row = await prisma.system_configs.findUnique({ where: { key: "paypal_me_currency" } })
  return row?.value === "THB" ? "THB" : "USD"
}

// Build a "paypal.me/<name>/<amount><CUR>" deep link that prefills the exact
// amount + currency so the customer is less likely to mistype it. Returns "" if
// no link configured.
export function buildPayPalMePayUrl(
  link: string,
  amount: number,
  currency: string = PAYPAL_ME_CURRENCY,
): string {
  if (!link) return ""
  const base = link.replace(/\/+$/, "")
  return `${base}/${amount.toFixed(2)}${currency}`
}

// Amounts already taken by any paypal_me order that is still active or expired
// within the recycle buffer. Returned as a Set of "x.xx" strings for exact
// compare. excludeOrderId skips one order (used when recomputing an existing
// pending order's own amount so it doesn't treat its old figure as taken).
async function reservedAmounts(
  tx: Prisma.TransactionClient,
  currency: string,
  excludeOrderId?: string,
): Promise<Set<string>> {
  const cutoff = new Date(Date.now() - PAYPAL_ME_RECYCLE_BUFFER_MS)
  const rows = await tx.orders.findMany({
    where: {
      payment_method: "paypal_me",
      expected_currency: currency,
      expected_amount: { not: null },
      // active (expires_at > now) OR expired-but-within-buffer (expires_at > now-24h)
      expires_at: { gt: cutoff },
      ...(excludeOrderId ? { id: { not: excludeOrderId } } : {}),
    },
    select: { expected_amount: true },
  })
  return new Set(rows.map((r) => Number(r.expected_amount).toFixed(2)))
}

// The valid amount window for a given displayed price: from the price itself up
// to (but not including) the next whole dollar. So $16.57 → [16.57 .. 16.99].
// This guarantees the charged amount is NEVER below what the customer saw and
// NEVER crosses into the next dollar, while still leaving unique cent slots.
export function amountWindow(baseUsd: number): { floor: number; startCents: number } {
  const floor = Math.floor(baseUsd)
  const startCents = Math.round((baseUsd - floor) * 100) // e.g. 57 for 16.57
  return { floor, startCents }
}

// True if a frozen amount is still valid for the current displayed price:
// at least the price and below the next whole dollar.
export function isAmountInWindow(amount: number, baseUsd: number): boolean {
  return amount >= baseUsd - 0.001 && amount < Math.floor(baseUsd) + 1
}

// Pick a unique amount in [baseAmount .. floor(baseAmount)+0.99] for the given
// currency. Starts from a random cent in that window so amounts don't cluster.
// Throws PAYPAL_ME_NO_UNIQUE_AMOUNT if every slot is taken (practically
// impossible at this volume) so the caller can surface a "try again shortly".
export async function pickUniqueExpectedAmount(
  tx: Prisma.TransactionClient,
  baseAmount: number,
  currency: string = PAYPAL_ME_CURRENCY,
  excludeOrderId?: string,
): Promise<number> {
  const taken = await reservedAmounts(tx, currency, excludeOrderId)
  const { floor, startCents } = amountWindow(baseAmount)
  const span = 100 - startCents // cents from startCents..99 (>= price, < next dollar)
  const offset = Math.floor(Math.random() * span)
  for (let i = 0; i < span; i++) {
    const cents = startCents + ((offset + i) % span)
    const candidate = round2(floor + cents / 100)
    if (!taken.has(candidate.toFixed(2))) return candidate
  }
  throw new Error("PAYPAL_ME_NO_UNIQUE_AMOUNT")
}

// Flip pending paypal_me orders past their expiry to "expired" and release any
// discount they held. Shared by the cron route and the worker's periodic sweep.
// We do NOT recycle expected_amount here — the matcher's 24h buffer handles late
// payments. Idempotent; returns how many orders were expired.
export async function expireStalePayPalMeOrders(): Promise<number> {
  const now = new Date()
  const stale = await prisma.orders.findMany({
    where: {
      payment_method: "paypal_me",
      status: "pending",
      expires_at: { lt: now },
    },
    select: { id: true },
  })

  let expired = 0
  for (const { id } of stale) {
    await prisma.$transaction(async (tx) => {
      await releaseOrderDiscount(tx, id)
      await tx.orders.update({
        where: { id },
        data: { status: "expired", whitelist_status: "expired", updated_at: new Date() },
      })
    })
    expired++
  }
  return expired
}
