// Default is a repeatable-read, READ ONLY audit. Root applies --execute only
// after taking the production backup. No rows or customer bindings are deleted.
import fs from "node:fs"
import path from "node:path"
import { planGiftSync, type CanonicalGift } from "../lib/giftCatalogSync"
import { argumentsFor, auditPath, connection, giftReferences, giftSnapshot, quoteIdentifier, writeAudit } from "./lib/catalog-db"

async function main() {
  const args = argumentsFor(process.argv.slice(2), ["--execute", "--dry-run", "--source", "--mapping", "--out"])
  const execute = args["--execute"] === true
  const canonical: CanonicalGift[] = JSON.parse(fs.readFileSync(path.resolve(String(args["--source"] || "scripts/data/tikkies-gifts.json")), "utf8"))
  const overrides = args["--mapping"] ? JSON.parse(fs.readFileSync(path.resolve(String(args["--mapping"])), "utf8")) : {}
  const output = auditPath("tikkies-gift-sync", args["--out"] as string | undefined), db = connection()
  await db.connect()
  try {
    await db.query(execute ? "BEGIN" : "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY")
    await db.query("SET LOCAL lock_timeout='5s'")
    const references = await giftReferences(db)
    if (execute) {
      await db.query("SELECT pg_advisory_xact_lock(hashtext('tikkies-canonical-gift-sync-v1'))")
      const tables = [...new Set([quoteIdentifier("gifts"), quoteIdentifier("product_functions"), ...references.map(row => quoteIdentifier(row.schema) + "." + quoteIdentifier(row.table))])].sort()
      await db.query("LOCK TABLE " + tables.join(",") + " IN SHARE ROW EXCLUSIVE MODE")
    }
    const before = await giftSnapshot(db, references), plan = planGiftSync(canonical, before.gifts, overrides)
    const record = { mode: execute ? "execute" : "dry-run", committed: false, createdAt: new Date().toISOString(), before, plan }
    writeAudit(output, record)
    if (plan.blockers.length) throw Error("gift_sync_blocked; inspect audit blockers")
    if (execute) {
      await db.query(fs.readFileSync("prisma/sql/20261118_function_categories_and_gift_ids.sql", "utf8"))
      if (plan.giftUpserts.length) await db.query(`INSERT INTO gifts(id,name,diamonds,image_url,trigger_type,is_active,sort_order)
        SELECT id,name,diamonds,image_url,trigger_type,is_active,sort_order FROM jsonb_to_recordset($1::jsonb)
        AS row(id int,name text,diamonds int,image_url text,trigger_type text,is_active boolean,sort_order int)
        ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name,diamonds=EXCLUDED.diamonds,image_url=EXCLUDED.image_url,
        trigger_type=EXCLUDED.trigger_type,is_active=EXCLUDED.is_active,sort_order=EXCLUDED.sort_order`, [JSON.stringify(plan.giftUpserts)])
      // One joined UPDATE per FK preserves original identity even for remap
      // chains or cycles: a row is never remapped a second time in this pass.
      const mapping = JSON.stringify(plan.referenceRemaps.map(row => ({ old_id: row.oldId, new_id: row.newId })))
      if (plan.referenceRemaps.length) for (const reference of references) {
        const table = quoteIdentifier(reference.schema) + "." + quoteIdentifier(reference.table), column = quoteIdentifier(reference.column)
        await db.query(`UPDATE ${table} AS target SET ${column}=mapping.new_id FROM jsonb_to_recordset($1::jsonb) AS mapping(old_id int,new_id int) WHERE target.${column}=mapping.old_id`, [mapping])
      }
      if (plan.deactivateIds.length) await db.query("UPDATE gifts SET is_active=false WHERE id=ANY($1::int[])", [plan.deactivateIds])
      const check = await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM gifts g JOIN jsonb_to_recordset($1::jsonb) AS c(id int,name text,coins int,image text)
        ON g.id=c.id WHERE g.name=c.name AND g.diamonds=c.coins AND g.image_url=c.image`, [JSON.stringify(canonical)])
      if (check.rows[0].n !== canonical.length) throw Error("canonical_gift_verification_failed")
      await db.query("COMMIT"); record.committed = true; writeAudit(output, record, false)
    } else await db.query("ROLLBACK")
    console.log(JSON.stringify({ mode: record.mode, committed: record.committed, canonical: plan.canonicalCount, existing: plan.existingCount, upserts: plan.giftUpserts.length,
      referenceRemaps: plan.referenceRemaps, deactivateIds: plan.deactivateIds, unresolved: plan.unresolved, duplicateNameGroups: plan.duplicateNames.length,
      preservedTriggers: plan.preservedTriggers, audit: output }))
  } catch (error) { await db.query("ROLLBACK").catch(() => {}); throw error }
  finally { await db.end() }
}
main().catch(error => { console.error(error instanceof Error ? error.message : "gift_sync_failed"); process.exitCode = 1 })
