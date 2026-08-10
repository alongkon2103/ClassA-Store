// app/api/desktop/plugin/download/route.ts
//
// GET → serve the per-account watermarked jar for a program. Authenticated ONLY
// by the signed query (program + account + version + exp + HMAC sig) issued by
// /api/desktop/plugin — short-lived and account+program-bound.

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveProgram } from "@/lib/desktopProgram"
import { getBasePlugin, buildWatermarkedJar, verifyDownload } from "@/lib/desktopPlugin"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const sp = new URL(req.url).searchParams
  const programKey = sp.get("program") ?? ""
  const account = sp.get("account") ?? ""
  const version = sp.get("v") ?? ""
  const exp = Number(sp.get("exp"))
  const sig = sp.get("sig") ?? ""

  if (!programKey || !account || !version || !sig || !verifyDownload(account, programKey, version, exp, sig)) {
    return NextResponse.json({ error: "Invalid or expired link" }, { status: 403 })
  }

  const program = await resolveProgram(programKey)
  if (!program) return NextResponse.json({ error: "Not found" }, { status: 404 })

  // Reject links signed against a since-replaced version.
  const meta = getBasePlugin(program.program_key)
  if (!meta || meta.version !== version) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const user = await prisma.users.findUnique({ where: { id: account }, select: { email: true } })
  const built = buildWatermarkedJar(program.program_key, account, user?.email ?? null)
  if (!built) return NextResponse.json({ error: "Not found" }, { status: 404 })

  return new NextResponse(new Uint8Array(built.buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/java-archive",
      "Content-Disposition": 'attachment; filename="ACPigPanic.jar"',
      "Content-Length": String(built.buffer.length),
      "Cache-Control": "no-store",
    },
  })
}
