import type { Prisma, PrismaClient } from "@prisma/client"

export type FunctionCategory = "help" | "troll" | "neutral"
export type FunctionInput = { name: string; category: FunctionCategory; label_th?: string | null; label_en?: string | null; image_url?: string | null; sort_order?: number; default_gift_id?: number | null; default_trigger_threshold?: number | null }
export class FunctionInputError extends Error {
  constructor(public code: string, public status = 400, public field?: string, public index?: number) { super(code) }
}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const categories: FunctionCategory[] = ["help", "troll", "neutral"]
export const normalizedFunctionName = (name: string) => name.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase()
export const functionAlias = (name: string) => normalizedFunctionName(name).replace(/[\s_-]+/g, "")
const aliases = new Map<string, FunctionCategory>()
for (const [kind, names] of [
  ["help", "removemobs|mob purge|giant|shrinkisland|island shrinks|golem|golem ally|meteor|mega herd|addtime|time bonus|freeze|magnet|lockdown|pen locked|purify|fly"],
  ["troll", "addmobs|mob rain|shrink|growisland|island grows|cage|caged|zombie|zombie raid|babyswarm|baby swarm|blackout|black out|subtime|time penalty|jailbreak"],
] as const) for (const name of names.split("|")) aliases.set(functionAlias(name), kind)
export function inferFunctionCategory(name: string): FunctionCategory {
  const key = functionAlias(name), known = aliases.get(key)
  if (known) return known
  if (/^up\d+(?:\.\d+)?$/.test(key) || key === "winplus" || /^\+\d+(?:\.\d+)?(?:win)?$/.test(key)) return "help"
  if (/^down\d+(?:\.\d+)?$/.test(key) || key === "winminus" || /^-\d+(?:\.\d+)?(?:win)?$/.test(normalizedFunctionName(name).replace(/\s+/g, ""))) return "troll"
  return "neutral"
}
export function inferLegacyCategory(row: { name: string; label_th?: string | null; label_en?: string | null }): FunctionCategory {
  const name = inferFunctionCategory(row.name)
  if (name !== "neutral") return name
  // Signed counter labels are unambiguous even when a legacy function's key is
  // just a numeric slot. Character names and conflicting signs stay neutral.
  const labels = [row.label_th, row.label_en].filter((label): label is string => typeof label === "string" && /^[+-]\s*\d+(?:\.\d+)?\s*(?:win)?$/i.test(label.trim())).map(inferFunctionCategory)
  return labels.length && labels.every(label => label === labels[0]) ? labels[0] : "neutral"
}
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value)
const fail = (field?: string): never => { throw new FunctionInputError("invalid_input", 400, field) }
export function validateFunctionId(value: string) { if (!uuid.test(value)) fail("id"); return value }

function nullableText(value: unknown, max: number, field: string): string | null {
  if (value === null || value === "") return null
  if (typeof value !== "string" || value.length > max || /[\u0000-\u001f\u007f]/.test(value)) return fail(field)
  return value.trim() || null
}
export function parseFunctionInput(body: unknown, partial = false): Partial<FunctionInput> {
  if (!record(body)) return fail()
  const allowed = ["name", "label_th", "label_en", "image_url", "category", "sort_order", "default_gift_id", "default_trigger_threshold"]
  if (!Object.keys(body).length || Object.keys(body).some(key => !allowed.includes(key))) return fail()
  const out: Partial<FunctionInput> = {}
  if (!partial || "name" in body) {
    const name = nullableText(body.name, 120, "name")
    if (!name) return fail("name")
    out.name = name
  }
  for (const key of ["label_th", "label_en"] as const) if (key in body) out[key] = nullableText(body[key], 200, key)
  if ("image_url" in body) {
    const image = nullableText(body.image_url, 2048, "image_url")
    if (image) {
      try {
        const local = image.startsWith("/") && !image.startsWith("//") && !image.includes("\\") && !image.split(/[?#]/)[0].split("/").includes("..")
        const url = new URL(image, "https://store.invalid")
        if ((image.startsWith("/") ? !local : !/^https:\/\//i.test(image) || url.protocol !== "https:") || url.username || url.password || /\s/.test(image)) fail("image_url")
      } catch { fail("image_url") }
    }
    out.image_url = image
  }
  if ("category" in body) {
    if (typeof body.category !== "string" || !categories.includes(body.category as FunctionCategory)) fail("category")
    out.category = body.category as FunctionCategory
  } else if (!partial) out.category = inferFunctionCategory(out.name!)
  if ("sort_order" in body) {
    if (!Number.isSafeInteger(body.sort_order) || Math.abs(body.sort_order as number) > 1000000) fail("sort_order")
    out.sort_order = body.sort_order as number
  }
  for (const key of ["default_gift_id", "default_trigger_threshold"] as const) if (key in body) {
    const value = body[key]
    const maximum = key === "default_gift_id" ? 2147483647 : 10000
    if (value !== null && (!Number.isSafeInteger(value) || (value as number) < 1 || (value as number) > maximum)) fail(key)
    out[key] = value as number | null
  }
  return out
}
export function parseBulkFunctions(body: unknown): FunctionInput[] {
  if (!record(body) || Object.keys(body).some(key => key !== "items") || !Array.isArray(body.items) || !body.items.length || body.items.length > 100) fail("items")
  return (body as { items: unknown[] }).items.map((item, index) => {
    try {
      return parseFunctionInput(item) as FunctionInput
    } catch (error) { if (error instanceof FunctionInputError) error.index = index; throw error }
  })
}
async function lockProduct(tx: Prisma.TransactionClient, id: string) {
  validateFunctionId(id)
  const rows = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM products WHERE id = ${id}::uuid FOR UPDATE`
  if (!rows.length) throw new FunctionInputError("product_not_found", 404)
}
async function checkGifts(tx: Prisma.TransactionClient, inputs: Partial<FunctionInput>[]) {
  const ids = [...new Set(inputs.map(input => input.default_gift_id).filter((id): id is number => typeof id === "number"))]
  if (!ids.length) return
  const rows = await tx.gifts.findMany({ where: { id: { in: ids } }, select: { id: true, trigger_type: true } })
  for (const [index, input] of inputs.entries()) {
    if (input.default_gift_id == null) continue
    const gift = rows.find(row => row.id === input.default_gift_id)
    if (!gift) throw new FunctionInputError("gift_not_found", 400, "default_gift_id", index)
    if (gift.trigger_type?.toLowerCase() === "like" && input.default_trigger_threshold != null && ![15, 30, 45, 60, 75, 90, 105].includes(input.default_trigger_threshold)) throw new FunctionInputError("invalid_input", 400, "default_trigger_threshold", index)
  }
}
export async function createFunctions(db: PrismaClient, productId: string, inputs: FunctionInput[]) {
  return db.$transaction(async tx => {
    await lockProduct(tx, productId)
    // The UUID identifies each binding; command keys may be shared by several gifts.
    const existing = await tx.product_functions.findMany({ where: { product_id: productId }, select: { sort_order: true } })
    await checkGifts(tx, inputs)
    let next = Math.max(-1, ...existing.map(row => row.sort_order)) + 1
    const created = []
    for (const input of inputs) created.push(await tx.product_functions.create({ data: { ...input, product_id: productId, sort_order: input.sort_order ?? next++ } }))
    return created
  }, { timeout: 15000 })
}
export async function patchFunction(db: PrismaClient, productId: string, id: string, patch: Partial<FunctionInput>) {
  validateFunctionId(id)
  return db.$transaction(async tx => {
    await lockProduct(tx, productId)
    const existing = await tx.product_functions.findFirst({ where: { id, product_id: productId } })
    if (!existing) throw new FunctionInputError("function_not_found", 404)
    if ("default_gift_id" in patch || "default_trigger_threshold" in patch) await checkGifts(tx, [{ ...existing, ...patch } as FunctionInput])
    return tx.product_functions.update({ where: { id }, data: patch })
  })
}
export async function reorderFunctions(db: PrismaClient, productId: string, body: unknown) {
  if (!Array.isArray(body) || !body.length || body.length > 1000) fail("items")
  const ids = new Set<string>()
  const items = (body as unknown[]).map(item => {
    if (!record(item) || Object.keys(item).some(key => !["id", "sort_order"].includes(key)) || typeof item.id !== "string" || !uuid.test(item.id) || ids.has(item.id) || !Number.isSafeInteger(item.sort_order) || Math.abs(item.sort_order as number) > 1000000) return fail("items")
    ids.add(item.id); return { id: item.id, sort_order: item.sort_order as number }
  })
  return db.$transaction(async tx => {
    await lockProduct(tx, productId)
    const existing = await tx.product_functions.findMany({ where: { product_id: productId }, select: { id: true } })
    if (items.some(item => !existing.some(row => row.id === item.id))) throw new FunctionInputError("function_not_found", 404)
    for (const item of items) await tx.product_functions.update({ where: { id: item.id }, data: { sort_order: item.sort_order } })
    return { ok: true }
  })
}
export function functionError(error: unknown) {
  if (error instanceof FunctionInputError) return { status: error.status, body: { error: error.code, ...(error.field ? { field: error.field } : {}), ...(error.index !== undefined ? { index: error.index } : {}) } }
  if (error instanceof SyntaxError) return { status: 400, body: { error: "invalid_input" } }
  return { status: 500, body: { error: "internal_error" } }
}
