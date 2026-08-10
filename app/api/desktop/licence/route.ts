// app/api/desktop/licence/route.ts
//
// GET /api/desktop/licence?program=<program_key>
// Issue a short-lived Ed25519-signed licence "pass" for one program. Auth:
// Bearer desktop token AND an active entitlement for that program. not-after is
// capped by THAT program's expiry.
//
//   200 → { token }
//   400 → missing/unknown program
//   401 → invalid token
//   403 → no access (expired / kicked / never granted) — plugin drops its pass
//   500 → server missing LICENCE_PRIVATE_KEY

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyAccessToken, bearerFrom } from "@/lib/desktopAuth"
import { resolveProgram, programAccessState } from "@/lib/desktopProgram"
import { signLicence } from "@/lib/desktopLicence"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const token = bearerFrom(req.headers.get("authorization"))
  const ctx = token ? await verifyAccessToken(token) : null
  if (!ctx) return NextResponse.json({ error: "Unauthorized", errorCode: "INVALID_TOKEN" }, { status: 401 })

  const program = await resolveProgram(new URL(req.url).searchParams.get("program"))
  if (!program) return NextResponse.json({ error: "Unknown program", errorCode: "UNKNOWN_PROGRAM" }, { status: 400 })

  const user = await prisma.users.findUnique({
    where: { id: ctx.userId },
    select: { id: true, nativeStatus: true },
  })
  if (!user) return NextResponse.json({ error: "Unauthorized", errorCode: "INVALID_TOKEN" }, { status: 401 })

  const wl = await programAccessState(user.id, program.id, user.nativeStatus)
  if (!wl.allowed || !wl.expiresAt) {
    return NextResponse.json({ error: "No access", errorCode: "NO_ACCESS" }, { status: 403 })
  }

  try {
    const { token: licence } = signLicence(user.id, wl.expiresAt)
    return NextResponse.json({ token: licence })
  } catch (err) {
    console.error("[desktop/licence] signing failed:", err)
    return NextResponse.json({ error: "Licence signing unavailable", errorCode: "NO_SIGNING_KEY" }, { status: 500 })
  }
}
