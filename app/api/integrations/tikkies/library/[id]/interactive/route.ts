import { randomUUID } from "node:crypto"
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { TikkiesError } from "@/lib/integrations/tikkies"
import { GameDefaultsError, defaultsRecord } from "@/lib/tikkiesGameDefaults"
import { parseLibraryRequest } from "@/lib/integrations/tikkiesLibrary"
import { readTikkiesInteractiveConfig } from "@/lib/integrations/tikkiesGameDefaults"
import { authenticateTikkies, limitTikkiesSubject, readTikkiesBody } from "@/lib/integrations/tikkiesSecurity"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const headers: Record<string, string> = { "Cache-Control": "no-store, private", "X-Request-Id": randomUUID() }
  try {
    const credential = authenticateTikkies(req)
    if (req.nextUrl.search) throw new TikkiesError("invalid_input", 400)
    const { id } = await params, body = await readTikkiesBody(req)
    if (!defaultsRecord(body) || Object.keys(body).some(key => key !== "email")) throw new TikkiesError("invalid_input", 400)
    const input = parseLibraryRequest({ ...body, productId: id })
    if (!input.email) throw new TikkiesError("invalid_input", 400)
    const retry = await limitTikkiesSubject(prisma, "interactive:" + input.email, credential)
    if (retry) { headers["Retry-After"] = String(retry); throw new TikkiesError("rate_limited", 429) }
    const origin = new URL(process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || req.url).origin
    return NextResponse.json(await readTikkiesInteractiveConfig(prisma, { email: input.email, productId: id }, origin), { headers })
  } catch (error) {
    const known = error instanceof TikkiesError || error instanceof GameDefaultsError
    return NextResponse.json({ error: known ? error.code : "integration_unavailable", requestId: headers["X-Request-Id"] }, { status: known ? error.status : 503, headers })
  }
}
