// app/api/desktop/plugin/route.ts
//
// GET /api/desktop/plugin?program=<program_key>
// Download info for a specific desktop program. Auth: Bearer desktop token AND
// an active entitlement for that program. Returns { version, sha256, account, url }
// where url is a short-lived, account+program-bound signed link.
//
//   200 → JSON            (download per url, verify sha256)
//   400 → missing/unknown program
//   401 → invalid token
//   403 → no access to this program (บัญชีไม่มีสิทธิ์โหลด)
//   404 → no plugin uploaded for this program yet

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyAccessToken, bearerFrom } from "@/lib/desktopAuth"
import { resolveProgram, programAccessState } from "@/lib/desktopProgram"
import { getBasePlugin, buildWatermarkedJar, signDownload } from "@/lib/desktopPlugin"

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
    select: { id: true, email: true, nativeStatus: true },
  })
  if (!user) return NextResponse.json({ error: "Unauthorized", errorCode: "INVALID_TOKEN" }, { status: 401 })

  const wl = await programAccessState(user.id, program.id, user.nativeStatus)
  if (!wl.allowed) return NextResponse.json({ error: "No access", errorCode: "NO_ACCESS" }, { status: 403 })

  const meta = getBasePlugin(program.program_key)
  if (!meta) return NextResponse.json({ error: "No plugin", errorCode: "NO_PLUGIN" }, { status: 404 })

  // Watermarked copy for this account — cached; its sha256 is what we advertise.
  const built = buildWatermarkedJar(program.program_key, user.id, user.email)
  if (!built) return NextResponse.json({ error: "No plugin", errorCode: "NO_PLUGIN" }, { status: 404 })

  const { exp, sig } = signDownload(user.id, program.program_key, meta.version)
  const origin = process.env.NEXTAUTH_URL || new URL(req.url).origin
  const url = `${origin}/api/desktop/plugin/download`
    + `?program=${encodeURIComponent(program.program_key)}`
    + `&account=${encodeURIComponent(user.id)}&v=${encodeURIComponent(meta.version)}&exp=${exp}&sig=${sig}`

  return NextResponse.json({ version: meta.version, sha256: built.sha256, account: user.id, url })
}
