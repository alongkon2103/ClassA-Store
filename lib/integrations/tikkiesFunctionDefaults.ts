import { createHash } from "node:crypto"
import type { Prisma } from "@prisma/client"
import { getImageUrl } from "../getImageUrl"
import { inferFunctionCategory, type FunctionCategory } from "../productFunctions"

export type FunctionDefault = {
  id: string; key: string; labelTh: string | null; labelEn: string | null; imageUrl: string | null; kind: FunctionCategory
  giftId: string | null; giftName: string | null; giftCoins: number | null; giftImageUrl: string | null; triggerThreshold: number | null
}
const text = (value: string | null, max: number) => typeof value === "string" && value.trim() ? value.slice(0, max) : null
const positive = (value: number | null) => Number.isSafeInteger(value) && value! > 0 && value! <= 2147483647 ? value : null
function image(value: string | null, origin: string): string | null {
  if (!value || value.length > 2048) return null
  try {
    const url = new URL(getImageUrl(value), origin)
    return url.protocol === "https:" && !url.username && !url.password ? url.href : null
  } catch { return null }
}
export async function readFunctionDefaults(db: Prisma.TransactionClient, productId: string, origin: string) {
  const rows = await db.product_functions.findMany({ where: { product_id: productId }, orderBy: [{ sort_order: "asc" }, { id: "asc" }], take: 100,
    select: { id: true, name: true, label_th: true, label_en: true, image_url: true, category: true, default_gift_id: true, default_trigger_threshold: true,
      default_gift: { select: { id: true, name: true, diamonds: true, image_url: true, trigger_type: true } } } })
  const functions: FunctionDefault[] = rows.slice(0, 100).map(row => {
    const threshold = row.default_trigger_threshold
    const invalidThreshold = threshold != null && (!Number.isSafeInteger(threshold) || threshold < 1 || threshold > 10000)
    // Like/Follow are preserved shop triggers, but this DTO represents gifts.
    // An unsupported legacy threshold removes this optional binding rather than
    // silently turning its intended quantity into the runtime fallback of one.
    const gift = !invalidThreshold && row.default_gift && (!row.default_gift.trigger_type || row.default_gift.trigger_type.toLowerCase() === "gift") ? row.default_gift : null
    return { id: row.id, key: row.name, labelTh: text(row.label_th, 200), labelEn: text(row.label_en, 200), imageUrl: image(row.image_url, origin),
      kind: row.category && ["help", "troll", "neutral"].includes(row.category) ? row.category as FunctionCategory : inferFunctionCategory(row.name),
      giftId: gift && positive(gift.id) ? String(gift.id) : null, giftName: gift ? text(gift.name, 200) : null,
      giftCoins: gift && Number.isSafeInteger(gift.diamonds) && gift.diamonds >= 0 ? gift.diamonds : null,
      giftImageUrl: gift ? image(gift.image_url, origin) : null, triggerThreshold: invalidThreshold ? null : positive(threshold) }
  })
  const data = { schemaVersion: 1 as const, functions }
  return { schemaVersion: data.schemaVersion, revision: createHash("sha256").update(JSON.stringify(data)).digest("hex"), functions }
}
