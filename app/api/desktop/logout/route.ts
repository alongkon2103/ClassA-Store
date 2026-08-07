// app/api/desktop/logout/route.ts
//
// POST → revoke the current desktop session (this token pair). Auth: Bearer
// access token. Pass { all: true } to revoke every session for the user.

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyAccessToken, bearerFrom } from "@/lib/desktopAuth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  const token = bearerFrom(req.headers.get("authorization"))
  const ctx = token ? await verifyAccessToken(token) : null
  if (!ctx) return NextResponse.json({ error: "Unauthorized", errorCode: "INVALID_TOKEN" }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  if (body?.all === true) {
    await prisma.desktop_tokens.updateMany({ where: { user_id: ctx.userId, revoked: false }, data: { revoked: true } })
  } else {
    await prisma.desktop_tokens.update({ where: { id: ctx.tokenId }, data: { revoked: true } })
  }
  await prisma.users.update({ where: { id: ctx.userId }, data: { isOnlineDesktop: false } }).catch(() => {})

  return NextResponse.json({ ok: true })
}
