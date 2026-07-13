// Affiliate public-API auth helpers. Keys are shown to the affiliate ONCE at
// generation; only their SHA-256 hash is stored. Admin gates access per
// affiliate with affiliate_profiles.api_enabled.

import { createHash, randomBytes } from "crypto"
import { prisma } from "@/lib/prisma"

export type NewApiKey = { key: string; hash: string; prefix: string }

// Generate a fresh key: "afk_" + 32 hex chars. Returns the plaintext (to show
// once), its hash (to store), and a short non-secret prefix (for the UI).
export function generateApiKey(): NewApiKey {
  const key = "afk_" + randomBytes(16).toString("hex")
  return { key, hash: hashApiKey(key), prefix: key.slice(0, 12) }
}

export function hashApiKey(key: string): string {
  return createHash("sha256").update(key.trim()).digest("hex")
}

// Pull the key out of an incoming request (Authorization: Bearer <key>, or the
// x-api-key header).
export function extractApiKey(req: Request): string | null {
  const auth = req.headers.get("authorization")
  if (auth && /^Bearer\s+/i.test(auth)) return auth.replace(/^Bearer\s+/i, "").trim()
  const x = req.headers.get("x-api-key")
  return x ? x.trim() : null
}

export type ApiAuthResult =
  | { ok: true; userId: string }
  | { ok: false; status: number; error: string }

// Authenticate an API request: resolve the affiliate by key hash and require
// api_enabled. Never reveals whether a key exists vs is disabled beyond 401/403.
export async function authenticateApiKey(req: Request): Promise<ApiAuthResult> {
  const key = extractApiKey(req)
  if (!key) return { ok: false, status: 401, error: "Missing API key" }
  const profile = await prisma.affiliate_profiles.findFirst({
    where: { api_key_hash: hashApiKey(key) },
    select: { user_id: true, api_enabled: true },
  })
  if (!profile) return { ok: false, status: 401, error: "Invalid API key" }
  if (!profile.api_enabled) return { ok: false, status: 403, error: "API access disabled" }
  return { ok: true, userId: profile.user_id }
}
