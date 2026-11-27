import { randomUUID } from "node:crypto"
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { TikkiesError } from "@/lib/integrations/tikkies"
import { parseLibraryRequest, readTikkiesLibrary } from "@/lib/integrations/tikkiesLibrary"
import { authenticateTikkies, limitTikkiesSubject, readTikkiesBody } from "@/lib/integrations/tikkiesSecurity"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export async function POST(req: NextRequest) {
  const headers: Record<string, string> = { "Cache-Control": "no-store, private", "X-Request-Id": randomUUID() }
  try {
    const credential = authenticateTikkies(req)
    if (req.nextUrl.search) throw new TikkiesError("invalid_input", 400)
    const input = parseLibraryRequest(await readTikkiesBody(req))
    const retry = await limitTikkiesSubject(prisma, "library:" + (input.email || "anonymous"), credential)
    if (retry) { headers["Retry-After"] = String(retry); throw new TikkiesError("rate_limited", 429) }
    const origin = new URL(process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || req.url).origin
    const result = await prisma.$transaction(tx => readTikkiesLibrary(tx, input.email, new Date(), origin, input.productId,input.identities), { isolationLevel: "RepeatableRead", timeout: 10000 })
    return NextResponse.json(result, { headers })
  } catch (error) {
    return NextResponse.json({ error: error instanceof TikkiesError ? error.code : "library_unavailable", requestId: headers["X-Request-Id"] }, { status: error instanceof TikkiesError ? error.status : 503, headers })
  }
}
