// app/api/desktop/plugin/route.ts
//
// GET → plugin download info for the desktop app. Auth: Bearer desktop access
// token AND an active whitelist. Returns { version, sha256, account, url } where
// `url` is a short-lived, account-bound signed link to the watermarked jar.
//
//   200 → JSON            (download per url, verify sha256)
//   401 → invalid token
//   403 → no whitelist    (บัญชีไม่มีสิทธิ์โหลด)
//   404 → no plugin uploaded yet

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyAccessToken, bearerFrom } from "@/lib/desktopAuth"
import { whitelistState } from "@/lib/desktopEntitlement"
import { getBasePlugin, buildWatermarkedJar, signDownload } from "@/lib/desktopPlugin"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const token = bearerFrom(req.headers.get("authorization"))
  const ctx = token ? await verifyAccessToken(token) : null
  if (!ctx) return NextResponse.json({ error: "Unauthorized", errorCode: "INVALID_TOKEN" }, { status: 401 })

  const user = await prisma.users.findUnique({
    where: { id: ctx.userId },
    select: { id: true, email: true, nativeStatus: true, nativeExpiry: true },
  })
  if (!user) return NextResponse.json({ error: "Unauthorized", errorCode: "INVALID_TOKEN" }, { status: 401 })

  const wl = whitelistState(user.nativeStatus, user.nativeExpiry)
  if (!wl.allowed) return NextResponse.json({ error: "No access", errorCode: "NO_ACCESS" }, { status: 403 })

  const meta = getBasePlugin()
  if (!meta) return NextResponse.json({ error: "No plugin", errorCode: "NO_PLUGIN" }, { status: 404 })

  // Watermarked copy for this account — cached; its sha256 is what we advertise.
  const built = buildWatermarkedJar(user.id, user.email)
  if (!built) return NextResponse.json({ error: "No plugin", errorCode: "NO_PLUGIN" }, { status: 404 })

  const { exp, sig } = signDownload(user.id, meta.version)
  const origin = process.env.NEXTAUTH_URL || new URL(req.url).origin
  const url = `${origin}/api/desktop/plugin/download`
    + `?account=${encodeURIComponent(user.id)}&v=${encodeURIComponent(meta.version)}&exp=${exp}&sig=${sig}`

  return NextResponse.json({
    version: meta.version,
    sha256: built.sha256,
    account: user.id,
    url,
  })
}
