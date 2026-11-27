import {getThbToUsdRate} from '@/lib/paypal'
import ConfirmMembership from './ConfirmMembership'
export const dynamic='force-dynamic'
export const metadata={title:'ยืนยันบัญชี · Tikkies',robots:{index:false,follow:false},referrer:'strict-origin' as const}
export default async function ConfirmPage({params}:{params:Promise<{locale:string}>}){
 const {locale}=await params
 return <ConfirmMembership locale={locale} usdRate={await getThbToUsdRate()}/>
}
