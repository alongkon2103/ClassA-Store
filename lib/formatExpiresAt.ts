// Shared helper for rendering expires_at values written by the whitelist/checkout
// pipeline. The webhook writes year 9999 as a sentinel for "permanent" because
// the DB column is NOT NULL — UI should display "Permanent" instead of that date.

export function isPermanentExpiry(expiresAt: Date | string | null | undefined): boolean {
  if (!expiresAt) return false
  const d = expiresAt instanceof Date ? expiresAt : new Date(expiresAt)
  if (Number.isNaN(d.getTime())) return false
  return d.getUTCFullYear() > new Date().getUTCFullYear() + 50
}
