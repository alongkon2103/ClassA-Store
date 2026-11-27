// Defaults only: no orders, whitelist, licences or payment writes.
import "dotenv/config"
import { prisma } from "../lib/prisma"
import { AC_MAGNET_PRODUCT_ID } from "../lib/tikkiesGameDefaults"
import { createMagnetDefaults } from "../lib/magnetGameDefaults"
import { readAdminGameDefaults, saveAdminGameDefaults } from "../lib/integrations/tikkiesGameDefaults"
async function main() {
  const origin = "https://aclassstore.com", current = await readAdminGameDefaults(prisma, AC_MAGNET_PRODUCT_ID, origin)
  if (current.published) { console.log(JSON.stringify({ changed: false, reason: "Existing published defaults preserved", revision: current.revision, actions: current.document.actions.length })); return }
  const gifts = await prisma.gifts.findMany({ where: { id: { in: [5655, 8913, 9947, 5879, 5566, 7934, 626064] } }, select: { id: true, name: true } })
  const document = createMagnetDefaults(gifts)
  if (!process.argv.includes("--apply")) { console.log(JSON.stringify({ dryRun: true, effects: document.effects.length, actions: document.actions.length, revision: current.revision })); return }
  const result = await saveAdminGameDefaults(prisma, AC_MAGNET_PRODUCT_ID, { expectedRevision: current.revision, document }, origin)
  console.log(JSON.stringify({ changed: true, revision: result.revision, effects: result.document.effects.length, actions: result.document.actions.length }))
}
main().catch(error => { console.error(error instanceof Error ? error.message : "Seed failed"); process.exitCode = 1 }).finally(() => prisma.$disconnect())
