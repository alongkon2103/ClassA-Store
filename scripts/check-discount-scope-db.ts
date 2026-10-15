// Optional PostgreSQL check: only uses a session-local TEMP table inside a rolled-back transaction.
import "dotenv/config"
import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import pg from "pg"
import { randomUUID } from "node:crypto"
import { prisma } from "../lib/prisma"
import { codeAppliesTo } from "../lib/discountCodes"
async function check() {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000, query_timeout: 5000 })
  await client.connect()
  try {
    await client.query("BEGIN")
    await client.query("SET LOCAL search_path = pg_temp")
    await client.query('CREATE TEMP TABLE "discount_codes" (id integer PRIMARY KEY, product_id UUID, game_scope text) ON COMMIT DROP')
    const a = "11111111-1111-1111-1111-111111111111", b = "22222222-2222-2222-2222-222222222222"
    await client.query('INSERT INTO "discount_codes" VALUES (1, $1, $2)', [a, "all"])
    const sql = await readFile(new URL("../prisma/sql/20261015_discount_code_product_ids.sql", import.meta.url), "utf8")
    await client.query(sql)
    await client.query(sql)
    let row = (await client.query('SELECT * FROM "discount_codes" WHERE id = 1')).rows[0]
    assert.equal(row.product_id, a)
    assert.deepEqual(row.product_ids, [], "Existing single-game codes keep the legacy scope")
    await client.query('UPDATE "discount_codes" SET product_id = NULL, product_ids = $1::uuid[] WHERE id = 1', [[a, b]])
    row = (await client.query('SELECT * FROM "discount_codes" WHERE id = 1')).rows[0]
    assert.deepEqual(row.product_ids, [a, b])
    assert.equal(codeAppliesTo(row, a), true)
    assert.equal(codeAppliesTo(row, b), true)
    assert.equal(codeAppliesTo(row, "33333333-3333-3333-3333-333333333333"), false)
    console.log("PostgreSQL TEMP table: additive/idempotent migration, legacy preservation and multi-game round trip OK")
  } finally {
    await client.query("ROLLBACK").catch(() => {})
    await client.end()
  }
  // Private/inactive test code is created only within a transaction that always rolls back.
  const products = await prisma.products.findMany({ select: { id: true }, take: 3 })
  assert.equal(products.length, 3, "Need three products for the integration check")
  const ids = products.map(p => p.id)
  const name = `SCOPE-CHECK-${randomUUID().toUpperCase()}`
  const rollback = new Error("EXPECTED_TEST_ROLLBACK")
  try {
    await prisma.$transaction(async tx => {
      const created = await tx.discount_codes.create({ data: { code: name, type: "fixed", value: 50, product_ids: ids.slice(0, 2), is_active: false, is_public: false } })
      assert.deepEqual(created.product_ids, ids.slice(0, 2))
      assert.equal(codeAppliesTo(created, ids[0]), true)
      assert.equal(codeAppliesTo(created, ids[1]), true)
      assert.equal(codeAppliesTo(created, ids[2]), false)
      await tx.discount_codes.update({ where: { id: created.id }, data: { product_ids: [ids[1]] } })
      const saved = await tx.discount_codes.findUniqueOrThrow({ where: { id: created.id } })
      assert.deepEqual(saved.product_ids, [ids[1]])
      assert.equal(codeAppliesTo(saved, ids[0]), false)
      throw rollback
    }, { timeout: 10000 })
    assert.fail("Expected a rollback")
  } catch (error) { if (error !== rollback) throw error }
  assert.equal(await prisma.discount_codes.findUnique({ where: { code: name } }), null)
  console.log("Prisma/database: multi-game create/update/read, excluded games and rollback cleanup OK")
}
check().finally(() => prisma.$disconnect()).catch(error => { console.error(error.message); process.exitCode = 1 })
