// Server-only persistence/credentials. Never import this module from a client component.
import { createHash, createHmac } from "node:crypto"
import type { Prisma } from "@prisma/client"
import { AC_MAGNET_PRODUCT_ID, GameDefaultsError, stableDefaultsJson } from "../tikkiesGameDefaults"
import { defaultGameIntegration, validateGameIntegration, type GameIntegration } from "../gameIntegration"

export const integrationRevision = (config: GameIntegration) => createHash("sha256").update(stableDefaultsJson(config)).digest("hex")
export async function readGameIntegration(db: Prisma.TransactionClient, productId: string) {
  const rows = await db.$queryRaw<{ config: unknown; revision: string }[]>`SELECT config, revision FROM product_tikkies_integrations WHERE product_id = ${productId}::uuid`
  if (!rows.length) { const integration = defaultGameIntegration(productId); return { integration, integrationRevision: integrationRevision(integration), stored: false } }
  const integration = validateGameIntegration(rows[0].config), revision = integrationRevision(integration)
  if (rows[0].revision !== revision) throw new GameDefaultsError("integration_unavailable", 503)
  return { integration, integrationRevision: revision, stored: true }
}
export async function writeGameIntegration(db: Prisma.TransactionClient, productId: string, integration: GameIntegration) {
  const revision = integrationRevision(integration)
  await db.$executeRaw`INSERT INTO product_tikkies_integrations (product_id, config, revision, updated_at) VALUES (${productId}::uuid, ${JSON.stringify(integration)}::jsonb, ${revision}, clock_timestamp()) ON CONFLICT (product_id) DO UPDATE SET config = EXCLUDED.config, revision = EXCLUDED.revision, updated_at = EXCLUDED.updated_at`
}
export function gameMapCredential(productId: string, env: { TIKKIES_GAME_CREDENTIAL_SECRET?: string } = { TIKKIES_GAME_CREDENTIAL_SECRET: process.env.TIKKIES_GAME_CREDENTIAL_SECRET }): string {
  const secret = env.TIKKIES_GAME_CREDENTIAL_SECRET
  if (!secret || Buffer.byteLength(secret) < 32) throw new GameDefaultsError("game_credential_unavailable", 503)
  return createHmac("sha256", secret).update("tikkies:game:" + productId.toLowerCase()).digest("base64url")
}
export function gameMapCredentialHash(productId: string, env?: { TIKKIES_GAME_CREDENTIAL_SECRET?: string }): string | null {
  // Legacy Magnet rooms retain their existing receiver key throughout migration.
  return productId.toLowerCase() === AC_MAGNET_PRODUCT_ID ? null : createHash("sha256").update(gameMapCredential(productId, env)).digest("hex")
}
