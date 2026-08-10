// app/api/desktop/me/route.ts
//
// GET → identity + entitlement for the desktop app. Auth: Bearer access token.
// Also marks the user online (isOnlineDesktop + lastSeen) as a heartbeat.

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyAccessToken, bearerFrom } from "@/lib/desktopAuth"
import { resolveProgram, programAccessState } from "@/lib/desktopProgram"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const token = bearerFrom(req.headers.get("authorization"))
  const ctx = token ? await verifyAccessToken(token) : null
  if (!ctx) return NextResponse.json({ error: "Unauthorized", errorCode: "INVALID_TOKEN" }, { status: 401 })

  const user = await prisma.users.findUnique({
    where: { id: ctx.userId },
    select: { id: true, username: true, email: true, avatar: true, role: true, hwid: true, nativeStatus: true },
  })
  if (!user) return NextResponse.json({ error: "NO_USER", errorCode: "NO_USER" }, { status: 404 })

  // Heartbeat (best-effort — never fail the request over this).
  await Promise.all([
    prisma.users.update({ where: { id: user.id }, data: { isOnlineDesktop: true, lastSeen: new Date() } }),
    prisma.desktop_tokens.update({ where: { id: ctx.tokenId }, data: { last_used_at: new Date() } }),
  ]).catch(() => {})

  // Whitelist verdict for the requesting program (the app passes its program_key).
  const program = await resolveProgram(new URL(req.url).searchParams.get("program"))
  const wl = program ? await programAccessState(user.id, program.id, user.nativeStatus) : null

  return NextResponse.json({
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      avatar: user.avatar,
      role: user.role,
      hwid: user.hwid,
      native_status: user.nativeStatus,
    },
    program: program ? { key: program.program_key, name: program.name_en } : null,
    whitelist: wl
      ? { allowed: wl.allowed, plan: wl.plan, expires_at: wl.expiresAt ? wl.expiresAt.toISOString() : null }
      : null,
  })
}
