// Generic feature flags stored in system_configs as plain "true"/"false".
// 30-second in-memory cache; admin writes bump the cache via the API hook
// in `app/api/admin/settings/configs/route.ts`.

import { prisma } from "@/lib/prisma"

export const FEATURE_KEYS = {
  livegen_enabled: "livegen_enabled",
} as const

const DEFAULTS = {
  livegen_enabled: true,
}

let cache: { flags: typeof DEFAULTS; fetchedAt: number } | null = null
const CACHE_TTL_MS = 30 * 1000

function parseBool(v: string | undefined, fallback: boolean): boolean {
  if (v === undefined || v === null || v === "") return fallback
  if (v === "true") return true
  if (v === "false") return false
  return fallback
}

export function invalidateFeatureFlagsCache() {
  cache = null
}

export async function getFeatureFlags(): Promise<typeof DEFAULTS> {
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) return cache.flags
  const rows = await prisma.system_configs.findMany({
    where: { key: { in: Object.values(FEATURE_KEYS) } },
    select: { key: true, value: true },
  })
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]))
  const flags = {
    livegen_enabled: parseBool(map[FEATURE_KEYS.livegen_enabled], DEFAULTS.livegen_enabled),
  }
  cache = { flags, fetchedAt: Date.now() }
  return flags
}
