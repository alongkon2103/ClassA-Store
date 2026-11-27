import type {Identity} from './tikkies'
import { createHash } from "node:crypto"
import { constants } from "node:fs"
import { lstat, open, realpath } from "node:fs/promises"
import path from "node:path"
import type { Prisma, PrismaClient, product_presets } from "@prisma/client"
import { TikkiesError } from "./tikkies"
import { parseLibraryRequest, readTikkiesLibrary } from "./tikkiesLibrary"
import { readFunctionDefaults } from "./tikkiesFunctionDefaults"
import { validateTikkiesBindings } from "../tikkiesBindings"

const MAX_BYTES = 2 * 1024 * 1024
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
type Options = { uploadRoot?: string }
type Preset = Pick<product_presets, "id" | "product_id" | "filename" | "url" | "filesize" | "sort_order" | "created_at" | "tikkies_bindings">
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value)
function safeJson(value: unknown, depth = 0): boolean {
  if (depth > 12) return false
  if (value === null || typeof value === "boolean" || typeof value === "string") return true
  if (typeof value === "number") return Number.isFinite(value)
  if (Array.isArray(value)) return value.length <= 1000 && value.every(item => safeJson(item, depth + 1))
  return record(value) && Object.keys(value).length <= 100 && Object.entries(value).every(([key, item]) => !["__proto__", "constructor", "prototype"].includes(key) && safeJson(item, depth + 1))
}
export function parsePresetRequest(body: unknown): { email: string; productId: string;identities?:Identity[] } {
  const input = parseLibraryRequest(body)
  if (!input.email || !input.productId) throw new TikkiesError("invalid_input", 400)
  return { email: input.email, productId: input.productId,...(input.identities?{identities:input.identities}:{}) }
}
function ordered(rows: Preset[]): Preset[] {
  return [...rows].sort((a, b) => (a.sort_order ?? Number.MAX_SAFE_INTEGER) - (b.sort_order ?? Number.MAX_SAFE_INTEGER)
    || (a.created_at?.getTime() ?? Number.MAX_SAFE_INTEGER) - (b.created_at?.getTime() ?? Number.MAX_SAFE_INTEGER)
    || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
}
const presetOrder: Prisma.product_presetsOrderByWithRelationInput[] = [
  { sort_order: { sort: "asc", nulls: "last" } }, { created_at: { sort: "asc", nulls: "last" } }, { id: "asc" },
]
async function presets(db: Pick<PrismaClient, "product_presets">, productId: string) {
  const rows = await db.product_presets.findMany({ where: { product_id: productId },
    orderBy: presetOrder })
  return ordered(rows)
}
async function* presetCandidates(db: Pick<PrismaClient, "product_presets">, productId: string) {
  const pageSize = 200
  for (let skip = 0; ; skip += pageSize) {
    const rows = await db.product_presets.findMany({
      where: { product_id: productId, filename: { endsWith: ".tikkies", mode: "insensitive" } },
      orderBy: presetOrder, take: pageSize, skip,
    })
    for (const row of ordered(rows)) yield row
    if (rows.length < pageSize) return
  }
}

export async function lockPresetProduct(tx: Prisma.TransactionClient, productId: string) {
  if (!UUID.test(productId)) throw new TikkiesError("invalid_input", 400)
  const rows = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM products WHERE id = ${productId}::uuid FOR UPDATE`
  if (!rows.length) throw new TikkiesError("product_not_found", 404)
}

/** The product lock serializes append with other uploads and explicit default promotion. */
export async function appendProductPreset(db: PrismaClient, productId: string, input: unknown) {
  if (!record(input) || Object.keys(input).some(key => !["url", "filename", "filesize", "sort_order"].includes(key))) throw new TikkiesError("invalid_input", 400)
  const { url, filename } = input, filesize = input.filesize ?? null
  if (typeof url !== "string" || !url.trim() || url.length > 2048 || /[\x00-\x1f\x7f]/.test(url)
      || typeof filename !== "string" || !filename.trim() || filename.length > 255 || /[\x00-\x1f\x7f]/.test(filename)
      || (filesize !== null && (typeof filesize !== "number" || !Number.isSafeInteger(filesize) || filesize < 0 || filesize > 100 * 1024 * 1024))) throw new TikkiesError("invalid_input", 400)
  return db.$transaction(async tx => {
    await lockPresetProduct(tx, productId)
    const current = await presets(tx, productId)
    for (const [index, row] of current.entries()) {
      if (row.sort_order === index) continue
      const changed = await tx.product_presets.updateMany({ where: { id: row.id, product_id: productId }, data: { sort_order: index } })
      if (changed.count !== 1) throw new TikkiesError("preset_changed", 409)
    }
    // Legacy clients may still send sort_order; only an explicit promotion can change the default.
    return tx.product_presets.create({ data: { product_id: productId, url, filename, filesize, sort_order: current.length } })
  }, { timeout: 15000 })
}

/** Read only generated local upload basenames. Never fetch a stored URL. */
export async function readLocalTikkiesPreset(preset: Pick<Preset, "filename" | "url">, origin: string, options: Options = {}) {
  if (typeof preset.filename !== "string" || preset.filename.length > 255 || !/\.tikkies$/i.test(preset.filename) || /[\x00-\x1f\x7f/\\]/.test(preset.filename)
      || typeof preset.url !== "string" || preset.url.length > 2048 || preset.url.includes("..") || /[%\\\x00-\x20\x7f]/.test(preset.url)) return null
  try {
    const url = new URL(preset.url, origin)
    if (url.origin !== origin || url.protocol !== "https:" || url.username || url.password || url.search || url.hash) return null
    const filename = /^(?:\/uploads)?\/presets\/([A-Za-z0-9][A-Za-z0-9._-]{0,199}\.tikkies)$/i.exec(url.pathname)?.[1]
    if (!filename || filename.includes("..")) return null
    const uploadRoot = options.uploadRoot || (process.env.NODE_ENV === "production" ? "/var/www/uploads" : path.join(process.cwd(), "public", "uploads"))
    const folder = path.resolve(uploadRoot, "presets")
    const folderStat = await lstat(folder)
    if (!folderStat.isDirectory() || folderStat.isSymbolicLink()) return null
    const root = await realpath(folder), file = path.join(root, filename), before = await lstat(file)
    if (!before.isFile() || before.isSymbolicLink() || before.size < 1 || before.size > MAX_BYTES || await realpath(file) !== file) return null
    const handle = await open(file, constants.O_RDONLY | (constants.O_NOFOLLOW || 0))
    try {
      const stat = await handle.stat()
      if (!stat.isFile() || stat.dev !== before.dev || stat.ino !== before.ino || stat.size !== before.size) return null
      const buffer = Buffer.alloc(MAX_BYTES + 1)
      let length = 0
      for (;;) {
        const { bytesRead } = await handle.read(buffer, length, buffer.length - length, null)
        if (!bytesRead) break
        length += bytesRead
        if (length > MAX_BYTES) return null
      }
      const after = await handle.stat()
      if (length !== stat.size || after.size !== stat.size || after.mtimeMs !== stat.mtimeMs) return null
      const bytes = buffer.subarray(0, length)
      const parsed: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes))
      const actions = Array.isArray(parsed) ? parsed : record(parsed) && parsed.app === "tikkies-tools" && parsed.type === "actions" && parsed.version === 1 ? parsed.actions : null
      if (!Array.isArray(actions) || actions.length > 200 || !actions.every(action => record(action) && safeJson(action))) return null
      return { actions, contentRevision: createHash("sha256").update(bytes).digest("hex") }
    } finally { await handle.close() }
  } catch { return null }
}

function envelope(preset: Preset, file: { actions: unknown[]; contentRevision: string }, functions: Awaited<ReturnType<typeof readFunctionDefaults>>, gameId: string, validUntil: string) {
  const identity = { id: preset.id, filename: preset.filename }
  let bindings
  if (preset.tikkies_bindings != null) {
    try { bindings = validateTikkiesBindings(preset.tikkies_bindings, file.contentRevision, file.actions, functions.functions) }
    catch (error) { throw new TikkiesError(error instanceof TikkiesError && error.code === "bindings_stale" ? "preset_bindings_stale" : "preset_bindings_invalid", error instanceof TikkiesError && error.code === "bindings_stale" ? 409 : 503) }
  }
  const revision = createHash("sha256").update(JSON.stringify({ preset: identity, content: file.contentRevision, functions: functions.revision, ...(bindings ? { bindings } : {}) })).digest("hex")
  return { schemaVersion: 1 as const, gameId, validUntil, revision, preset: identity, actions: file.actions, functions, ...(bindings ? { bindings } : {}) }
}

export async function readTikkiesPreset(db: PrismaClient, input: { email: string; productId: string;identities?:Identity[] }, origin: string, options: Options = {}) {
  async function owned() {
    const library = await db.$transaction(tx => readTikkiesLibrary(tx, input.email, new Date(), origin, input.productId,input.identities), { isolationLevel: "RepeatableRead", timeout: 10000 })
    const game = library.games.find(row => row.id === input.productId)
    if (!game) throw new TikkiesError("game_not_found", 404)
    if (game.access !== "owned") throw new TikkiesError(game.access === "expired" ? "game_access_expired" : "game_not_owned", 403)
    if (game.platform !== "roblox") throw new TikkiesError("roblox_not_supported", 409)
    return { library, game }
  }
  await owned()
  for await (const preset of presetCandidates(db, input.productId)) {
    const file = await readLocalTikkiesPreset(preset, origin, options)
    if (!file) {
      if (preset.tikkies_bindings != null) throw new TikkiesError("preset_bindings_stale", 409)
      continue
    }
    // The upload read is outside a DB transaction; recheck current rights afterward.
    const latest = await owned()
    const functions = ("functionDefaults" in latest.game ? latest.game.functionDefaults : null) as Awaited<ReturnType<typeof readFunctionDefaults>> | null
    if (!functions) throw new TikkiesError("preset_unavailable", 503)
    if (Date.parse(latest.library.validUntil) <= Date.now()) throw new TikkiesError("game_access_expired", 403)
    const result = envelope(preset, file, functions, input.productId, latest.library.validUntil)
    if (Buffer.byteLength(JSON.stringify(result)) <= MAX_BYTES) return result
  }
  throw new TikkiesError("game_preset_missing", 404)
}

export async function promoteTikkiesPreset(db: PrismaClient, productId: string, presetId: string, origin: string, options: Options = {}) {
  const product = await db.products.findFirst({ where: { id: productId, type: "roblox_whitelist" }, select: { id: true } })
  if (!product) throw new TikkiesError("roblox_not_supported", 409)
  const rows = await presets(db, productId), picked = rows.find(row => row.id === presetId)
  if (!picked) throw new TikkiesError("preset_not_found", 404)
  const file = await readLocalTikkiesPreset(picked, origin, options)
  if (!file) throw new TikkiesError("preset_incompatible", 400)
  const functions = await readFunctionDefaults(db, productId, origin)
  if (Buffer.byteLength(JSON.stringify(envelope(picked, file, functions, productId, new Date(Date.now() + 60000).toISOString()))) > MAX_BYTES) throw new TikkiesError("preset_incompatible", 400)
  return db.$transaction(async tx => {
    await lockPresetProduct(tx, productId)
    const current = await presets(tx as unknown as PrismaClient, productId)
    const selected = current.find(row => row.id === presetId)
    if (!selected || selected.url !== picked.url || selected.filename !== picked.filename) throw new TikkiesError("preset_changed", 409)
    const sorted = [selected, ...current.filter(row => row.id !== presetId)]
    for (const [index, row] of sorted.entries()) {
      const changed = await tx.product_presets.updateMany({ where: { id: row.id, product_id: productId }, data: { sort_order: index } })
      if (changed.count !== 1) throw new TikkiesError("preset_changed", 409)
    }
    return { presets: sorted.map((row, sort_order) => ({ ...row, sort_order })) }
  })
}
