// Desktop licence issuing — the anti-expiry gate (see AGENTS.md §1b). The plugin
// never phones home itself (a blocked call would have to fail-open, which is a
// hole). Instead the desktop app fetches a short-lived, Ed25519-signed "pass"
// here; the plugin only checks the signature + not-after locally, so cutting the
// network can't extend access — the pass expires on its own.
//
// Token format:  base64url(payload) "." base64url(signature)
//   payload = properties text (NOT json, so the Java plugin needs no lib):
//     account=<userId>
//     issued=<ISO>
//     not-after=<ISO>
//   signature = raw Ed25519 signature bytes over the payload.
//
// The Ed25519 PRIVATE key lives only in an env secret (LICENCE_PRIVATE_KEY); the
// matching PUBLIC key is embedded in the plugin (Licence.java) and isn't secret.

import crypto from "node:crypto"

// Each pass is valid at most this long — capped further by the membership expiry.
export const LICENCE_MAX_DAYS = 3

/** ISO instant without milliseconds: 2026-08-08T15:00:00Z */
function isoSeconds(d: Date): string {
  return d.toISOString().replace(/\.\d{3}Z$/, "Z")
}

/**
 * Load the Ed25519 private key from env. Accepts either a raw PEM (real or with
 * escaped "\n"), or base64 of the PEM — so it survives single-line .env storage.
 */
export function getLicencePrivateKey(): crypto.KeyObject {
  let pem = process.env.LICENCE_PRIVATE_KEY || ""
  if (!pem) throw new Error("LICENCE_PRIVATE_KEY is not set")
  if (!pem.includes("BEGIN")) pem = Buffer.from(pem, "base64").toString("utf8")
  pem = pem.replace(/\\n/g, "\n")
  return crypto.createPrivateKey(pem)
}

export type LicenceResult = { token: string; issued: string; notAfter: string }

/**
 * Issue a signed licence for `account`, valid `LICENCE_MAX_DAYS` from now but
 * never past `membershipExpiry` (whichever comes first). `membershipExpiry` is
 * the user's whitelist expiry — for permanent access this is the year-9999
 * sentinel, so the 3-day cap always wins.
 */
export function signLicence(account: string, membershipExpiry: Date, now: Date = new Date()): LicenceResult {
  const threeDays = new Date(now.getTime() + LICENCE_MAX_DAYS * 24 * 60 * 60 * 1000)
  const notAfterDate = new Date(Math.min(threeDays.getTime(), membershipExpiry.getTime()))

  const issued = isoSeconds(now)
  const notAfter = isoSeconds(notAfterDate)
  const payload = Buffer.from(`account=${account}\nissued=${issued}\nnot-after=${notAfter}\n`, "utf8")

  // Ed25519 → algorithm must be null (no separate digest).
  const sig = crypto.sign(null, payload, getLicencePrivateKey())
  const token = `${payload.toString("base64url")}.${sig.toString("base64url")}`
  return { token, issued, notAfter }
}
