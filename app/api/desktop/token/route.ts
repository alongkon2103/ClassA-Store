// app/api/desktop/token/route.ts
//
// POST → the Electron app redeems its one-time code for an access + refresh
// token pair. Body: { code, code_verifier, hwid }.
//
// Enforces: code unused + unexpired, PKCE match, and the ONE-DEVICE rule —
// users.hwid is bound to the first device and every later login must match it
// (admin resets hwid to move machines). No web session involved.

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { sha256, verifyPkce, mintTokenPair } from "@/lib/desktopAuth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const code = typeof body.code === "string" ? body.code : ""
  const verifier = typeof body.code_verifier === "string" ? body.code_verifier : ""
  const hwid = typeof body.hwid === "string" ? body.hwid.trim() : ""

  if (!code || !verifier || !hwid) {
    return NextResponse.json({ error: "MISSING_FIELDS", errorCode: "MISSING_FIELDS" }, { status: 400 })
  }
  if (hwid.length < 8 || hwid.length > 256) {
    return NextResponse.json({ error: "BAD_HWID", errorCode: "BAD_HWID" }, { status: 400 })
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const codeRow = await tx.desktop_auth_codes.findUnique({
        where: { code_hash: sha256(code) },
        select: { id: true, user_id: true, code_challenge: true, used: true, expires_at: true },
      })
      if (!codeRow || codeRow.used || codeRow.expires_at.getTime() < Date.now()) {
        return { ok: false as const, code: "INVALID_CODE", status: 400 }
      }
      if (!verifyPkce(verifier, codeRow.code_challenge)) {
        return { ok: false as const, code: "PKCE_MISMATCH", status: 400 }
      }

      // Burn the code first — single use even under concurrency (the unique
      // update guards it; a second redeem sees used=true above / 0 rows here).
      const burned = await tx.desktop_auth_codes.updateMany({
        where: { id: codeRow.id, used: false },
        data: { used: true },
      })
      if (burned.count !== 1) return { ok: false as const, code: "INVALID_CODE", status: 400 }

      // One-device rule.
      const user = await tx.users.findUnique({
        where: { id: codeRow.user_id },
        select: { id: true, username: true, email: true, avatar: true, role: true, hwid: true, nativeStatus: true, nativeExpiry: true },
      })
      if (!user) return { ok: false as const, code: "NO_USER", status: 404 }

      if (user.hwid === null) {
        await tx.users.update({ where: { id: user.id }, data: { hwid } })
      } else if (user.hwid !== hwid) {
        // Bound to a different machine — admin must reset to move devices.
        return { ok: false as const, code: "HWID_MISMATCH", status: 409 }
      }

      return { ok: true as const, user }
    })

    if (!result.ok) {
      return NextResponse.json({ error: result.code, errorCode: result.code }, { status: result.status })
    }

    // hwid is guaranteed set to `hwid` for this user now.
    const tokens = await mintTokenPair(result.user.id, hwid)
    return NextResponse.json({
      ...tokens,
      user: {
        id: result.user.id,
        username: result.user.username,
        email: result.user.email,
        avatar: result.user.avatar,
        role: result.user.role,
        native_status: result.user.nativeStatus,
        native_expiry: result.user.nativeExpiry?.toISOString() ?? null,
      },
    })
  } catch (err) {
    console.error("[desktop/token] error:", err)
    // A unique-constraint race on users.hwid (two devices at once) lands here.
    return NextResponse.json({ error: "EXCHANGE_FAILED", errorCode: "EXCHANGE_FAILED" }, { status: 500 })
  }
}
