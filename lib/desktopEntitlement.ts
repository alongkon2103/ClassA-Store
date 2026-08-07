// Desktop program whitelist — the single place that turns the raw
// users.nativeStatus + users.nativeExpiry into an "is this user allowed to run
// the Minecraft server right now" answer. Used by /api/desktop/me (what the
// program checks) and the admin grant flow.
//
// Model:
//   nativeStatus = "KICKED"  → blocked (admin force-logout), regardless of plan
//   nativeExpiry = null      → NOT whitelisted (default for a fresh user)
//   nativeExpiry = year 9999 → permanent  (PERMANENT_EXPIRES_AT sentinel)
//   nativeExpiry = future    → timed plan, valid until then
//   nativeExpiry = past      → expired → blocked

import { PERMANENT_EXPIRES_AT, isPermanentExpiry } from "@/lib/formatExpiresAt"

export type WhitelistPlan = "permanent" | "timed"

export type WhitelistState = {
  allowed: boolean
  plan: WhitelistPlan | null
  expiresAt: Date | null // the raw expiry (sentinel for permanent); null = never granted
}

export function whitelistState(nativeStatus: string | null, nativeExpiry: Date | null): WhitelistState {
  if (nativeStatus === "KICKED") return { allowed: false, plan: null, expiresAt: nativeExpiry }
  if (!nativeExpiry) return { allowed: false, plan: null, expiresAt: null }
  if (isPermanentExpiry(nativeExpiry)) return { allowed: true, plan: "permanent", expiresAt: nativeExpiry }
  const allowed = nativeExpiry.getTime() > Date.now()
  return { allowed, plan: allowed ? "timed" : null, expiresAt: nativeExpiry }
}

/** Admin grant → the expiry to store. "30d" resets to 30 days from now. */
export function planToExpiry(plan: "30d" | "permanent"): Date {
  return plan === "permanent" ? PERMANENT_EXPIRES_AT : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
}
