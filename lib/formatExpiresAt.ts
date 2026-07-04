// Shared helper for rendering expires_at values written by the whitelist/checkout
// pipeline. The webhook writes year 9999 as a sentinel for "permanent" because
// the DB column is NOT NULL — UI should display "Permanent" instead of that date.

// Sentinel written for permanent access. Must match the value used by the
// fulfillment pipeline (lib/orderFulfillment.ts) so isPermanentExpiry treats
// them the same everywhere.
export const PERMANENT_EXPIRES_AT = new Date("9999-12-31T00:00:00.000Z")

export function isPermanentExpiry(expiresAt: Date | string | null | undefined): boolean {
  if (!expiresAt) return false
  const d = expiresAt instanceof Date ? expiresAt : new Date(expiresAt)
  if (Number.isNaN(d.getTime())) return false
  return d.getUTCFullYear() > new Date().getUTCFullYear() + 50
}

// Compute a whitelist expires_at from the admin form: permanent → sentinel,
// otherwise now + durationDays.
export function computeWhitelistExpiry(durationDays: number, isPermanent: boolean): Date {
  if (isPermanent) return PERMANENT_EXPIRES_AT
  const days = Number.isFinite(durationDays) && durationDays > 0 ? durationDays : 0
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000)
}
