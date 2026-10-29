// Real transactions in a disposable schema, never grants a real customer anything.
import "dotenv/config"
import assert from "node:assert/strict"
import { createRequire } from "node:module"
import { randomUUID } from "node:crypto"
import { readFile } from "node:fs/promises"
import pg from "pg"
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { HALLOWEEN_EVENT, HALLOWEEN_GAME_SLUGS } from "../lib/halloweenEvent"

const require = createRequire(import.meta.url)
const stub = (path: string, exports: unknown) => { const file = require.resolve(path); require.cache[file] = { id: file, filename: file, loaded: true, exports } as NodeModule }
let ticket = 0, lookupCalls = 0, lookupOk = true
const crypto = require("node:crypto")
crypto.randomInt = () => ticket
const schema = "halloween_test_" + randomUUID().replaceAll("-", "")
const admin = new pg.Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000 })
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, options: `-c search_path=${schema},pg_catalog`, application_name: schema, max: 6, connectionTimeoutMillis: 5000 })
const db = new PrismaClient({ adapter: new PrismaPg(pool, { schema }) })
stub("../lib/prisma", { prisma: db })
stub("../lib/roblox", {
  isPlausibleUsername: (name: string) => /^[a-zA-Z0-9_]{3,20}$/.test(name),
  lookupRobloxUser: async () => { lookupCalls++; return lookupOk ? { ok: true, user: { id: 12345, username: "CanonicalPlayer", displayName: "Player", avatarUrl: null } } : { ok: false, reason: "network" } },
})
const api = require("../lib/halloweenDraw")
assert.equal(typeof api.drawHalloween, "function", "Draws must be persisted and awarded by the server")
const now = new Date("2026-10-30T12:00:00+07:00")
const before = new Date("2026-10-29T12:00:00+07:00")
const after = new Date("2026-11-02T12:00:00+07:00")
async function check() {
  await admin.connect()
  try {
    await admin.query(`CREATE SCHEMA "${schema}"`)
    await admin.query(`CREATE TYPE "${schema}"."Role" AS ENUM ('user', 'admin', 'partnership', 'affiliate')`)
    for (const table of ["users", "products", "product_images", "orders", "point_ledger", "user_whitelist_access", "user_program_access"]) {
      await admin.query(`CREATE TABLE "${schema}"."${table}" (LIKE public."${table}" INCLUDING ALL)`)
    }
    await admin.query(`ALTER TABLE "${schema}".users ALTER COLUMN role DROP DEFAULT, ALTER COLUMN role TYPE "${schema}"."Role" USING role::text::"${schema}"."Role", ALTER COLUMN role SET DEFAULT 'user'`)
    const sql = await readFile(new URL("../prisma/sql/20261029_halloween_draws.sql", import.meta.url), "utf8")
    await pool.query(sql); await pool.query(sql)
    for (const [i, slug] of HALLOWEEN_GAME_SLUGS.entries()) {
      await db.products.create({ data: { slug, name_th: `เกม ${i}`, name_en: `Game ${i}`, price: 100, type: slug === "ac-pig-panic" ? "desktop_program" : "roblox_whitelist", product_images: { create: { url: `/uploads/game${i}.webp` } } } })
    }
    const user = async () => (await db.users.create({ data: { username: "Event fixture " + randomUUID() } })).id
    const one = await user(), two = await user()
    await assert.rejects(api.drawHalloween(one, before), { code: "upcoming" })
    await assert.rejects(api.drawHalloween(one, new Date(HALLOWEEN_EVENT.endsAt)), { code: "ended" })
    const results = await Promise.all(Array.from({ length: 6 }, () => api.drawHalloween(one, now)))
    assert.ok(results.every(r => r.id === results[0].id), "Concurrent draws return one stored result")
    assert.equal(await db.halloween_draws.count({ where: { user_id: one } }), 1)
    assert.equal(await db.point_ledger.count({ where: { user_id: one } }), 1)
    assert.equal((await db.point_ledger.aggregate({ where: { user_id: one }, _sum: { delta: true } }))._sum.delta, 2000)
    assert.equal((await api.drawHalloween(one, after)).id, results[0].id, "A lost draw response can be recovered after close")
    ticket = 960 // Universe, three days.
    const game = await api.drawHalloween(two, now)
    assert.equal(game.prize.kind, "game"); assert.equal(game.claimedAt, null)
    assert.ok(game.prize.product.imageUrl?.endsWith("game0.webp"))
    assert.equal(await db.orders.count(), 0, "Drawing a Roblox reward does not grant an unverified account")
    await assert.rejects(api.claimHalloween(one, game.id, "CanonicalPlayer", now), { code: "not_found" })
    lookupOk = false
    await assert.rejects(api.claimHalloween(two, game.id, "CanonicalPlayer", now), { code: "roblox_unavailable" })
    assert.equal((await db.halloween_draws.findUnique({ where: { id: game.id } }))?.claimed_at, null)
    lookupOk = true
    const claims = await Promise.all(Array.from({ length: 4 }, () => api.claimHalloween(two, game.id, "canonicalplayer", after)))
    assert.ok(claims.every(r => r.orderId === claims[0].orderId))
    const order = await db.orders.findUniqueOrThrow({ where: { id: claims[0].orderId } })
    assert.equal(order.whitelisted_username, "CanonicalPlayer")
    assert.equal(order.roblox_user_id, "12345"); assert.equal(order.roblox_resolved_for, "canonicalplayer")
    assert.equal(order.status, "paid"); assert.equal(order.order_type, "EVENT"); assert.equal(Number(order.amount), 0)
    assert.equal(order.expires_at?.getTime(), after.getTime() + 3 * 86400000)
    assert.equal(await db.orders.count({ where: { user_id: two } }), 1)
    const third = await user(), later = new Date(after.getTime() + 10 * 86400000)
    await db.user_whitelist_access.update({ where: { ign_product_id: { ign: "CanonicalPlayer", product_id: game.prize.product.id } }, data: { expires_at: later, is_premium: true } })
    const thirdDraw = await api.drawHalloween(third, now)
    const extended = await api.claimHalloween(third, thirdDraw.id, "CanonicalPlayer", after)
    assert.equal(new Date(extended.result.expiresAt).getTime(), later.getTime() + 3 * 86400000)
    assert.equal((await db.user_whitelist_access.findFirstOrThrow()).is_premium, true)
    const caseGame = await db.products.findUniqueOrThrow({ where: { slug: "ac-slash" } })
    await db.user_whitelist_access.createMany({ data: [
      { ign: "CasePlayer", product_id: caseGame.id, expires_at: new Date("2020-01-01Z") },
      { ign: "caseplayer", product_id: caseGame.id, expires_at: new Date("2090-01-01Z") },
    ] })
    process.env.API_CHCK_WHILIST_KEY = "isolated-fixture-key"
    const { POST: checkWhitelist } = require("../app/api/whitelist/check/route")
    const checked = await checkWhitelist(new Request("http://localhost/api/whitelist/check", { method: "POST", headers: { "x-api-key": "isolated-fixture-key", "content-type": "application/json" }, body: JSON.stringify({ username: "CasePlayer", product_id: caseGame.id }) }))
    assert.equal((await checked.json()).allowed, true, "Legacy game checks must use the latest grant across Roblox name case variants")
    ticket = 1260 // Pig Panic, one day.
    const desktopUser = await user(), desktop = await api.drawHalloween(desktopUser, now)
    const previousLookup = lookupCalls
    const desktopClaim = await api.claimHalloween(desktopUser, desktop.id, null, now)
    assert.equal(lookupCalls, previousLookup, "Desktop prizes are bound to the store account")
    assert.equal((await db.user_program_access.findFirstOrThrow()).user_id, desktopUser)
    assert.equal(desktopClaim.claimedAt != null, true)
    // Hold the access row while a real paid grant commits ahead of the event write.
    const raceUser = await user(), raceDraw = await api.drawHalloween(raceUser, now)
    await db.user_program_access.create({ data: { user_id: raceUser, product_id: raceDraw.prize.product.id, expires_at: new Date("2026-01-01Z") } })
    const paid = await pool.connect()
    let raced: Promise<unknown> | null = null
    try {
      await paid.query("BEGIN")
      await paid.query("SELECT id FROM user_program_access WHERE user_id=$1 FOR UPDATE", [raceUser])
      raced = api.claimHalloween(raceUser, raceDraw.id, null, now)
      let waiting = false
      for (let i = 0; i < 100 && !waiting; i++) {
        waiting = (await admin.query("SELECT 1 FROM pg_stat_activity WHERE application_name=$1 AND wait_event_type='Lock' AND query ILIKE '%user_program_access%'", [schema])).rowCount! > 0
        if (!waiting) await new Promise(resolve => setTimeout(resolve, 20))
      }
      assert.ok(waiting, "Fixture must observe the event write waiting behind a payment row lock")
      await paid.query("UPDATE user_program_access SET expires_at='9999-12-31T00:00:00Z' WHERE user_id=$1", [raceUser])
      await paid.query("COMMIT")
      const granted = await raced as { result: { permanent: boolean } }
      assert.equal(granted.result.permanent, true, "The event must preserve a permanent payment committed after its initial read")
    } finally { await paid.query("ROLLBACK").catch(() => {}); paid.release(); await raced?.catch(() => {}) }
    const failureUser = await user(), failureDraw = await api.drawHalloween(failureUser, now)
    await pool.query(`CREATE FUNCTION fail_event_order() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RAISE EXCEPTION 'fixture insert failed'; END$$; CREATE TRIGGER fail_event_order BEFORE INSERT ON orders FOR EACH ROW EXECUTE FUNCTION fail_event_order()`)
    await assert.rejects(api.claimHalloween(failureUser, failureDraw.id, null, now))
    assert.equal(await db.user_program_access.count({ where: { user_id: failureUser } }), 0, "Failed order rolls back its access grant")
    assert.equal((await db.halloween_draws.findUniqueOrThrow({ where: { id: failureDraw.id } })).claimed_at, null)
    await pool.query("DROP TRIGGER fail_event_order ON orders; DROP FUNCTION fail_event_order()")
    const permanentUser = await user(), permanentDraw = await api.drawHalloween(permanentUser, now)
    await db.user_program_access.create({ data: { user_id: permanentUser, product_id: permanentDraw.prize.product.id, expires_at: new Date("9999-12-31T00:00:00Z") } })
    assert.equal((await api.claimHalloween(permanentUser, permanentDraw.id, null, now)).result.permanent, true)
    const blocked = await user()
    await db.users.update({ where: { id: blocked }, data: { nativeStatus: "KICKED" } })
    await assert.rejects(api.drawHalloween(blocked, now), { code: "account_unavailable" })
    await db.products.update({ where: { slug: "ac-slash" }, data: { is_active: false } })
    await assert.rejects(api.drawHalloween(await user(), now), { code: "unavailable" })
    console.log("Halloween PostgreSQL: unique concurrent draws, atomic points, durable results, ownership, canonical Roblox/Tikkies binding, desktop grants, extension, permanent access and rollback OK")
  } finally {
    await db.$disconnect(); await pool.end()
    await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`)
    await admin.end()
  }
}
check().catch(error => { console.error(error.message); process.exitCode = 1 })
