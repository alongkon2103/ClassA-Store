import { randomUUID } from "node:crypto"
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { parseIdentities, readTikkiesEntitlements, TikkiesError } from "@/lib/integrations/tikkies"
import { authenticateTikkies, limitTikkies, readTikkiesBody } from "@/lib/integrations/tikkiesSecurity"
import { resolvePurchasedAccounts } from "@/lib/integrations/tikkiesAutoRoblox"
export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export async function POST(req: NextRequest) {
  const requestId = randomUUID(), started = Date.now()
  const headers: Record<string, string> = { "Cache-Control": "no-store", "X-Request-Id": requestId }
  let status = 503, outcome = "entitlements_unavailable"
  try {
    const credential = authenticateTikkies(req)
    const identities = parseIdentities(await readTikkiesBody(req))
    const retryAfter = await limitTikkies(prisma, identities, credential)
    if (retryAfter) {
      headers["Retry-After"] = String(retryAfter)
      throw new TikkiesError("rate_limited", 429)
    }
    const read = () => prisma.$transaction(tx => readTikkiesEntitlements(tx, identities, new Date()), { isolationLevel: "RepeatableRead", timeout: 10000 })
    let data = await read()
    if (await resolvePurchasedAccounts(prisma, data)) data = await read()
    status = 200; outcome = "ok"
    return NextResponse.json(data, { headers })
  } catch (error) {
    if (error instanceof TikkiesError) { status = error.status; outcome = error.code }
    return NextResponse.json({ error: outcome, requestId, ...(outcome === "customer_not_found" ? { action: "use_original_provider_or_link_accounts" } : {}) }, { status, headers })
  } finally {
    console.info(JSON.stringify({ event: "tikkies_entitlements", requestId, status, outcome, durationMs: Date.now() - started }))
  }
}
