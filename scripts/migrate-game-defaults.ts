// Explicit, additive operations only. Default mode previews; --publish never rewrites existing publications.
import "dotenv/config"
import fs from "node:fs/promises"
import path from "node:path"
import { parseArgs } from "node:util"
import { Client } from "pg"
import { prisma } from "../lib/prisma"
import { readAdminGameDefaults, saveAdminGameDefaults } from "../lib/integrations/tikkiesGameDefaults"

const { values } = parseArgs({ options: { schema: { type: "boolean" }, inventory: { type: "boolean" }, backup: { type: "string" }, publish: { type: "boolean" }, product: { type: "string" } } })
const origin = new URL(process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || "https://aclassstore.com").origin
async function run() {
  if ([values.schema, values.inventory, values.backup, values.publish].filter(Boolean).length > 1) throw Error("Choose one operation")
  if (values.schema) {
    const sql = await fs.readFile(path.resolve(process.cwd(), "prisma/sql/20261120_canonical_game_defaults.sql"), "utf8")
    const client = new Client({ connectionString: process.env.DATABASE_URL })
    try { await client.connect(); await client.query(sql); console.log("Applied additive game-defaults table; existing tables unchanged") } finally { await client.end() }
    return
  }
  const products = await prisma.products.findMany({ where: { ...(values.product ? { id: values.product } : {}), OR: [{ type: "roblox_whitelist" }, { type: "desktop_program", program_key: "ac_pig_panic" }] }, orderBy: { id: "asc" }, take: 501,
    select: { id: true, name_en: true, type: true, program_key: true, is_active: true, product_functions: { orderBy: [{ sort_order: "asc" }, { id: "asc" }], include: { default_gift: true } }, product_presets: { orderBy: [{ sort_order: { sort: "asc", nulls: "last" } }, { id: "asc" }] } } })
  if (products.length > 500) throw Error("Product capacity exceeded")
  if (values.backup) {
    const folder = path.resolve(values.backup)
    await fs.mkdir(folder, { recursive: true, mode: 0o700 })
    const table = await prisma.$queryRaw<{ name: string | null }[]>`SELECT to_regclass('public.product_tikkies_defaults')::text AS name`
    const publications = table[0]?.name ? await prisma.$queryRaw`SELECT * FROM product_tikkies_defaults` : []
    const filename = path.join(folder, "game-default-inputs.json")
    await fs.writeFile(filename, JSON.stringify({ capturedAt: new Date().toISOString(), products, publications }, null, 2), { flag: "wx", mode: 0o600 })
    console.log(JSON.stringify({ backup: filename, products: products.length, customerTablesRead: false }))
    return
  }
  const report = []
  for (const product of products) {
    if (values.inventory) {
      report.push({ id: product.id, name: product.name_en, active: product.is_active, functions: product.product_functions.map(fn => ({ key: fn.name, gift: fn.default_gift?.name || null })), presets: product.product_presets.map(preset => preset.filename) })
      continue
    }
    try {
      const view = await readAdminGameDefaults(prisma, product.id, origin)
      const unsafeWarnings = view.warnings.filter(warning => !warning.startsWith("รวมรายการซ้ำ "))
      if (values.publish && !view.published && view.document.actions.length && !unsafeWarnings.length) {
        await saveAdminGameDefaults(prisma, product.id, { expectedRevision: view.revision, document: view.document }, origin)
        report.push({ id: product.id, name: product.name_en, state: "published", effects: view.document.effects.length, actions: view.document.actions.length, warnings: view.warnings })
      } else report.push({ id: product.id, name: product.name_en, state: view.published ? "already_published" : unsafeWarnings.length ? "needs_review" : view.document.actions.length ? "preview" : "empty", effects: view.document.effects.length, actions: view.document.actions.length, warnings: view.warnings })
    } catch (error) { report.push({ id: product.id, name: product.name_en, state: "needs_review", error: error instanceof Error ? error.message : "defaults_unavailable" }) }
  }
  console.log(JSON.stringify(report, null, 2))
}
run().catch(error => { console.error(error instanceof Error ? error.message : "Migration failed"); process.exitCode = 1 }).finally(() => prisma.$disconnect())
