// Desktop (Electron) authentication — the app-issued token layer that sits on
// top of the existing NextAuth Discord/Google login.
//
// Flow (RFC 8252, brokered through the web app):
//   1. Electron opens the system browser to /desktop/login (PKCE challenge in URL).
//   2. The web app authenticates the user with the EXISTING NextAuth login and
//      mints a one-time code (desktop_auth_codes), redirecting to the app's
//      loopback URL.
//   3. Electron exchanges { code, code_verifier, hwid } at /api/desktop/token
//      for an access + refresh token pair (desktop_tokens), bound to one hwid.
//
// Security: only SHA-256 hashes of codes/tokens are stored; tokens are opaque
// random strings shown once. Access is short-ish; refresh is long and ROTATED
// on every use (a stolen-then-used refresh token is invalidated on next refresh).

import { createHash, randomBytes, timingSafeEqual } from "node:crypto"
import { prisma } from "@/lib/prisma"

// ── lifetimes ────────────────────────────────────────────────────────────────
export const AUTH_CODE_TTL_MS = 60 * 1000 // one-time code: 60s
export const ACCESS_TTL_MS = 7 * 24 * 60 * 60 * 1000 // access token: 7 days
export const REFRESH_TTL_MS = 90 * 24 * 60 * 60 * 1000 // refresh token: 90 days

// ── primitives ───────────────────────────────────────────────────────────────
export function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex")
}

/** URL-safe random token with a readable prefix. */
export function randomToken(prefix: string, bytes = 32): string {
  return `${prefix}_${randomBytes(bytes).toString("base64url")}`
}

/** Constant-time string compare (hex-safe; falls back to false on length diff). */
export function safeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  return timingSafeEqual(Buffer.from(a), Buffer.from(b))
}

/**
 * PKCE S256 verification: challenge must equal base64url(sha256(verifier)).
 * The verifier stays on the desktop app; only the challenge travels through the
 * browser, so an intercepted one-time code is useless without the verifier.
 */
export function verifyPkce(codeVerifier: string, codeChallenge: string): boolean {
  const computed = createHash("sha256").update(codeVerifier).digest("base64url")
  if (computed.length !== codeChallenge.length) return false
  return timingSafeEqual(Buffer.from(computed), Buffer.from(codeChallenge))
}

// ── one-time authorization code ──────────────────────────────────────────────
/** Create a one-time code for `userId`. Returns the PLAINTEXT code (shown once). */
export async function createAuthCode(userId: string, codeChallenge: string): Promise<string> {
  const code = randomToken("dac", 32)
  await prisma.desktop_auth_codes.create({
    data: {
      code_hash: sha256(code),
      user_id: userId,
      code_challenge: codeChallenge,
      expires_at: new Date(Date.now() + AUTH_CODE_TTL_MS),
    },
  })
  return code
}

export type DesktopTokenPair = {
  access_token: string
  refresh_token: string
  access_expires_at: string // ISO
  refresh_expires_at: string // ISO
}

/** Mint a fresh access+refresh pair for (userId, hwid). Plaintext shown once. */
export async function mintTokenPair(userId: string, hwid: string): Promise<DesktopTokenPair> {
  const access = randomToken("dsk", 32)
  const refresh = randomToken("dsr", 40)
  const now = Date.now()
  const accessExp = new Date(now + ACCESS_TTL_MS)
  const refreshExp = new Date(now + REFRESH_TTL_MS)
  await prisma.desktop_tokens.create({
    data: {
      user_id: userId,
      hwid,
      access_hash: sha256(access),
      refresh_hash: sha256(refresh),
      access_expires_at: accessExp,
      refresh_expires_at: refreshExp,
    },
  })
  return {
    access_token: access,
    refresh_token: refresh,
    access_expires_at: accessExp.toISOString(),
    refresh_expires_at: refreshExp.toISOString(),
  }
}

export type DesktopAuthContext = {
  tokenId: string
  userId: string
  hwid: string
}

/**
 * Validate a Bearer access token. Returns the context or null. Also enforces the
 * hwid still matching the user's bound device (an admin hwid reset invalidates
 * every prior token by mismatch, on top of the `revoked` flag).
 */
export async function verifyAccessToken(accessToken: string): Promise<DesktopAuthContext | null> {
  if (!accessToken) return null
  const row = await prisma.desktop_tokens.findUnique({
    where: { access_hash: sha256(accessToken) },
    select: { id: true, user_id: true, hwid: true, revoked: true, access_expires_at: true, users: { select: { hwid: true } } },
  })
  if (!row || row.revoked) return null
  if (row.access_expires_at.getTime() < Date.now()) return null
  // Device still bound to this user? (null user.hwid = admin reset → reject)
  if (row.users.hwid !== row.hwid) return null
  return { tokenId: row.id, userId: row.user_id, hwid: row.hwid }
}

/** Pull a Bearer token out of the Authorization header. */
export function bearerFrom(header: string | null): string | null {
  if (!header) return null
  const m = /^Bearer\s+(.+)$/i.exec(header.trim())
  return m ? m[1].trim() : null
}
