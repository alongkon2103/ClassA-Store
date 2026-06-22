// Per-method payment config (enabled flag + surcharge %) stored in system_configs.
// Both the Stripe/PayPal checkout routes and the product modal read from here so
// changes in /admin/settings take effect everywhere without a redeploy.
//
// Stored as plain string values:
//   payment_card_enabled        = "true" | "false"
//   payment_card_fee_pct        = "6"   (percent, not fraction; 6 = 6%)
//   payment_promptpay_enabled   = "true" | "false"
//   payment_promptpay_fee_pct   = "0"
//   payment_paypal_enabled      = "true" | "false"
//   payment_paypal_fee_pct      = "0"
//
// 30-second in-memory cache so the checkout hot path doesn't hit the DB every
// time. Admin saves immediately bump the cache key by writing through.

import { prisma } from "@/lib/prisma"

export type PaymentMethodKey = "card" | "promptpay" | "paypal"

export type PaymentMethodConfig = {
  enabled: boolean
  fee_pct: number // percent, 6 means 6%
}

export type PaymentConfig = Record<PaymentMethodKey, PaymentMethodConfig>

const DEFAULTS: PaymentConfig = {
  card: { enabled: true, fee_pct: 6 },
  promptpay: { enabled: true, fee_pct: 0 },
  paypal: { enabled: true, fee_pct: 0 },
}

export const PAYMENT_CONFIG_KEYS = {
  card_enabled: "payment_card_enabled",
  card_fee_pct: "payment_card_fee_pct",
  promptpay_enabled: "payment_promptpay_enabled",
  promptpay_fee_pct: "payment_promptpay_fee_pct",
  paypal_enabled: "payment_paypal_enabled",
  paypal_fee_pct: "payment_paypal_fee_pct",
} as const

let cache: { config: PaymentConfig; fetchedAt: number } | null = null
const CACHE_TTL_MS = 30 * 1000

function parseBool(v: string | undefined, fallback: boolean): boolean {
  if (v === undefined || v === null || v === "") return fallback
  if (v === "true") return true
  if (v === "false") return false
  return fallback
}

function parseFee(v: string | undefined, fallback: number): number {
  if (v === undefined || v === null || v === "") return fallback
  const n = parseFloat(v)
  if (!Number.isFinite(n) || n < 0) return fallback
  // cap at 50% — guard against typos like "60" meaning 0.60
  return Math.min(n, 50)
}

export function invalidatePaymentConfigCache() {
  cache = null
}

export async function getPaymentConfig(): Promise<PaymentConfig> {
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.config
  }
  const rows = await prisma.system_configs.findMany({
    where: { key: { in: Object.values(PAYMENT_CONFIG_KEYS) } },
    select: { key: true, value: true },
  })
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]))

  const config: PaymentConfig = {
    card: {
      enabled: parseBool(map[PAYMENT_CONFIG_KEYS.card_enabled], DEFAULTS.card.enabled),
      fee_pct: parseFee(map[PAYMENT_CONFIG_KEYS.card_fee_pct], DEFAULTS.card.fee_pct),
    },
    promptpay: {
      enabled: parseBool(map[PAYMENT_CONFIG_KEYS.promptpay_enabled], DEFAULTS.promptpay.enabled),
      fee_pct: parseFee(map[PAYMENT_CONFIG_KEYS.promptpay_fee_pct], DEFAULTS.promptpay.fee_pct),
    },
    paypal: {
      enabled: parseBool(map[PAYMENT_CONFIG_KEYS.paypal_enabled], DEFAULTS.paypal.enabled),
      fee_pct: parseFee(map[PAYMENT_CONFIG_KEYS.paypal_fee_pct], DEFAULTS.paypal.fee_pct),
    },
  }
  cache = { config, fetchedAt: Date.now() }
  return config
}

export function computeFeeAmount(subtotal: number, feePct: number): number {
  if (!Number.isFinite(subtotal) || !Number.isFinite(feePct)) return 0
  if (subtotal <= 0 || feePct <= 0) return 0
  return subtotal * (feePct / 100)
}
