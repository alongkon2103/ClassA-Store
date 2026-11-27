import {getThbToUsdRate} from '@/lib/paypal'
import {setRequestLocale} from 'next-intl/server'
import {prisma} from '@/lib/prisma'
import {buildBundleCatalog} from '@/lib/bundleCatalog'
import {requireBundleBuyerSession} from '@/lib/bundleReviewAccess'
import BundleCheckout from './BundleCheckout'
import {bundlePackagePrice} from '@/lib/bundleCatalog'
import {assertBundleQuote} from '@/lib/bundleBuyer'
import {checkoutQuote} from '@/lib/tikkiesCheckoutQuote'

export const dynamic='force-dynamic'
export const metadata={title:'A Class Games + Tikkies',robots:{index:false,follow:false}}
export default async function Checkout({params,searchParams=Promise.resolve({})}:{params:Promise<{locale:string}>;searchParams?:Promise<{from?:string}>}){
 const {locale}=await params,{from}=await searchParams
 const session=await requireBundleBuyerSession(locale)
 setRequestLocale(locale)
 const products=await prisma.products.findMany({
  where:{is_active:true,OR:[{type:'bundle',slug:'ac-games-membership'},{type:{in:['roblox_whitelist','desktop_program']}}],AND:[{OR:[{is_consignment:false},{is_consignment:null}]}]},
  include:{product_images:{orderBy:{sort_order:'asc'}},product_variants:{where:{is_active:true},orderBy:{sort_order:'asc'}}},
  orderBy:[{display_order:'asc'},{created_at:'desc'}],take:502,
 })
 let bundle=products.length>501?null:buildBundleCatalog(products.filter(p=>p.slug==='ac-games-membership'),products).find(p=>p.bundle_includes_tikkies)??null
 if(bundle&&(session.user.provider==='tikkies-checkout'||session.user.checkoutOffer&&from!=='store')) {
  const variant=bundle.product_variants.find(v=>session.user.checkoutOffer?.code===`bundle:${bundle!.id}:${v.id}`)
  try {
   if(!variant)throw Error('offer_changed')
   const quote=checkoutQuote(session.user.checkoutOffer),days=variant.duration_type==='permanent'?null:variant.duration_days
   if(quote.days!==days||Math.round(quote.priceTHB*100)!==Math.round(bundlePackagePrice(bundle,variant)*100))throw Error('offer_changed')
   assertBundleQuote(session.user,bundle.id,variant.id,variant.duration_type==='permanent'?null:variant.duration_days,bundlePackagePrice(bundle,variant))
   bundle={...bundle,product_variants:[variant]}
  }catch{bundle=null}
 }
 return <BundleCheckout bundle={bundle} locale={locale} usdRate={await getThbToUsdRate()}/>
}
