import type { StoreBundle } from './bundleCatalog'

export const REVIEW_GAME_SLUGS = ['ac-slash','ac-universe','ac-jump-evo','ac-anime-runner1-1','ac-magnet','ac-fame'] as const
type ReviewGame = { id:string; slug:string; name_th:string; name_en:string; type:string; is_active:boolean|null; is_consignment:boolean|null; product_images:{url:string}[] }

/** A read-only merchandising preview; these IDs never refer to purchasable products. */
export function buildAdminBundleReview(rows:ReviewGame[]):StoreBundle[] {
  const eligible = new Map(rows.filter(row => row.is_active === true && !row.is_consignment && ['roblox_whitelist','desktop_program'].includes(row.type)).map(row => [row.slug,row]))
  if (REVIEW_GAME_SLUGS.some(slug => !eligible.has(slug))) return []
  const games = REVIEW_GAME_SLUGS.map(slug => {
    const row = eligible.get(slug)!
    return { id:row.id,slug:row.slug,name_th:row.name_th,name_en:row.name_en,type:row.type as 'roblox_whitelist'|'desktop_program',cover:row.product_images[0]?.url??null }
  })
  return [{
    id:'admin-preview-ac-membership',slug:'admin-preview-ac-membership',type:'bundle',name_th:'สมาชิก A Class Games',name_en:'A Class Games membership',
    description_th:'สมาชิกเกมรายเดือน ครบทั้ง 6 เกม',description_en:'Monthly access to all six games',product_images:[],
    product_variants:[{id:'admin-preview-monthly-669',label_th:'รายเดือน · 30 วัน',label_en:'Monthly · 30 days',price:669,duration_type:'days',duration_days:30,is_active:true,variant_type:'normal',sort_order:0,discount_pct:0,discount_used:0,discount_limit:0,premium_addon_price:0}],
    games,bundle_games:games,bundle_requires_roblox:games.some(game=>game.type==='roblox_whitelist'),has_limited_discount:false,bundle_includes_tikkies:true,bundle_preview:true,
  }]
}
