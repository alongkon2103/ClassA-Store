// app/api/desktop/licence/route.ts
//
// GET → issue a short-lived Ed25519-signed licence "pass" for the plugin.
// Auth: Bearer desktop access token AND an active whitelist.
//
//   200 → { token }
//   401 → invalid token
//   403 → no whitelist (expired / kicked / never granted) — plugin deletes its
//         local licence and refuses to start
//   500 → server missing LICENCE_PRIVATE_KEY

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyAccessToken, bearerFrom } from "@/lib/desktopAuth"
import { whitelistState } from "@/lib/desktopEntitlement"
import { signLicence } from "@/lib/desktopLicence"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const token = bearerFrom(req.headers.get("authorization"))
  const ctx = token ? await verifyAccessToken(token) : null
  if (!ctx) return NextResponse.json({ error: "Unauthorized", errorCode: "INVALID_TOKEN" }, { status: 401 })

  const user = await prisma.users.findUnique({
    where: { id: ctx.userId },
    select: { id: true, nativeStatus: true, nativeExpiry: true },
  })
  if (!user) return NextResponse.json({ error: "Unauthorized", errorCode: "INVALID_TOKEN" }, { status: 401 })

  const wl = whitelistState(user.nativeStatus, user.nativeExpiry)
  // Not allowed → 403 so the plugin drops its local pass immediately.
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
