// Published Magnet defaults only. Dry run is the default; --apply makes a private backup first.
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { randomUUID } from "node:crypto"
import { parseArgs } from "node:util"
import type { PrismaClient } from "@prisma/client"
import { AC_MAGNET_PRODUCT_ID, GameDefaultsError } from "../lib/tikkiesGameDefaults"
import { reconcileMagnetGameDefaults } from "../lib/magnetGameDefaults"
import { readAdminGameDefaults, saveAdminGameDefaults } from "../lib/integrations/tikkiesGameDefaults"

type Options = { apply?: boolean; backupPath?: string }
export function parseMagnetReconcileArguments(args: string[]): Options {
  const { values } = parseArgs({ args, options: { apply: { type: "boolean" }, backup: { type: "string" } }, allowPositionals: false })
  return { apply: values.apply === true, ...(values.backup ? { backupPath: values.backup } : {}) }
}
export async function reconcilePublishedMagnetDefaults(db: PrismaClient, options: Options = {}) {
  const origin = "https://aclassstore.com", current = await readAdminGameDefaults(db, AC_MAGNET_PRODUCT_ID, origin)
  if (!current.published) throw new GameDefaultsError("magnet_defaults_not_published", 409)
  if (current.integration.mode !== "api") throw new GameDefaultsError("magnet_integration_not_api", 409)
  const plan = reconcileMagnetGameDefaults(current.document)
  const report = { gameId: AC_MAGNET_PRODUCT_ID, dryRun: options.apply !== true, changed: false, wouldChange: plan.changed, revision: current.revision, effects: plan.document.effects.length, actions: plan.document.actions.length, addedCommands: plan.addedCommands, renamedCommands: plan.renamedCommands }
  if (!options.apply || !plan.changed) return report
  const backupPath = path.resolve(options.backupPath || path.join(os.homedir(), ".tikkies-backups", `magnet-defaults-${Date.now()}-${randomUUID()}.json`))
  await fs.mkdir(path.dirname(backupPath), { recursive: true, mode: 0o700 })
  const backup = await fs.open(backupPath, "wx", 0o600)
  try { await backup.writeFile(JSON.stringify({ capturedAt: new Date().toISOString(), ...current }, null, 2) + "\n", "utf8"); await backup.sync() } finally { await backup.close() }
  await fs.chmod(backupPath, 0o600)
  const saved = await saveAdminGameDefaults(db, AC_MAGNET_PRODUCT_ID, { expectedRevision: current.revision, document: plan.document }, origin)
  return { ...report, changed: true, revision: saved.revision, backupPath }
}
async function main() {
  const options = parseMagnetReconcileArguments(process.argv.slice(2))
  await import("dotenv/config")
  const { prisma } = await import("../lib/prisma")
  try { console.log(JSON.stringify(await reconcilePublishedMagnetDefaults(prisma, options), null, 2)) } finally { await prisma.$disconnect() }
}
if (require.main === module) main().catch(error => { console.error(error instanceof GameDefaultsError ? error.code : "Magnet defaults reconciliation failed"); process.exitCode = 1 })
