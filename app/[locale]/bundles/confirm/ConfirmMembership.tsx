'use client'
import {formatDisplayMoney} from '@/lib/displayCurrency'
import {useEffect,useRef,useState} from 'react'
import {ArrowRight,Check,LoaderCircle,UserRound,ArrowLeft,ShieldCheck} from 'lucide-react'

type Preview={account:{name:string|null;email:string|null;image:string|null;provider?:'google'|'discord'};offer:{priceTHB:number;days:number|null};nonce:string}
async function loadConfirmation(previous:Promise<Preview>|null):Promise<Preview>{
 const url=new URL(window.location.href),ticket=new URLSearchParams(url.hash.slice(1)).get('ticket')
 window.history.replaceState(null,'',url.pathname+url.search)
 if(url.searchParams.has('expired'))throw Error('expired')
 if(url.searchParams.has('offer_changed'))throw Error('offer_changed')
 if(url.searchParams.has('identity_conflict'))throw Error('identity_conflict')
 if(url.searchParams.has('identity_verification_required'))throw Error('identity_verification_required')
 // Serialize same-tab links so an older response cannot overwrite the latest pending cookie.
 await previous?.catch(()=>{})
 const response=await fetch('/api/tikkies/checkout/browser/start',ticket?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ticket}),cache:'no-store'}:{cache:'no-store'})
 const data=await response.json()
 if(!response.ok)throw Error(['offer_changed','identity_conflict','identity_verification_required'].includes(data.error)?data.error:'expired')
 if(!data.account||typeof data.nonce!=='string'||!data.offer)throw Error('expired')
 return data
}
export default function ConfirmMembership({locale,usdRate}:{locale:string;usdRate?:number}){
 const th=locale==='th',request=useRef<Promise<Preview>|null>(null),submitted=useRef(false)
 const [preview,setPreview]=useState<Preview|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false)
 useEffect(()=>{
  let active=true
  const load=()=>{
   if(!request.current||window.location.hash){request.current=loadConfirmation(request.current);setPreview(null);setError('');setBusy(false);submitted.current=false}
   const current=request.current
   current.then(value=>{if(active&&current===request.current)setPreview(value)}).catch(e=>{if(active&&current===request.current)setError(['offer_changed','identity_conflict','identity_verification_required'].includes(e.message)?e.message:'expired')})
  }
  load();window.addEventListener('hashchange',load)
  return()=>{active=false;window.removeEventListener('hashchange',load)}
 },[])
 const beforeSubmit=(event:React.FormEvent)=>{if(submitted.current){event.preventDefault();return}submitted.current=true;setBusy(true)}
 const avatar=preview?.account.image?.startsWith('https://')?preview.account.image:null
 const title=error?(th?'เปิดหน้าสมัครสมาชิกอีกครั้ง':'Reopen membership checkout'):(th?'ใช้บัญชีนี้ดำเนินการต่อใช่ไหม?':'Continue with this account?')
 const providerName=preview?.account.provider==='google'?'Google':preview?.account.provider==='discord'?'Discord':null
 return <main className="min-h-screen bg-bg-base px-5 py-12 text-text-base sm:py-20">
  <div className="mx-auto max-w-lg">
   <a href={th?'/th':'/en'} className="inline-flex items-center gap-2 text-sm font-semibold text-text-muted"><span className="text-accent">ClassA-Store</span><span aria-hidden="true">/</span>Tikkies</a>
   <section className="mt-6 overflow-hidden rounded-3xl border border-border-soft bg-bg-card shadow-xl" aria-labelledby="confirmation-title" aria-busy={!preview&&!error}>
    <div className="p-6 sm:p-8">
     <div className="mb-5 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-accent/10 text-accent"><ShieldCheck size={22} aria-hidden="true"/></div>
     <h1 id="confirmation-title" className="text-xl font-semibold leading-snug sm:text-2xl">{title}</h1>
     {!preview&&!error&&<div role="status" className="mt-8 flex items-center gap-3 py-5 text-sm text-text-muted"><LoaderCircle size={19} className="animate-spin"/>{th?'กำลังตรวจสอบบัญชี…':'Checking your account…'}</div>}
     {error&&<>
      <p role="alert" className="mt-4 text-sm leading-relaxed text-text-muted">{error==='identity_verification_required'?(th?'กรุณาเข้าสู่ระบบ Tikkies อีกครั้งเพื่อยืนยันและเชื่อมบัญชีกับร้าน':'Sign in to Tikkies again to verify and connect your store account.'):error==='identity_conflict'?(th?'บัญชีล็อกอินนี้ผูกกับบัญชีร้านอื่นอยู่ กรุณาใช้บัญชีเดิมหรือติดต่อผู้ดูแล':'This sign-in belongs to a different store account. Use the original account or contact support.'):error==='offer_changed'?(th?'รายละเอียดสมาชิกเปลี่ยนแล้ว กลับไปตรวจสอบแพ็กเกจใน Tikkies อีกครั้ง':'This offer has changed. Check the updated membership in Tikkies.'):(th?'ลิงก์นี้หมดอายุหรือใช้ไปแล้ว กลับไปกดซื้อใน Tikkies อีกครั้ง':'This link has expired or was already used. Start again from Tikkies.')}</p>
      <a href={th?'/th/bundles':'/en/bundles'} className="mt-6 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-accent"><ArrowLeft size={16}/>{th?'ไปหน้าสมาชิกบนเว็บ':'View membership on the website'}</a>
     </>}
     {preview&&<>
      <p className="mt-3 text-sm text-text-muted">{providerName?(th?'เข้าสู่ระบบร้านด้วยบัญชีเดียวกับใน Tikkies':'Sign in to the store with the account you use in Tikkies'):(th?'สมาชิกจะเข้าบัญชีที่แสดงด้านล่าง':'Membership will be added to the account below')}</p>
      <div className="mt-6 flex items-center gap-4 rounded-2xl border border-border-soft bg-bg-base p-4">
       {avatar?<img src={avatar} alt="" referrerPolicy="no-referrer" className="h-12 w-12 shrink-0 rounded-full object-cover"/>:<span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent"><UserRound size={23}/></span>}
       <div className="min-w-0"><p className="break-words font-semibold">{preview.account.name||preview.account.email}</p><p className="mt-1 break-all text-sm text-text-muted">{preview.account.email}</p>{providerName&&<p className="mt-1 text-xs text-text-muted">{th?'เข้าสู่ระบบด้วย ':'Signed in with '}{providerName}</p>}</div>
      </div>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm"><span className="text-text-muted">A Class Games + Tikkies{preview.offer.days?' · '+preview.offer.days+(th?' วัน':' days'):''}</span><span className="font-semibold">{formatDisplayMoney(preview.offer.priceTHB,locale,usdRate)}</span></div>
      <form action="/api/tikkies/checkout/browser/confirm" method="post" onSubmit={beforeSubmit} className="mt-7">
       <input type="hidden" name="nonce" value={preview.nonce}/><input type="hidden" name="locale" value={th?'th':'en'}/><input type="hidden" name="choice" value="continue"/>
       <button disabled={busy} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-on-accent transition hover:brightness-110 disabled:opacity-60">{busy?<LoaderCircle size={18} className="animate-spin"/>:<Check size={18}/>}<span>{busy?(th?'กำลังเปิดหน้าชำระเงิน…':'Opening checkout…'):(th?'ใช้บัญชีนี้และไปชำระเงิน':'Continue with this account')}</span>{!busy&&<ArrowRight size={17}/>}</button>
      </form>
      <form action="/api/tikkies/checkout/browser/confirm" method="post" onSubmit={beforeSubmit} className="mt-2">
       <input type="hidden" name="nonce" value={preview.nonce}/><input type="hidden" name="locale" value={th?'th':'en'}/><input type="hidden" name="choice" value="other"/>
       <button disabled={busy} className="min-h-11 w-full rounded-xl px-4 py-2 text-sm text-text-muted transition hover:bg-bg-base hover:text-text-base disabled:opacity-60">{th?'ใช้บัญชีอื่น':'Use another account'}</button>
      </form>
     </>}
    </div>
    <div className="border-t border-border-soft px-6 py-4 text-center text-xs leading-relaxed text-text-muted sm:px-8">{th?'ขั้นตอนนี้ยังไม่มีการเรียกเก็บเงิน':'You will not be charged at this step'}</div>
   </section>
  </div>
 </main>
}
