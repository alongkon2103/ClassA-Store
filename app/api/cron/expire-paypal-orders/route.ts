// Cron: expire stale PayPal.me orders. A paypal_me order is payable for 24h
// (see PAYPAL_ME_EXPIRY_MS). Once past expires_at with no payment, we flip it to
// status="expired" and release any discount it was holding so the code frees up.
//
// We DELIBERATELY do not recycle its expected_amount here — the matcher keeps a
// 24h buffer (PAYPAL_ME_RECYCLE_BUFFER_MS) so a late payment against a just-
// expired order still lands in the review queue instead of colliding with a new
// order that reused the amount.
//
// Trigger it the same way as the existing stats cron — an external scheduler
// (Task Scheduler / cron / uptime pinger) calling:
//   GET /api/cron/expire-paypal-orders   with header  Authorization: Bearer <CRON_SECRET>
//
// Safe to run as often as you like (every 1–5 min). Idempotent: only pending,
// already-past-expiry paypal_me orders are touched.

import { NextResponse } from "next/server"
import { headers } from "next/headers"
import { expireStalePayPalMeOrders } from "@/lib/paypalMe"

export const runtime = "nodejs"

async function authorize(): Promise<boolean> {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const hdrs = await headers()
  return (hdrs.get("authorization") ?? "") === `Bearer ${secret}`
}

export async function GET() {
  if (!(await authorize())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const expired = await expireStalePayPalMeOrders()
    return NextResponse.json({ ok: true, expired })
  } catch (err: unknown) {
    console.error("[/api/cron/expire-paypal-orders] error:", err)
    return NextResponse.json({ error: (err as Error)?.message ?? "expire failed" }, { status: 500 })
  }
}
