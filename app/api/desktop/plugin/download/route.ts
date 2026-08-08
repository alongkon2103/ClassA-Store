// app/api/desktop/plugin/download/route.ts
//
// GET → serve the per-account watermarked jar. Authenticated ONLY by the signed
// query (account + version + exp + HMAC sig) issued by /api/desktop/plugin —
// short-lived and account-bound, so it can't be shared or forged.

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getBasePlugin, buildWatermarkedJar, verifyDownload } from "@/lib/desktopPlugin"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const sp = new URL(req.url).searchParams
  const account = sp.get("account") ?? ""
  const version = sp.get("v") ?? ""
  const exp = Number(sp.get("exp"))
  const sig = sp.get("sig") ?? ""

  if (!account || !version || !sig || !verifyDownload(account, version, exp, sig)) {
    return NextResponse.json({ error: "Invalid or expired link" }, { status: 403 })
  }

  // Reject links signed against a since-replaced version.
  const meta = getBasePlugin()
  if (!meta || meta.version !== version) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const user = await prisma.users.findUnique({ where: { id: account }, select: { email: true } })
  const built = buildWatermarkedJar(account, user?.email ?? null)
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
