// Produces a target snapshot by default; --execute applies only the reviewed
// category/default changes, leaving IDs, keys, labels, artwork and user overrides.
import { planPigDefaults, PIG_PRODUCT_ID, type StoredFunction } from "../lib/giftCatalogSync"
import { argumentsFor, auditPath, connection, writeAudit } from "./lib/catalog-db"

async function main() {
  const args = argumentsFor(process.argv.slice(2), ["--execute", "--dry-run", "--out"]), execute = args["--execute"] === true
  const output = auditPath("ac-pig-function-defaults", args["--out"] as string | undefined), db = connection()
  await db.connect()
  try {
    await db.query(execute ? "BEGIN" : "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY")
    await db.query("SET LOCAL lock_timeout='5s'")
    if (execute) {
      await db.query("SELECT pg_advisory_xact_lock(hashtext('tikkies-canonical-gift-sync-v1'))")
      await db.query("LOCK TABLE product_functions IN SHARE ROW EXCLUSIVE MODE")
    }
    const product = (await db.query("SELECT id,name_en,name_th FROM products WHERE id=$1", [PIG_PRODUCT_ID])).rows[0]
    if (!product) throw Error("seed_product_not_found")
    const functions = (await db.query<StoredFunction>(`SELECT f.id,f.product_id,f.name,f.label_th,f.label_en,f.image_url,f.sort_order,f.default_gift_id,f.default_trigger_threshold,
      to_jsonb(f)->>'category' AS category FROM product_functions f ORDER BY f.product_id,f.sort_order,f.id`)).rows
    const plan = planPigDefaults(functions)
    const productNames = (await db.query("SELECT id,name_en,name_th FROM products WHERE id=ANY($1::uuid[])", [plan.categoryCounts.map(row => row.productId)])).rows
    const categoryCounts = plan.categoryCounts.map(row => ({ ...row, productName: productNames.find(product => product.id === row.productId)?.name_en || null }))
    const gifts = (await db.query("SELECT id,name,diamonds,image_url,trigger_type FROM gifts WHERE id=ANY($1::int[]) ORDER BY id", [plan.bindings.map(row => row.giftId)])).rows
    const missingGifts = plan.bindings.filter(row => !gifts.some(gift => gift.id === row.giftId)).map(row => row.giftId)
    const record = { mode: execute ? "execute" : "dry-run", committed: false, product, before: functions, plan, categoryCounts, gifts, missingGifts, targetBindings: plan.bindings.map(row => ({ ...row, gift: gifts.find(gift => gift.id === row.giftId) || null })) }
    writeAudit(output, record)
    if (plan.blockers.length || missingGifts.length) throw Error("seed_blocked; sync canonical gifts first and inspect audit")
    if (execute) {
      for (const row of plan.creates) await db.query(`INSERT INTO product_functions(id,product_id,name,category,label_th,label_en,image_url,sort_order,default_gift_id,default_trigger_threshold)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`, [row.id,row.product_id,row.name,row.category,row.label_th,row.label_en,row.image_url,row.sort_order,row.default_gift_id,row.default_trigger_threshold])
      for (const row of plan.updates) {
        const entries = Object.entries(row.data)
        await db.query(`UPDATE product_functions SET ${entries.map(([key], index) => key + "=$" + (index + 1)).join(",")} WHERE id=$${entries.length + 1} AND product_id=$${entries.length + 2}`, [...entries.map(([, value]) => value), row.id, row.productId])
      }
      await db.query("COMMIT"); record.committed = true; writeAudit(output, record, false)
    } else await db.query("ROLLBACK")
    console.log(JSON.stringify({ mode: record.mode, committed: record.committed, productId: PIG_PRODUCT_ID, updates: plan.updates.length, creates: plan.creates.length, categoryCounts, bindings: record.targetBindings, audit: output }))
  } catch (error) { await db.query("ROLLBACK").catch(() => {}); throw error }
  finally { await db.end() }
}
main().catch(error => { console.error(error instanceof Error ? error.message : "function_seed_failed"); process.exitCode = 1 })
