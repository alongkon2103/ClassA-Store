/** Public bundle data. Resolve every member before displaying a set for sale. */
export type BundleGame = {
  id: string; slug: string; name_th: string; name_en: string
  type: "roblox_whitelist" | "desktop_program"; cover: string | null
  previewImage?: string | null; previewVideo?: string | null
}
export type BundlePackage = {
  id: string; label_th: string; label_en: string; price: number
  duration_type: string; duration_days: number | null; is_active: true
  variant_type: "normal"; sort_order: number; discount_pct: number
  discount_used: number; discount_limit: number; premium_addon_price: 0
}
export type StoreBundle = {
  id: string; slug: string; type: "bundle"; name_th: string; name_en: string
  description_th: string | null; description_en: string | null
  product_images: { url: string }[]; product_variants: BundlePackage[]
  games: BundleGame[]; bundle_requires_roblox: boolean
  bundle_games: BundleGame[]; has_limited_discount: boolean
  bundle_includes_tikkies: boolean
  bundle_all_ac_games?: boolean
  bundle_preview?: boolean
}
type CatalogRow = {
  id: string; slug: string; name_th: string; name_en: string; type: string
  is_active?: boolean | null; is_consignment?: boolean | null
  bundle_product_ids?: string[]; description_th?: string | null
  bundle_includes_tikkies?: boolean | null
  bundle_all_ac_games?: boolean | null
  description_en?: string | null; has_limited_discount?: boolean | null
  product_images?: { url: string }[]
  preview_video_url?: string | null
  product_variants?: {
    id: string; price: unknown; is_active?: boolean | null; variant_type?: string | null
    label_th?: string; label_en?: string; duration_type?: string; duration_days?: number | null
    sort_order?: number | null; discount_pct?: unknown; discount_used?: number | null; discount_limit?: number | null
  }[]
}

/** Match the limited-offer eligibility used by the shared purchase dialog. */
export function bundlePackagePrice(bundle: Pick<StoreBundle, "has_limited_discount">, variant: BundlePackage): number {
  const eligible = bundle.has_limited_discount && variant.discount_pct > 0 && variant.discount_used < variant.discount_limit
  return variant.price - (eligible ? variant.price * variant.discount_pct / 100 : 0)
}

export function buildBundleCatalog(rows: CatalogRow[], members: CatalogRow[]): StoreBundle[] {
  const eligible = new Map(members.filter(game => game.is_active === true && !game.is_consignment && ["roblox_whitelist", "desktop_program"].includes(game.type)).map(game => [game.id, game]))
  return rows.flatMap(row => {
    const ids = row.bundle_all_ac_games === true ? [...eligible.keys()] : row.bundle_product_ids ?? []
    if (row.type !== "bundle" || row.is_active !== true || row.is_consignment || ids.length < 2 || ids.length > (row.bundle_all_ac_games ? 500 : 50) || new Set(ids).size !== ids.length || ids.some(id => id === row.id || !eligible.has(id))) return []
    const variants: BundlePackage[] = (row.product_variants ?? [])
      .filter(variant => variant.is_active === true && (!variant.variant_type || variant.variant_type === "normal") && Number.isFinite(Number(variant.price)) && Number(variant.price) > 0 &&
        (variant.duration_type === "permanent" || (variant.duration_type === "days" && Number.isInteger(variant.duration_days) && variant.duration_days! > 0 && Date.now() + variant.duration_days! * 86400000 < Date.parse("9999-12-31T00:00:00Z"))))
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      .map(variant => ({ id: variant.id, label_th: variant.label_th ?? "", label_en: variant.label_en ?? "", price: Number(variant.price), duration_type: variant.duration_type ?? "days", duration_days: variant.duration_days ?? null, is_active: true, variant_type: "normal", sort_order: variant.sort_order ?? 0, discount_pct: Number(variant.discount_pct ?? 0), discount_used: variant.discount_used ?? 0, discount_limit: variant.discount_limit ?? 0, premium_addon_price: 0 }))
    if (!variants.length) return []
    const games = ids.map(id => {
      const member = eligible.get(id)!
      return { id: member.id, slug: member.slug, name_th: member.name_th, name_en: member.name_en, type: member.type as BundleGame["type"], cover: member.product_images?.[0]?.url ?? null, ...(member.product_images?.[1]?.url ? {previewImage:member.product_images[1].url} : {}), ...(member.preview_video_url ? {previewVideo:member.preview_video_url} : {}) }
    })
    return [{ id: row.id, slug: row.slug, type: "bundle", name_th: row.name_th, name_en: row.name_en, description_th: row.description_th ?? null, description_en: row.description_en ?? null, product_images: row.product_images ?? [], product_variants: variants, games, bundle_games: games, bundle_requires_roblox: row.bundle_all_ac_games === true || games.some(game => game.type === "roblox_whitelist"), has_limited_discount: row.has_limited_discount === true, bundle_includes_tikkies: row.bundle_includes_tikkies === true, ...(row.bundle_all_ac_games ? {bundle_all_ac_games:true} : {}) }]
  })
}
