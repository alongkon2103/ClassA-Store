import { randomUUID } from "node:crypto"
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { GameDefaultsError } from "@/lib/tikkiesGameDefaults"
import { TikkiesError } from "@/lib/integrations/tikkies"
import { parsePresetRequest } from "@/lib/integrations/tikkiesPreset"
import { authenticateTikkies, limitTikkiesSubject, readTikkiesBody } from "@/lib/integrations/tikkiesSecurity"
import { readTikkiesGameDefaults } from "@/lib/integrations/tikkiesGameDefaults"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export async function POST(req: NextRequest) {
  const headers: Record<string, string> = { "Cache-Control": "no-store, private", "X-Request-Id": randomUUID() }
  try {
    const credential = authenticateTikkies(req)
    if (req.nextUrl.search) throw new TikkiesError("invalid_input", 400)
    const input = parsePresetRequest(await readTikkiesBody(req))
    const retry = await limitTikkiesSubject(prisma, "actions:" + input.email, credential)
    if (retry) { headers["Retry-After"] = String(retry); throw new TikkiesError("rate_limited", 429) }
    const origin = new URL(process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || req.url).origin
    return NextResponse.json(await readTikkiesGameDefaults(prisma, input, origin), { headers })
  } catch (error) {
    const known = error instanceof GameDefaultsError || error instanceof TikkiesError
    return NextResponse.json({ error: known ? error.code : "defaults_unavailable", requestId: headers["X-Request-Id"] }, { status: known ? error.status : 503, headers })
  }
}
