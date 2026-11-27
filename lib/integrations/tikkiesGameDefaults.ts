import type {Identity} from './tikkies'
// Canonical defaults persistence and entitled integration delivery.
import { createHash } from "node:crypto"
import type { Prisma, PrismaClient } from "@prisma/client"
import { GameDefaultsError, defaultsRecord, stableDefaultsJson, validateGameDefaults, type GameDefaultsDocument, type GameDefaultsPlatform, type GameDefaultsView } from "../tikkiesGameDefaults"
import { inferFunctionCategory } from "../productFunctions"
import { getImageUrl } from "../getImageUrl"
import { TikkiesError } from "./tikkies"
import { readTikkiesLibrary } from "./tikkiesLibrary"
import { readLocalTikkiesPreset } from "./tikkiesPreset"
import { validateTikkiesBindings } from "../tikkiesBindings"
import { importGameDefaults, type LegacyGameFunction } from "./tikkiesGameDefaultsImport"
import { publishedGameCommandInputs, publishedGameCommands, validateGameIntegration, validateGameIntegrationResponses } from "../gameIntegration"
import { gameMapCredential, gameMapCredentialHash, readGameIntegration, writeGameIntegration } from "./gameIntegrationStorage"
export type DefaultsStorageRow = { config: unknown; revision: string; previous_config?: unknown; previous_revision?: string | null }

type Database = Prisma.TransactionClient
type Options = { uploadRoot?: string }
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const digest = (value: unknown) => createHash("sha256").update(stableDefaultsJson(value)).digest("hex")
const checkId = (id: string) => { if (!UUID.test(id)) throw new GameDefaultsError("invalid_input") }
async function product(db: Database, id: string) {
  checkId(id)
  const row = await db.products.findFirst({ where: { id }, select: { id: true, type: true, program_key: true } })
  if (!row) throw new GameDefaultsError("product_not_found", 404)
  const platform: GameDefaultsPlatform | null = row.type === "roblox_whitelist" ? "roblox" : row.type === "desktop_program" && row.program_key === "ac_pig_panic" ? "minecraft" : null
  if (!platform) throw new GameDefaultsError("game_not_supported", 409)
  return { ...row, platform }
}
async function published(db: Database, productId: string): Promise<DefaultsStorageRow | null> {
  const rows = await db.$queryRaw<DefaultsStorageRow[]>`SELECT config, revision FROM product_tikkies_defaults WHERE product_id = ${productId}::uuid`
  if (!rows.length) return null
  const row = rows[0], config = validateGameDefaults(row.config)
  if (!/^[a-f0-9]{64}$/.test(row.revision) || row.revision !== digest(config)) throw new GameDefaultsError("defaults_unavailable", 503)
  return { config, revision: row.revision }
}
async function inputs(db: Database, productId: string, origin: string) {
  const [rows, presets] = await Promise.all([
    db.product_functions.findMany({ where: { product_id: productId }, orderBy: [{ sort_order: "asc" }, { id: "asc" }], take: 201, select: { id: true, name: true, label_th: true, label_en: true, image_url: true, category: true, sort_order: true, default_trigger_threshold: true, default_gift: { select: { id: true, name: true, trigger_type: true } } } }),
    db.product_presets.findMany({ where: { product_id: productId }, orderBy: [{ sort_order: { sort: "asc", nulls: "last" } }, { created_at: { sort: "asc", nulls: "last" } }, { id: "asc" }], take: 201 }),
  ])
  if (rows.length > 200 || presets.length > 200) throw new GameDefaultsError("defaults_capacity_exceeded", 409)
  const functions: LegacyGameFunction[] = rows.map(row => {
    const gift = row.default_gift, type = gift?.trigger_type?.toLowerCase() || "gift"
    let trigger: Record<string, unknown> | null = null
    if (gift && type === "gift") trigger = { type: "gift", giftId: String(gift.id), giftName: gift.name, triggerThreshold: row.default_trigger_threshold || 1 }
    else if (gift && type === "like" && row.default_trigger_threshold) trigger = { type: "like", likeThreshold: row.default_trigger_threshold, likeMode: "perUser" }
    else if (gift && ["follow", "share", "subscribe", "member"].includes(type)) trigger = { type }
    let imageUrl: string | null = null
    try { if (row.image_url) { const url = new URL(getImageUrl(row.image_url), origin); if (url.protocol === "https:" && !url.username && !url.password) imageUrl = url.href } } catch { /* Unsafe legacy artwork does not become executable input. */ }
    return { id: row.id, key: row.name, labelTh: row.label_th, labelEn: row.label_en, imageUrl, kind: row.category || inferFunctionCategory(row.name), giftId: gift && type === "gift" ? String(gift.id) : null, giftName: gift?.name || null, triggerThreshold: row.default_trigger_threshold, trigger }
  })
  return { functions, presets }
}
async function legacy(db: Database, productId: string, platform: GameDefaultsPlatform, origin: string, options: Options) {
  const data = await inputs(db, productId, origin)
  const blocked = (code: string, sourceRevision: string | null) => ({ ...data, document: { schemaVersion: 1, platform, effects: [], actions: [] } as GameDefaultsDocument, warnings: ["ค่าเดิมต้องตรวจสอบก่อนนำเข้า (" + code + ") สามารถนำเข้าหรือสร้างค่าเริ่มต้นใหม่ได้"], sourceRevision })
  if (platform === "minecraft") {
    const result = importGameDefaults({ platform, functions: data.functions })
    return { ...result, ...data, sourceRevision: null }
  }
  for (const preset of data.presets) {
    const file = await readLocalTikkiesPreset(preset, origin, options)
    if (!file) {
      if (preset.tikkies_bindings != null) return blocked("preset_bindings_stale", null)
      continue
    }
    try {
      const bindings = preset.tikkies_bindings == null ? null : validateTikkiesBindings(preset.tikkies_bindings, file.contentRevision, file.actions, data.functions)
      return { ...importGameDefaults({ platform, preset: file.actions, functions: data.functions, bindings }), ...data, sourceRevision: file.contentRevision }
    } catch (error) {
      if (error instanceof GameDefaultsError || error instanceof TikkiesError) return blocked(error.code, file.contentRevision)
      throw error
    }
  }
  return { document: { schemaVersion: 1, platform, effects: [], actions: [] } as GameDefaultsDocument, warnings: data.functions.length ? ["เลือกไฟล์ .tikkies เดิมเพื่อนำเข้าปุ่มกด หรือเพิ่มอีเวนต์เกมใหม่"] : [], ...data, sourceRevision: null }
}
async function view(db: Database, productId: string, origin: string, options: Options): Promise<GameDefaultsView> {
  const item = await product(db, productId), saved = await published(db, productId)
  const connection = await readGameIntegration(db, productId)
  if (saved) {
    const document = validateGameDefaults(saved.config)
    if (document.platform !== item.platform) throw new GameDefaultsError("platform_mismatch", 409)
    const presets = await db.product_presets.findMany({ where: { product_id: productId }, orderBy: [{ sort_order: "asc" }, { id: "asc" }], take: 201, select: { id: true, filename: true } })
    if (presets.length > 200) throw new GameDefaultsError("defaults_capacity_exceeded", 409)
    return { ok: true, gameId: productId, platform: item.platform, revision: saved.revision, published: true, source: "published", document, warnings: [], presets: presets.filter(row => /\.tikkies$/i.test(row.filename)), integration: connection.integration, integrationRevision: connection.integrationRevision }
  }
  const data = await legacy(db, productId, item.platform, origin, options)
  return { ok: true, gameId: productId, platform: item.platform, revision: digest({ productId, document: data.document, functions: data.functions, presets: data.presets, sourceRevision: data.sourceRevision }), published: false, source: data.functions.length || data.sourceRevision ? "legacy" : "empty", document: data.document, warnings: data.warnings, presets: data.presets.filter(row => /\.tikkies$/i.test(row.filename)).map(({ id, filename }) => ({ id, filename })), integration: connection.integration, integrationRevision: connection.integrationRevision }
}
export async function readAdminGameDefaults(db: PrismaClient, productId: string, origin: string, options: Options = {}) {
  return db.$transaction(tx => view(tx, productId, origin, options), { isolationLevel: "RepeatableRead", timeout: 15000 })
}
export async function saveAdminGameDefaults(db: PrismaClient, productId: string, body: unknown, origin: string, options: Options = {}) {
  checkId(productId)
  if (!defaultsRecord(body) || Object.keys(body).some(key => !["expectedRevision", "document", "integration", "expectedIntegrationRevision"].includes(key)) || typeof body.expectedRevision !== "string" || !/^[a-f0-9]{64}$/.test(body.expectedRevision) || ("integration" in body) !== ("expectedIntegrationRevision" in body) || "integration" in body && (typeof body.expectedIntegrationRevision !== "string" || !/^[a-f0-9]{64}$/.test(body.expectedIntegrationRevision))) throw new GameDefaultsError("invalid_input")
  return db.$transaction(async tx => {
    const locked = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM products WHERE id = ${productId}::uuid FOR UPDATE`
    if (!locked.length) throw new GameDefaultsError("product_not_found", 404)
    const current = await view(tx, productId, origin, options), document = validateGameDefaults(body.document)
    if (document.platform !== current.platform) throw new GameDefaultsError("platform_mismatch", 409)
    if (body.expectedRevision !== current.revision) throw new GameDefaultsError("defaults_changed", 409)
    validateGameIntegrationResponses("integration" in body ? validateGameIntegration(body.integration) : current.integration, document)
    if ("integration" in body) {
      if (body.expectedIntegrationRevision !== current.integrationRevision) throw new GameDefaultsError("integration_changed", 409)
      const integration = validateGameIntegration(body.integration)
      if (current.platform !== "roblox" && integration.mode === "api") throw new GameDefaultsError("integration_not_supported", 409)
      await writeGameIntegration(tx, productId, integration)
    }
    const revision = digest(document), prior = current.published ? JSON.stringify(current.document) : null, priorRevision = current.published ? current.revision : null
    if (current.published && revision === current.revision) return view(tx, productId, origin, options)
    await tx.$executeRaw`INSERT INTO product_tikkies_defaults (product_id, config, revision, previous_config, previous_revision, updated_at)
      VALUES (${productId}::uuid, ${JSON.stringify(document)}::jsonb, ${revision}, ${prior}::jsonb, ${priorRevision}, clock_timestamp())
      ON CONFLICT (product_id) DO UPDATE SET config = EXCLUDED.config, revision = EXCLUDED.revision, previous_config = EXCLUDED.previous_config, previous_revision = EXCLUDED.previous_revision, updated_at = EXCLUDED.updated_at`
    return view(tx, productId, origin, options)
  }, { timeout: 15000 })
}
export async function importAdminGameDefaults(db: PrismaClient, productId: string, body: unknown, origin: string, options: Options = {}) {
  checkId(productId)
  if (!defaultsRecord(body) || Object.keys(body).some(key => !["presetId", "preset"].includes(key)) || ("presetId" in body) === ("preset" in body)) throw new GameDefaultsError("invalid_input")
  const item = await product(db, productId)
  if ("preset" in body) return { ok: true as const, ...importGameDefaults({ platform: item.platform, preset: body.preset }) }
  if (typeof body.presetId !== "string" || !UUID.test(body.presetId)) throw new GameDefaultsError("invalid_input")
  const data = await inputs(db, productId, origin), preset = data.presets.find(row => row.id === body.presetId)
  if (!preset) throw new GameDefaultsError("preset_not_found", 404)
  const file = await readLocalTikkiesPreset(preset, origin, options)
  if (!file) throw new GameDefaultsError("preset_incompatible")
  const bindings = preset.tikkies_bindings == null ? null : validateTikkiesBindings(preset.tikkies_bindings, file.contentRevision, file.actions, data.functions)
  return { ok: true as const, ...importGameDefaults({ platform: item.platform, preset: file.actions, functions: data.functions, bindings }) }
}
export async function readTikkiesGameDefaults(db: PrismaClient, input: { email: string; productId: string;identities?:Identity[] }, origin: string) {
  checkId(input.productId)
  return db.$transaction(async tx => {
    const library = await readTikkiesLibrary(tx, input.email, new Date(), origin, input.productId,input.identities), game = library.games.find(row => row.id === input.productId)
    if (!game) throw new TikkiesError("game_not_found", 404)
    const preview = "preview" in game && game.preview === true
    if (game.access !== "owned" && !preview) throw new TikkiesError(game.access === "expired" ? "game_access_expired" : "game_not_owned", 403)
    const item = await product(tx, input.productId), saved = await published(tx, input.productId)
    if (!saved) throw new GameDefaultsError("defaults_not_configured", 404)
    const document = validateGameDefaults(saved.config)
    if (document.platform !== item.platform) throw new GameDefaultsError("platform_mismatch", 409)
    if (Date.parse(library.validUntil) <= Date.now()) throw new TikkiesError("game_access_expired", 403)
    return { schemaVersion: 1, gameId: input.productId, validUntil: library.validUntil, ...(preview ? { preview: true as const } : {}), revision: saved.revision, document: { ...document, effects: document.effects.map(effect => ({ ...effect, imageUrl: effect.imageUrl ? new URL(getImageUrl(effect.imageUrl), origin).href : null })) } }
  }, { isolationLevel: "RepeatableRead", timeout: 10000 })
}

export async function readTikkiesInteractiveConfig(db: PrismaClient, input: { email: string; productId: string;identities?:Identity[] }, origin: string, env?: { TIKKIES_GAME_CREDENTIAL_SECRET?: string }) {
  checkId(input.productId)
  return db.$transaction(async tx => {
    const library = await readTikkiesLibrary(tx, input.email, new Date(), origin, input.productId,input.identities), game = library.games.find(row => row.id === input.productId)
    if (!game) throw new TikkiesError("game_not_found", 404)
    const preview = "preview" in game && game.preview === true
    if (game.access !== "owned" && !preview) throw new TikkiesError(game.access === "expired" ? "game_access_expired" : "game_not_owned", 403)
    const item = await product(tx, input.productId), connection = await readGameIntegration(tx, input.productId)
    if (item.platform !== "roblox" || connection.integration.mode !== "api") throw new GameDefaultsError("interactive_not_supported", 409)
    const saved = await published(tx, input.productId)
    if (!saved) throw new GameDefaultsError("defaults_not_configured", 409)
    const document = validateGameDefaults(saved.config)
    if (document.platform !== "roblox") throw new GameDefaultsError("platform_mismatch", 409)
    if (Date.parse(library.validUntil) <= Date.now()) throw new TikkiesError("game_access_expired", 403)
    const commands = publishedGameCommands(document), commandInputs = publishedGameCommandInputs(document)
    return { schemaVersion: 1 as const, gameId: input.productId, validUntil: library.validUntil, ...(preview ? { preview: true as const } : {}), integration: connection.integration, commands, credentialHash: gameMapCredentialHash(input.productId, env), ...(Object.keys(commandInputs).length ? { commandInputs } : {}) }
  }, { isolationLevel: "RepeatableRead", timeout: 10000 })
}

export async function readAdminGameConnection(db: PrismaClient, productId: string, origin: string, env?: { TIKKIES_GAME_CREDENTIAL_SECRET?: string }) {
  return db.$transaction(async tx => {
    const current = await view(tx, productId, origin, {})
    if (current.platform !== "roblox" || current.integration.mode !== "api") throw new GameDefaultsError("interactive_not_supported", 409)
    if (!current.published) throw new GameDefaultsError("defaults_not_configured", 409)
    const legacyCredential = gameMapCredentialHash(productId, env) === null
    const commandInputs = publishedGameCommandInputs(current.document)
    return { schemaVersion: 1, gameId: productId, integration: current.integration, commands: publishedGameCommands(current.document), receiverConfig: { BridgeUrl: "https://acmagnet.aclassstore.com", BridgeKey: legacyCredential ? null : gameMapCredential(productId, env), TikkiesGameId: productId }, legacyCredential, ...(Object.keys(commandInputs).length ? { commandInputs } : {}) }
  }, { isolationLevel: "RepeatableRead", timeout: 10000 })
}
