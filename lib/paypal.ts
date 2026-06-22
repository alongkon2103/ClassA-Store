// PayPal REST API helper — sandbox or live, controlled by PAYPAL_BASE_URL.
// Defaults to sandbox; set PAYPAL_BASE_URL=https://api-m.paypal.com for live.

const PAYPAL_BASE = process.env.PAYPAL_BASE_URL || "https://api-m.sandbox.paypal.com"

let cachedToken: { token: string; expiresAt: number } | null = null

export async function getPayPalAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.token
  }
  const clientId = process.env.PAYPAL_CLIENT_ID
  const secret = process.env.PAYPAL_CLIENT_SECRET
  if (!clientId || !secret) throw new Error("PayPal credentials missing")

  const basic = Buffer.from(`${clientId}:${secret}`).toString("base64")
  const res = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
    cache: "no-store",
  })
  if (!res.ok) {
    const body = await res.text().catch(() => "")
    throw new Error(`PayPal token request failed: ${res.status} ${body}`)
  }
  const data = (await res.json()) as { access_token: string; expires_in: number }
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  }
  return cachedToken.token
}

export type PayPalOrderCreated = {
  id: string
  approveUrl: string
}

export async function createPayPalOrder(opts: {
  amount: number
  currency: string
  description: string
  customId: string
  returnUrl: string
  cancelUrl: string
}): Promise<PayPalOrderCreated> {
  const token = await getPayPalAccessToken()
  const res = await fetch(`${PAYPAL_BASE}/v2/checkout/orders`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [
        {
          custom_id: opts.customId,
          description: opts.description.slice(0, 127),
          amount: {
            currency_code: opts.currency,
            value: opts.amount.toFixed(2),
          },
        },
      ],
      application_context: {
        brand_name: "A Class Store",
        landing_page: "LOGIN",
        user_action: "PAY_NOW",
        shipping_preference: "NO_SHIPPING",
        return_url: opts.returnUrl,
        cancel_url: opts.cancelUrl,
      },
    }),
    cache: "no-store",
  })
  const data: any = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(`PayPal order create failed: ${res.status} ${JSON.stringify(data)}`)
  }
  const approveLink = (data.links || []).find((l: any) => l.rel === "approve")
  if (!approveLink?.href || !data.id) {
    throw new Error("PayPal didn't return approve link")
  }
  return { id: data.id, approveUrl: approveLink.href }
}

export type PayPalCapture = {
  status: string
  captureId: string | null
  payerEmail: string | null
  amount: { currency: string; value: string } | null
}

export async function capturePayPalOrder(orderId: string): Promise<PayPalCapture> {
  const token = await getPayPalAccessToken()
  const res = await fetch(`${PAYPAL_BASE}/v2/checkout/orders/${orderId}/capture`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      // PayPal Prefer header recommended on capture
      Prefer: "return=representation",
    },
    cache: "no-store",
  })
  const data: any = await res.json().catch(() => ({}))
  // ORDER_ALREADY_CAPTURED → treat as a retry success; fetch the existing order
  if (!res.ok && data?.details?.[0]?.issue === "ORDER_ALREADY_CAPTURED") {
    return await getPayPalOrder(orderId)
  }
  if (!res.ok) {
    throw new Error(`PayPal capture failed: ${res.status} ${JSON.stringify(data)}`)
  }
  const capture = data?.purchase_units?.[0]?.payments?.captures?.[0]
  return {
    status: data?.status || "UNKNOWN",
    captureId: capture?.id || null,
    payerEmail: data?.payer?.email_address || null,
    amount: capture?.amount
      ? { currency: capture.amount.currency_code, value: capture.amount.value }
      : null,
  }
}

export async function getPayPalOrder(orderId: string): Promise<PayPalCapture> {
  const token = await getPayPalAccessToken()
  const res = await fetch(`${PAYPAL_BASE}/v2/checkout/orders/${orderId}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  })
  const data: any = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(`PayPal order fetch failed: ${res.status} ${JSON.stringify(data)}`)
  }
  const capture = data?.purchase_units?.[0]?.payments?.captures?.[0]
  return {
    status: data?.status || "UNKNOWN",
    captureId: capture?.id || null,
    payerEmail: data?.payer?.email_address || null,
    amount: capture?.amount
      ? { currency: capture.amount.currency_code, value: capture.amount.value }
      : null,
  }
}

// THB → USD exchange rate, cached 6h to avoid hammering open.er-api.com.
// Falls back to a conservative 0.028 (≈ 1 USD = 35.7 THB) on network failure
// so checkout never breaks because of a flaky rate API.
let cachedRate: { rate: number; fetchedAt: number } | null = null
const RATE_TTL_MS = 6 * 60 * 60 * 1000
const FALLBACK_RATE = 0.028

export async function getThbToUsdRate(): Promise<number> {
  if (cachedRate && Date.now() - cachedRate.fetchedAt < RATE_TTL_MS) {
    return cachedRate.rate
  }
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/THB", { cache: "no-store" })
    if (res.ok) {
      const data: any = await res.json()
      const rate = data?.rates?.USD
      if (typeof rate === "number" && rate > 0) {
        cachedRate = { rate, fetchedAt: Date.now() }
        return rate
      }
    }
  } catch {
    // fall through to fallback
  }
  return FALLBACK_RATE
}

export function convertThbToUsd(thb: number, rate: number): number {
  // round to 2 decimal places (PayPal requires 2dp for USD)
  return Math.max(0.01, Math.round(thb * rate * 100) / 100)
}
