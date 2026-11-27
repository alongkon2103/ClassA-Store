import {getServerSession} from 'next-auth'
import {redirect,notFound} from 'next/navigation'
import {currentBundleBuyerRole} from '@/lib/bundleBuyer'
import {prisma} from '@/lib/prisma'
import {authOptions} from '@/lib/auth'
import {checkoutLoginInput,matchesAccount} from '@/lib/tikkiesCheckoutLogin'

export const dynamic='force-dynamic'
// Keep query parameters private while preserving Origin on the same-origin approval POST.
// Chromium sends Origin: null for a navigation form when this is no-referrer.
export const metadata={title:'Tikkies checkout',robots:{index:false,follow:false},referrer:'strict-origin' as const}
export default async function DesktopLogin({params,searchParams}:{params:Promise<{locale:string}>;searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const {locale}=await params,query=await searchParams
 const search=new URLSearchParams();for(const [key,value] of Object.entries(query))if(typeof value==='string')search.set(key,value)
 let input:ReturnType<typeof checkoutLoginInput>;try{input=checkoutLoginInput(search)}catch{notFound()}
 const prefix=locale==='th'?'/th':'/en'
 const session=await getServerSession(authOptions)
 if(!session?.user)redirect(prefix+'/login?callbackUrl='+encodeURIComponent(prefix+'/bundles/desktop-login?'+search.toString()))
 // Same sale policy as the bundle storefront, not a privilege bypass.
 try{await currentBundleBuyerRole(prisma,session.user)}catch{notFound()}
 const th=locale==='th',matches=matchesAccount(session.user.email,input.account)
 return <main className="min-h-screen bg-bg-base text-text-base grid place-items-center p-6"><section className="w-full max-w-lg rounded-2xl border border-border-soft bg-bg-card p-8">
  <p className="text-sm text-text-muted">ClassA-Store · Tikkies</p>
  <h1 className="mt-4 text-2xl font-semibold">{th?'ยืนยันบัญชีสำหรับซื้อใน Tikkies':'Confirm your account for Tikkies checkout'}</h1>
  <p className="mt-4 break-all">{session.user.email}</p>
  <p className="mt-3 text-sm leading-relaxed text-text-muted">{matches?(th?'ยืนยันแล้วกลับไปเลือกช่องทางและชำระเงินในโปรแกรม ขั้นตอนนี้ยังไม่มีการเรียกเก็บเงิน':'Confirm, then return to the app to choose a payment method. This step does not charge you.'):(th?'บัญชีร้านนี้ใช้อีเมลคนละบัญชีกับ Tikkies กรุณาสลับเป็นบัญชีเดียวกันก่อน':'This store account uses a different email from Tikkies. Switch to the same account first.')}</p>
  {matches&&<form action="/api/tikkies/checkout/authorize" method="post" className="mt-6">
   {Object.entries(input).map(([name,value])=><input key={name} type="hidden" name={name} value={value}/>)}
   <button className="rounded-lg bg-accent px-5 py-3 text-on-accent" type="submit">{th?'ยืนยันและกลับไป Tikkies':'Confirm and return to Tikkies'}</button>
  </form>}
  {!matches&&<a className="mt-6 inline-block rounded-lg bg-accent px-5 py-3 text-on-accent" href={'/api/auth/signout?callbackUrl='+encodeURIComponent(prefix+'/bundles/desktop-login?'+search.toString())}>{th?'เปลี่ยนบัญชีร้าน':'Switch store account'}</a>}
 </section></main>
}
