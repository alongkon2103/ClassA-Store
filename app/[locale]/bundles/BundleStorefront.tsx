"use client"
import {useRouter} from '@/i18n/routing'
import BundleStorefrontView from '@/components/bundles/BundleStorefrontView'
import type {StoreBundle} from '@/lib/bundleCatalog'
export default function BundleStorefront({bundles,locale,usdRate}:{bundles:StoreBundle[];locale:string;usdRate?:number}){
 const router=useRouter()
 return <BundleStorefrontView bundles={bundles} locale={locale} usdRate={usdRate} onJoin={()=>router.push('/bundles/checkout?from=store')}/>
}
