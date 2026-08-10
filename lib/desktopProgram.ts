// Resolve desktop_program products + a user's per-product entitlement. Keeps the
// pure entitlement math in lib/desktopEntitlement and the DB lookups here.

import { prisma } from "@/lib/prisma"
import { whitelistState, type WhitelistState } from "@/lib/desktopEntitlement"

export type DesktopProgram = { id: string; program_key: string; name_en: string; name_th: string }

/** Find a desktop_program product by its program_key (null if unknown). */
export async function resolveProgram(programKey: string | null | undefined): Promise<DesktopProgram | null> {
  if (!programKey) return null
  const p = await prisma.products.findFirst({
    where: { program_key: programKey, type: "desktop_program" },
    select: { id: true, program_key: true, name_en: true, name_th: true },
  })
  return p && p.program_key ? { id: p.id, program_key: p.program_key, name_en: p.name_en, name_th: p.name_th } : null
}

/**
 * A user's access to one program: combines the global account status
 * (users.nativeStatus — a KICK bans everything) with the per-product entitlement
 * (user_program_access.expires_at, only when its row is ACTIVE).
 */
export async function programAccessState(userId: string, productId: string, nativeStatus: string | null): Promise<WhitelistState> {
  const row = await prisma.user_program_access.findUnique({
    where: { user_id_product_id: { user_id: userId, product_id: productId } },
    select: { expires_at: true, status: true },
  })
  const expiry = row && row.status === "ACTIVE" ? row.expires_at : null
  return whitelistState(nativeStatus, expiry)
}
