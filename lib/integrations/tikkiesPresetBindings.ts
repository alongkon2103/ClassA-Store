import type { Prisma, PrismaClient } from "@prisma/client"
import { TikkiesError } from "./tikkies"
import { lockPresetProduct, readLocalTikkiesPreset } from "./tikkiesPreset"
import { readFunctionDefaults } from "./tikkiesFunctionDefaults"
import { describePresetActions, validateTikkiesBindings } from "../tikkiesBindings"

type Options = { uploadRoot?: string }
type Database = Prisma.TransactionClient
async function context(db: Database, productId: string, presetId: string, origin: string, options: Options) {
  const product = await db.products.findFirst({ where: { id: productId, type: "roblox_whitelist" }, select: { id: true } })
  if (!product) throw new TikkiesError("roblox_not_supported", 409)
  const preset = await db.product_presets.findFirst({ where: { id: presetId, product_id: productId } })
  if (!preset) throw new TikkiesError("preset_not_found", 404)
  const file = await readLocalTikkiesPreset(preset, origin, options)
  if (!file) throw new TikkiesError("preset_incompatible", 400)
  const functions = await readFunctionDefaults(db, productId, origin)
  return { preset, file, functions }
}
function view(data: Awaited<ReturnType<typeof context>>) {
  const { preset, file, functions } = data
  let bindings = null, bindingError: string | null = null
  if (preset.tikkies_bindings != null) {
    try { bindings = validateTikkiesBindings(preset.tikkies_bindings, file.contentRevision, file.actions, functions.functions) }
    catch (error) { bindingError = error instanceof TikkiesError ? error.code : "bindings_invalid" }
  }
  return { schemaVersion: 1 as const, preset: { id: preset.id, filename: preset.filename }, sourceRevision: file.contentRevision,
    functions, actions: describePresetActions(file.actions), bindings, bindingError }
}
export async function readPresetBindings(db: PrismaClient, productId: string, presetId: string, origin: string, options: Options = {}) {
  return view(await context(db, productId, presetId, origin, options))
}
export async function savePresetBindings(db: PrismaClient, productId: string, presetId: string, body: unknown, origin: string, options: Options = {}) {
  if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).some(key => !["sourceRevision", "entries"].includes(key))) throw new TikkiesError("bindings_invalid", 400)
  const input = body as Record<string, unknown>
  return db.$transaction(async tx => {
    await lockPresetProduct(tx, productId)
    const data = await context(tx, productId, presetId, origin, options)
    const latest = await readLocalTikkiesPreset(data.preset, origin, options)
    if (!latest || latest.contentRevision !== data.file.contentRevision) throw new TikkiesError("bindings_stale", 409)
    const bindings = validateTikkiesBindings({ schemaVersion: 1, sourceRevision: input.sourceRevision, entries: input.entries }, latest.contentRevision, latest.actions, data.functions.functions)
    const changed = await tx.product_presets.updateMany({ where: { id: presetId, product_id: productId }, data: { tikkies_bindings: bindings } })
    if (changed.count !== 1) throw new TikkiesError("preset_changed", 409)
    return view({ ...data, preset: { ...data.preset, tikkies_bindings: bindings }, file: latest })
  }, { timeout: 15000 })
}
