// Single source of truth for the THB→USD rate the UI shows. The product modal
// used to fetch open.er-api.com directly (fresh every time), while the checkout
// backend uses getThbToUsdRate() (cached 6h). That mismatch made the price shown
// before buying differ from the amount frozen on the order. Serving the SAME
// getThbToUsdRate() here — and having the modal read it — keeps both sides on the
// identical rate, so the only remaining difference is the tiny random cents.

import { NextResponse } from "next/server"
import { getThbToUsdRate } from "@/lib/paypal"

export const runtime = "nodejs"

export async function GET() {
  const rate = await getThbToUsdRate()
  return NextResponse.json({ rate })
}
