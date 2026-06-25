// Generic feature flags stored in system_configs as plain "true"/"false".
// NO in-memory cache — feature flags must take effect immediately when an
// admin toggles them. In serverless each instance has its own module state,
// so cached `true` on one instance would linger after a "disable" save on
// another. Toggles are rare, so the extra DB hit per page is fine.

import { prisma } from "@/lib/prisma"

export const FEATURE_KEYS = {
  livegen_enabled: "livegen_enabled",
} as const

const DEFAULTS = {
  livegen_enabled: true,
}

function parseBool(v: string | undefined, fallback: boolean): boolean {
  if (v === undefined || v === null || v === "") return fallback
  if (v === "true") return true
  if (v === "false") return false
  return fallback
}

// Kept as a no-op for callers (settings route) so we don't break imports.
export function invalidateFeatureFlagsCache() {}

export async function getFeatureFlags(): Promise<typeof DEFAULTS> {
  const rows = await prisma.system_configs.findMany({
    where: { key: { in: Object.values(FEATURE_KEYS) } },
    select: { key: true, value: true },
  })
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]))
  return {
    livegen_enabled: parseBool(map[FEATURE_KEYS.livegen_enabled], DEFAULTS.livegen_enabled),
  }
}
