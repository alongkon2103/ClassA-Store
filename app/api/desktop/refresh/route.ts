// app/api/desktop/refresh/route.ts
//
// POST → rotate an access+refresh pair. Body: { refresh_token, hwid }.
// The refresh token is single-use: a successful refresh REPLACES both hashes on
// the same row, so a leaked-then-used refresh token is dead on the next call.

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { sha256, randomToken, ACCESS_TTL_MS, REFRESH_TTL_MS } from "@/lib/desktopAuth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const refresh = typeof body.refresh_token === "string" ? body.refresh_token : ""
  const hwid = typeof body.hwid === "string" ? body.hwid.trim() : ""
  if (!refresh || !hwid) {
    return NextResponse.json({ error: "MISSING_FIELDS", errorCode: "MISSING_FIELDS" }, { status: 400 })
  }

  const row = await prisma.desktop_tokens.findUnique({
    where: { refresh_hash: sha256(refresh) },
    select: { id: true, hwid: true, revoked: true, refresh_expires_at: true, users: { select: { hwid: true } } },
  })
  if (!row || row.revoked || row.refresh_expires_at.getTime() < Date.now()) {
    return NextResponse.json({ error: "INVALID_REFRESH", errorCode: "INVALID_REFRESH" }, { status: 401 })
  }
  // Device must match both the token's hwid and the user's currently-bound hwid
  // (an admin reset nulls users.hwid → refresh stops working).
  if (row.hwid !== hwid || row.users.hwid !== row.hwid) {
    return NextResponse.json({ error: "HWID_MISMATCH", errorCode: "HWID_MISMATCH" }, { status: 409 })
  }

  const access = randomToken("dsk", 32)
  const newRefresh = randomToken("dsr", 40)
  const now = Date.now()
  const accessExp = new Date(now + ACCESS_TTL_MS)
  const refreshExp = new Date(now + REFRESH_TTL_MS)

  // Rotate on the same row. Guard on the old refresh hash so two concurrent
  // refreshes can't both succeed (the second updates 0 rows).
  const updated = await prisma.desktop_tokens.updateMany({
    where: { id: row.id, refresh_hash: sha256(refresh), revoked: false },
    data: {
      access_hash: sha256(access),
      refresh_hash: sha256(newRefresh),
      access_expires_at: accessExp,
      refresh_expires_at: refreshExp,
      last_used_at: new Date(),
    },
  })
  if (updated.count !== 1) {
    return NextResponse.json({ error: "INVALID_REFRESH", errorCode: "INVALID_REFRESH" }, { status: 401 })
  }

  return NextResponse.json({
    access_token: access,
    refresh_token: newRefresh,
    access_expires_at: accessExp.toISOString(),
    refresh_expires_at: refreshExp.toISOString(),
  })
}
