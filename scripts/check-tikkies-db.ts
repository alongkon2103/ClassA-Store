// Integration migration/trigger tests in an isolated schema; EVERYTHING rolls back, including its DDL.
import "dotenv/config"
import assert from "node:assert/strict"
import pg from "pg"
import { randomUUID } from "node:crypto"
import { limitTikkies } from "../lib/integrations/tikkiesSecurity"
import type { Prisma } from "@prisma/client"
import { readFile } from "node:fs/promises"
async function check() {
 const client=new pg.Client({connectionString:process.env.DATABASE_URL,connectionTimeoutMillis:5000,query_timeout:10000})
 await client.connect()
 try {
  await client.query("BEGIN")
  const schema="tikkies_test_"+randomUUID().replaceAll("-","")
  await client.query(`CREATE SCHEMA "${schema}"`)
  await client.query(`SET LOCAL search_path TO "${schema}", pg_catalog`)
  await client.query(`CREATE TABLE products(id uuid PRIMARY KEY,name_en text,type text);
   CREATE TABLE orders(id uuid PRIMARY KEY,user_id uuid,product_id uuid,status text,paid_at timestamptz,whitelist_status text,expires_at timestamptz,whitelisted_username text,updated_at timestamptz);
   CREATE TABLE user_whitelist_access(id uuid PRIMARY KEY,ign text,product_id uuid,expires_at timestamptz);`)
  const game=randomUUID(), order=randomUUID(), access=randomUUID()
  await client.query("INSERT INTO products VALUES($1,'Game','roblox_whitelist')",[game])
  await client.query("INSERT INTO orders(id,product_id,status,whitelist_status,paid_at,whitelisted_username,expires_at) VALUES($1,$2,'paid','whitelisted',now(),'OriginalName',now()+interval '2 days')",[order,game])
  const sql=await readFile(new URL("../prisma/sql/20261015_tikkies_entitlements.sql",import.meta.url),"utf8")
  await client.query(sql);await client.query(sql)
  const row=async()=> (await client.query("SELECT * FROM orders WHERE id=$1",[order])).rows[0]
  assert.equal((await row()).status,"paid");assert.equal((await row()).tikkies_revision,1)
  await client.query("UPDATE orders SET updated_at=now() WHERE id=$1",[order]);assert.equal((await row()).tikkies_revision,1,"Unrelated updates do not increment revision")
  await client.query("UPDATE orders SET roblox_user_id='123',roblox_username='OriginalName',roblox_display_name='Original',roblox_resolved_for='originalname' WHERE id=$1",[order])
  assert.equal((await row()).tikkies_revision,2)
  await client.query("UPDATE orders SET whitelisted_username='OtherAccount' WHERE id=$1",[order]);assert.equal((await row()).roblox_user_id,null,"Legacy writers invalidate stale bindings")
  assert.equal((await client.query("SELECT count(*)::int AS n FROM roblox_binding_audit")).rows[0].n,2)
  await client.query("INSERT INTO user_whitelist_access VALUES($1,'OtherAccount',$2,now()+interval '2 days')",[access,game])
  const rev=(await row()).tikkies_revision
  await client.query("DELETE FROM user_whitelist_access WHERE id=$1",[access]);assert.ok((await row()).tikkies_revision>rev,"Whitelist removal increments affected orders in the same transaction")
  const rev2=(await row()).tikkies_revision
  await client.query("UPDATE products SET name_en='Renamed',roblox_universe_id='123',roblox_place_ids=ARRAY['456'] WHERE id=$1",[game]);assert.ok((await row()).tikkies_revision>rev2)
  await client.query("UPDATE orders SET status='refunded' WHERE id=$1",[order]);assert.equal((await row()).status,"refunded")
  const execute = async (parts: TemplateStringsArray, ...values: unknown[]) => client.query(parts.reduce((sql, part, i) => sql + (i ? `$${i}` : "") + part, ""), values)
  const db = { $queryRaw: async (parts: TemplateStringsArray, ...values: unknown[]) => (await execute(parts, ...values)).rows, $executeRaw: async (parts: TemplateStringsArray, ...values: unknown[]) => (await execute(parts, ...values)).rowCount } as unknown as Prisma.TransactionClient
  const identity = [{provider:"google" as const, providerAccountId:"fixture-only"}]
  const env = { NODE_ENV:"test" as const, TIKKIES_RATE_LIMIT_PER_MINUTE:"100", TIKKIES_CUSTOMER_RATE_LIMIT_PER_MINUTE:"2" }
  assert.equal(await limitTikkies(db, identity, "fixture-secret", env), null)
  assert.equal(await limitTikkies(db, identity, "fixture-secret", env), null)
  assert.ok((await limitTikkies(db, identity, "fixture-secret", env))! > 0, "PostgreSQL shared bucket enforces subject quota")
  const buckets=(await client.query("SELECT * FROM tikkies_rate_limits")).rows
  assert.equal(buckets.length,2);assert.equal(JSON.stringify(buckets).includes("fixture-only"),false)
  await client.query("UPDATE tikkies_rate_limits SET reset_at=now()-interval '1 second'")
  assert.equal(await limitTikkies(db, identity, "fixture-secret", env), null, "Expired buckets reset atomically")
  console.log("Tikkies PostgreSQL: additive/idempotent migration, legacy preservation, no-op/source revisions, stale binding invalidation audit and shared PostgreSQL quotas OK")
 } finally { await client.query("ROLLBACK").catch(()=>{});await client.end() }
}
check().catch(e=>{console.error(e.message);process.exitCode=1})
