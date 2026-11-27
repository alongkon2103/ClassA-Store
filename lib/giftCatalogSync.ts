import { createHash } from "node:crypto"
import { functionAlias, inferLegacyCategory, normalizedFunctionName } from "./productFunctions"

export type CanonicalGift = { id: number; name: string; coins: number; image: string; aliases?: string[] }
export type StoredGift = { id: number; name: string; diamonds: number; image_url: string | null; trigger_type: string | null; is_active: boolean; sort_order: number }
const giftTrigger = (gift: StoredGift) => !gift.trigger_type || gift.trigger_type.toLowerCase() === "gift"
export function planGiftSync(canonical: CanonicalGift[], existing: StoredGift[], overrides: Record<string, number> = {}) {
  if (!Array.isArray(canonical) || !canonical.length || canonical.length > 10000) throw Error("invalid_canonical_catalog")
  const byId = new Map<number, CanonicalGift>(), byName = new Map<string, CanonicalGift[]>()
  for (const gift of canonical) {
    if (!Number.isInteger(gift.id) || gift.id < 1 || gift.id > 2147483647 || typeof gift.name !== "string" || !gift.name.trim() || gift.name.length > 200 || !Number.isSafeInteger(gift.coins) || gift.coins < 0 || gift.coins > 2147483647) throw Error("invalid_canonical_gift")
    const url = new URL(gift.image)
    if (url.protocol !== "https:" || url.username || url.password || gift.image.length > 2048) throw Error("invalid_canonical_image")
    if (byId.has(gift.id)) throw Error("duplicate_canonical_id")
    byId.set(gift.id, gift)
    for (const name of new Set([gift.name, ...(gift.aliases || [])].map(normalizedFunctionName))) {
      byName.set(name, [...(byName.get(name) || []), gift])
    }
  }
  const blockers: { code: string; id: number; name: string }[] = [], unresolved: { id: number; name: string; candidates: number[] }[] = []
  const referenceRemaps: { oldId: number; newId: number; name: string }[] = [], deactivateIds: number[] = []
  const stored = new Map(existing.map(gift => [gift.id, gift]))
  for (const key of Object.keys(overrides)) if (!Number.isInteger(Number(key)) || !stored.has(Number(key)) || !byId.has(overrides[key])) throw Error("invalid_gift_override")
  for (const gift of existing) {
    if (!giftTrigger(gift)) {
      if (byId.has(gift.id)) blockers.push({ code: "custom_trigger_id_collision", id: gift.id, name: gift.name })
      continue
    }
    const candidates = byName.get(normalizedFunctionName(gift.name)) || []
    let target = overrides[String(gift.id)]
    if (target === undefined) {
      if (candidates.some(candidate => candidate.id === gift.id)) target = gift.id
      else if (candidates.length === 1) target = candidates[0].id
      else if (candidates.length > 1) {
        unresolved.push({ id: gift.id, name: gift.name, candidates: candidates.map(candidate => candidate.id) })
        if (byId.has(gift.id)) blockers.push({ code: "ambiguous_canonical_id_collision", id: gift.id, name: gift.name })
        continue
      } else if (byId.has(gift.id)) target = gift.id
      else { unresolved.push({ id: gift.id, name: gift.name, candidates: [] }); continue }
    }
    if (target !== gift.id) {
      referenceRemaps.push({ oldId: gift.id, newId: target, name: gift.name })
      if (!byId.has(gift.id) && gift.is_active) deactivateIds.push(gift.id)
    }
  }
  let nextSort = Math.max(-1, ...existing.map(gift => gift.sort_order)) + 1
  const giftUpserts = canonical.flatMap(gift => {
    const old = stored.get(gift.id)
    if (old && !giftTrigger(old)) return []
    const next = { id: gift.id, name: gift.name, diamonds: gift.coins, image_url: gift.image,
      trigger_type: old?.trigger_type || "Gift", is_active: old?.is_active ?? true, sort_order: old?.sort_order ?? nextSort++ }
    return old && ["name", "diamonds", "image_url", "trigger_type", "is_active", "sort_order"].every(key => old[key as keyof StoredGift] === next[key as keyof StoredGift]) ? [] : [next]
  })
  const names = new Map<string, number[]>()
  canonical.forEach(gift => { const key = normalizedFunctionName(gift.name); names.set(key, [...(names.get(key) || []), gift.id]) })
  return { canonicalCount: canonical.length, existingCount: existing.length, canonicalSha256: createHash("sha256").update(JSON.stringify(canonical)).digest("hex"),
    duplicateNames: [...names.entries()].filter(([, ids]) => ids.length > 1).map(([name, ids]) => ({ name, ids })),
    giftUpserts, referenceRemaps, deactivateIds, unresolved, blockers,
    preservedTriggers: existing.filter(gift => !giftTrigger(gift)).map(gift => ({ id: gift.id, name: gift.name, trigger_type: gift.trigger_type })) }
}

export const PIG_PRODUCT_ID = "f739c2ea-c359-498f-823d-22a9e922dd0a"
export const PIG_DEFAULTS = [
  { key: "removemobs", names: ["mob purge", "removemobs"], giftId: 5655, kind: "help" },
  { key: "giant", names: ["giant"], giftId: 5487, kind: "help" },
  { key: "freeze", names: ["freeze"], giftId: 8913, kind: "help" },
  { key: "shrinkisland", names: ["island shrinks", "shrinkisland"], giftId: 5658, kind: "help" },
  { key: "meteor", names: ["mega herd", "meteor"], giftId: 5566, kind: "help" },
  { key: "addmobs", names: ["mob rain", "addmobs"], giftId: 6064, kind: "troll" },
  { key: "shrink", names: ["shrink"], giftId: 19447, kind: "troll" },
  { key: "babyswarm", names: ["baby swarm", "babyswarm"], giftId: 9947, kind: "troll" },
  { key: "growisland", names: ["island grows", "growisland"], giftId: 5879, kind: "troll" },
  { key: "jailbreak", names: ["jailbreak"], giftId: 5585, kind: "troll" },
  { key: "cage", names: ["caged", "cage"], giftId: 13000, kind: "troll" },
  { key: "spin", names: ["spin", "gacha", "prize spin"], giftId: 7934, kind: "neutral" },
] as const
export type StoredFunction = { id: string; product_id: string; name: string; category: string | null; label_th?: string | null; label_en?: string | null; image_url?: string | null; default_gift_id: number | null; default_trigger_threshold: number | null; sort_order: number }
export function planPigDefaults(functions: StoredFunction[]) {
  const updates = new Map<string, { id: string; name: string; productId: string; data: { category?: string; default_gift_id?: number; default_trigger_threshold?: number } }>()
  for (const row of functions) {
    const inferred = inferLegacyCategory(row)
    if (row.category == null && (inferred !== "neutral" || ["spin", "gacha", "prizespin"].includes(functionAlias(row.name)))) updates.set(row.id, { id: row.id, name: row.name, productId: row.product_id, data: { category: inferred } })
  }
  const target = functions.filter(row => row.product_id === PIG_PRODUCT_ID), blockers: { code: string; key: string }[] = []
  const creates: (StoredFunction & { category: string })[] = [], bindings: { id: string; name: string; key: string; giftId: number; kind: string; threshold: number }[] = []
  for (const seed of PIG_DEFAULTS) {
    let matches: StoredFunction[] = []
    for (const alias of seed.names) {
      matches = target.filter(row => functionAlias(row.name) === functionAlias(alias))
      if (matches.length) break
    }
    if (matches.length > 1) { blockers.push({ code: "ambiguous_seed_function", key: seed.key }); continue }
    let row = matches[0]
    if (!row && seed.key === "spin") {
      const hash = createHash("sha256").update("tikkies-function:" + PIG_PRODUCT_ID + ":spin").digest("hex")
      const id = hash.slice(0, 8) + "-" + hash.slice(8, 12) + "-5" + hash.slice(13, 16) + "-a" + hash.slice(17, 20) + "-" + hash.slice(20, 32)
      row = { id, product_id: PIG_PRODUCT_ID, name: "spin", category: "neutral", label_th: "สุ่มรางวัล", label_en: "Spin", image_url: null,
        default_gift_id: 7934, default_trigger_threshold: 1, sort_order: Math.max(-1, ...target.map(item => item.sort_order)) + 1 }
      creates.push({ ...row, category: "neutral" })
    }
    if (!row) { blockers.push({ code: "missing_seed_function", key: seed.key }); continue }
    bindings.push({ id: row.id, name: row.name, key: seed.key, giftId: seed.giftId, kind: seed.kind, threshold: 1 })
    if (creates.some(item => item.id === row.id)) continue
    const data = { ...(updates.get(row.id)?.data || {}) }
    if (row.category !== seed.kind) data.category = seed.kind
    if (row.default_gift_id !== seed.giftId) data.default_gift_id = seed.giftId
    if (row.default_trigger_threshold !== 1) data.default_trigger_threshold = 1
    if (Object.keys(data).length) updates.set(row.id, { id: row.id, name: row.name, productId: row.product_id, data })
  }
  const counts = new Map<string, { productId: string; total: number; help: number; troll: number; neutral: number; unclassified: number }>()
  for (const row of [...functions, ...creates]) {
    if (!counts.has(row.product_id)) counts.set(row.product_id, { productId: row.product_id, total: 0, help: 0, troll: 0, neutral: 0, unclassified: 0 })
    const count = counts.get(row.product_id)!, category = updates.get(row.id)?.data.category || row.category
    count.total++; count[category === "help" || category === "troll" || category === "neutral" ? category : "unclassified"]++
  }
  return { productId: PIG_PRODUCT_ID, updates: [...updates.values()], creates, bindings, blockers, categoryCounts: [...counts.values()].sort((a, b) => a.productId.localeCompare(b.productId)),
    targetSnapshot: target.map(row => ({ ...row, ...(updates.get(row.id)?.data || {}) })) }
}
