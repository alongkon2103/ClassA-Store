// app/api/desktop/me/route.ts
//
// GET → identity + entitlement for the desktop app. Auth: Bearer access token.
// Also marks the user online (isOnlineDesktop + lastSeen) as a heartbeat.

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyAccessToken, bearerFrom } from "@/lib/desktopAuth"
import { whitelistState } from "@/lib/desktopEntitlement"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const token = bearerFrom(req.headers.get("authorization"))
  const ctx = token ? await verifyAccessToken(token) : null
  if (!ctx) return NextResponse.json({ error: "Unauthorized", errorCode: "INVALID_TOKEN" }, { status: 401 })

  const user = await prisma.users.findUnique({
    where: { id: ctx.userId },
    select: { id: true, username: true, email: true, avatar: true, role: true, hwid: true, nativeStatus: true, nativeExpiry: true },
  })
  if (!user) return NextResponse.json({ error: "NO_USER", errorCode: "NO_USER" }, { status: 404 })

  // Heartbeat (best-effort — never fail the request over this).
  await Promise.all([
    prisma.users.update({ where: { id: user.id }, data: { isOnlineDesktop: true, lastSeen: new Date() } }),
    prisma.desktop_tokens.update({ where: { id: ctx.tokenId }, data: { last_used_at: new Date() } }),
  ]).catch(() => {})

  // Whitelist verdict the program gates the Minecraft server on.
  const wl = whitelistState(user.nativeStatus, user.nativeExpiry)

  return NextResponse.json({
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      avatar: user.avatar,
      role: user.role,
      hwid: user.hwid,
      native_status: user.nativeStatus,
      native_expiry: user.nativeExpiry?.toISOString() ?? null,
    },
    whitelist: {
      allowed: wl.allowed,
      plan: wl.plan, // "permanent" | "timed" | null
      expires_at: wl.expiresAt ? wl.expiresAt.toISOString() : null,
    },
  })
}
