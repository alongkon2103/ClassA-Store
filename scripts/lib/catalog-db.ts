import pg from "pg"
import fs from "node:fs"
import path from "node:path"
import type { StoredGift } from "../../lib/giftCatalogSync"

export const quoteIdentifier = (name: string) => '"' + name.replaceAll('"', '""') + '"'
export type GiftReference = { schema: string; table: string; column: string; rows?: { rowId: string; giftId: number }[] }
export function connection() {
  if (!process.env.DATABASE_URL) throw Error("DATABASE_URL must be loaded using --env-file")
  return new pg.Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000, query_timeout: 30000 })
}
export async function giftReferences(db: pg.Client): Promise<GiftReference[]> {
  return (await db.query(`SELECT ns.nspname AS schema,t.relname AS table,a.attname AS column
    FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace ns ON ns.oid=t.relnamespace
    JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=c.conkey[1]
    WHERE c.contype='f' AND c.confrelid='gifts'::regclass AND cardinality(c.conkey)=1
      AND c.confkey[1]=(SELECT attnum FROM pg_attribute WHERE attrelid='gifts'::regclass AND attname='id')
    ORDER BY ns.nspname,t.relname,a.attname`)).rows
}
export async function giftSnapshot(db: pg.Client, references: GiftReference[]) {
  const gifts = (await db.query<StoredGift>("SELECT id,name,diamonds,image_url,trigger_type,is_active,sort_order FROM gifts ORDER BY id")).rows
  const refs: GiftReference[] = []
  for (const reference of references) {
    const table = quoteIdentifier(reference.schema) + "." + quoteIdentifier(reference.table), column = quoteIdentifier(reference.column)
    const rows = (await db.query(`SELECT id::text AS "rowId",${column} AS "giftId" FROM ${table} WHERE ${column} IS NOT NULL ORDER BY id`)).rows
    refs.push({ ...reference, rows })
  }
  return { gifts, references: refs }
}
export function auditPath(kind: string, supplied?: string) {
  return path.resolve(supplied || path.join("logs", kind + "-" + new Date().toISOString().replaceAll(":", "-") + ".json"))
}
export function writeAudit(output: string, value: unknown, initial = true) {
  fs.mkdirSync(path.dirname(output), { recursive: true })
  fs.writeFileSync(output, JSON.stringify(value, null, 2) + "\n", { mode: 0o600, flag: initial ? "wx" : "w" })
}
export function argumentsFor(argv: string[], allowed: string[]) {
  const result: Record<string, string | boolean> = {}
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i]
    if (!allowed.includes(key)) throw Error("Unknown argument: " + key)
    if (["--execute", "--dry-run"].includes(key)) result[key] = true
    else { const value = argv[++i]; if (!value || value.startsWith("--")) throw Error("Missing value for " + key); result[key] = value }
  }
  if (result["--execute"] && result["--dry-run"]) throw Error("Choose dry-run or execute")
  return result
}
