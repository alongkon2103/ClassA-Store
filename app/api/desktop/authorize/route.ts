// app/api/desktop/authorize/route.ts
//
// POST → called by the /desktop/login consent page (browser, same-origin,
// authenticated via the normal NextAuth web session). Mints a one-time code for
// the logged-in user and returns the loopback redirect URL the browser should
// navigate to so the Electron app receives the code.
//
// This is the ONLY place the web session is turned into a desktop credential —
// everything after this uses app-issued tokens, not the session cookie.

import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { createAuthCode } from "@/lib/desktopAuth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const state = typeof body.state === "string" ? body.state : ""
  const challenge = typeof body.challenge === "string" ? body.challenge : ""
  const port = Number(body.port)

  // Loopback only, on the unprivileged port range (RFC 8252 native-app redirect).
  if (!Number.isInteger(port) || port < 1024 || port > 65535) {
    return NextResponse.json({ error: "bad port" }, { status: 400 })
  }
  // PKCE S256 challenge is base64url of a 32-byte hash → 43 chars.
  if (!/^[A-Za-z0-9_-]{43}$/.test(challenge)) {
    return NextResponse.json({ error: "bad challenge" }, { status: 400 })
  }
  if (!state || state.length > 256) {
    return NextResponse.json({ error: "bad state" }, { status: 400 })
  }

  const code = await createAuthCode(session.user.id, challenge)

  const redirect = `http://127.0.0.1:${port}/cb?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`
  return NextResponse.json({ redirect })
}
