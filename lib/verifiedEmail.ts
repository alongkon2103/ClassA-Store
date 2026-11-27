/** Normalize addresses without treating aliases or different mailboxes as equal. */
export function normalizeEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const email = value.trim().toLowerCase()
  if (email.length > 254 || /[\x00-\x1f\x7f]/.test(email) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null
  return email
}

/** Only the provider's explicit boolean verification claim proves mailbox ownership. */
export function verifiedProviderEmail(provider: string, profile: unknown): string | null {
  if (!profile || typeof profile !== 'object') return null
  const data = profile as Record<string, unknown>
  const verified = provider === 'discord' ? data.verified === true : provider === 'google' ? data.email_verified === true : false
  return verified ? normalizeEmail(data.email) : null
}
