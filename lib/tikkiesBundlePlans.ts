import {buildBundleCatalog,bundlePackagePrice} from './bundleCatalog'

/** One current membership offer, using precisely the storefront's first variant. */
export function tikkiesBundlePlans(rows:Parameters<typeof buildBundleCatalog>[0]){
 return buildBundleCatalog(rows.filter(row=>row.slug==='ac-games-membership'),rows)
  .filter(bundle=>bundle.bundle_includes_tikkies && !bundle.bundle_preview)
  .slice(0,1).map(bundle=>{
   const variant=bundle.product_variants[0]
   return {type:'bundle' as const,code:`bundle:${bundle.id}:${variant.id}`,name_th:bundle.name_th,name_en:bundle.name_en,
    days:variant.duration_type==='permanent'?null:variant.duration_days,priceTHB:bundlePackagePrice(bundle,variant),
    includesTikkies:true,allAcGames:bundle.bundle_all_ac_games===true,
    games:bundle.games.map(game=>({id:game.id,name_th:game.name_th,name_en:game.name_en,cover:game.cover}))}
  })
}
