export const EMAIL_WHITELIST_NOTE = 'aclass:whitelist-email:v1'
export const RETIRED_EMAIL_WHITELIST_NOTE = 'aclass:whitelist-email:v1:retired'

/** Prisma PostgreSQL insensitive equals is ILIKE: escape literal pattern syntax. */
export function literalInsensitive(value: string) {
  return { equals: value.replace(/[\\%_]/g, character => '\\' + character), mode: 'insensitive' as const }
}
