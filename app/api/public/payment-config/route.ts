// Public read-only payment config (enabled flag + fee_pct per method).
// Read by ProductModal to:
//   - skip disabled methods in the swap cycle
//   - render the correct fee badge / surcharge amount
//
// No auth — the data is non-secret and the client needs it before login.

import { NextResponse } from "next/server"
import { getPaymentConfig } from "@/lib/paymentConfig"

export const runtime = "nodejs"

export async function GET() {
  const config = await getPaymentConfig()
  return NextResponse.json(config)
}
