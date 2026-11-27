"use client"

import { useEffect, useRef, useState } from 'react'
import { X, Check } from 'lucide-react'
import BundleStorefrontView from './BundleStorefrontView'
import { bundlePackagePrice, type BundlePackage, type StoreBundle } from '@/lib/bundleCatalog'

function ReviewSummary({bundle,variant,locale,onClose}:{bundle:StoreBundle;variant:BundlePackage;locale:string;onClose:()=>void}) {
  const dialog=useRef<HTMLDialogElement>(null)
  const th=locale==='th'
  useEffect(()=>{
    const element=dialog.current
    if(!element)return
    const previous=document.activeElement as HTMLElement|null
    const overflow=document.body.style.overflow
    document.body.style.overflow='hidden'
    element.showModal()
    element.querySelector<HTMLElement>('h2')?.focus({preventScroll:true})
    return()=>{element.close();document.body.style.overflow=overflow;previous?.focus()}
  },[])
  return <dialog ref={dialog} aria-labelledby="bundle-review-summary" aria-describedby="bundle-review-note" onCancel={event=>{event.preventDefault();onClose()}}
    onKeyDown={event=>{
      if(event.key!=='Tab')return
      const controls=Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not([disabled]),input:not([disabled]),[tabindex]:not([tabindex="-1"])')).filter(element=>element.tabIndex>=0&&element.getClientRects().length>0)
      const first=controls[0],last=controls[controls.length-1]
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus()}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus()}
    }}
    onClick={event=>{if(event.target!==event.currentTarget)return;const box=event.currentTarget.getBoundingClientRect();if(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom)onClose()}}
    className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-xl overflow-y-auto rounded-2xl border border-border-soft bg-bg-card p-0 text-text-base shadow-xl backdrop:bg-black/70" data-testid="bundle-review-dialog">
    <div className="space-y-5 p-5 sm:p-7">
      <div className="flex items-start justify-between gap-4"><div><h2 id="bundle-review-summary" tabIndex={-1} className="text-xl font-semibold outline-none">{th?'ยืนยันการสมัครสมาชิก':'Confirm membership'}</h2><p className="mt-2 text-sm text-text-muted">{th?'สมาชิก A Class Games':'A Class Games membership'}</p></div><button type="button" onClick={onClose} aria-label={th?'ปิดตัวอย่าง':'Close preview'} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border-soft hover:bg-bg-base"><X size={18}/></button></div>
      <p id="bundle-review-note" className="rounded-lg border border-accent/20 bg-accent/5 p-3 text-sm leading-relaxed text-text-muted">{th?'ตัวอย่างสำหรับทีมแอดมิน ยังไม่เปิดรับสมัครและไม่มีการเรียกเก็บเงิน':'Admin review only. Membership sales and payment are not enabled.'}</p>
      <ul className="space-y-3">{bundle.games.map(game=><li key={game.id} className="flex items-center gap-3 text-sm"><Check size={16} className="shrink-0 text-accent-light" aria-hidden="true"/>{th?game.name_th||game.name_en:game.name_en||game.name_th}</li>)}</ul>
      <p className="text-sm text-text-muted">{th?'ใช้งานได้ครบทุกฟังก์ชัน ตลอดระยะเวลาสมาชิก':'Full feature access for the membership period'}</p>
      {bundle.bundle_requires_roblox&&<label className="block text-sm font-medium">{th?'ชื่อผู้เล่น Roblox (ตัวอย่าง)':'Roblox username (preview)'}<input type="text" autoComplete="off" maxLength={20} placeholder="Roblox username" className="mt-2 min-h-11 w-full rounded-lg border border-border-soft bg-bg-input px-3 text-sm outline-none focus:border-accent"/></label>}
      <div className="flex flex-wrap items-baseline justify-between gap-3 border-t border-border-soft pt-4"><span className="text-sm text-text-muted">{variant.duration_days} {th?'วัน · ไม่ต่ออายุอัตโนมัติ':'days · No automatic renewal'}</span><strong className="text-3xl font-semibold text-accent-light">฿{bundlePackagePrice(bundle,variant).toLocaleString('en-US')}</strong></div>
    </div>
    <footer className="sticky bottom-0 border-t border-border-soft bg-bg-card p-4 sm:px-7"><button type="button" onClick={onClose} className="min-h-11 w-full rounded-lg bg-accent px-5 text-sm font-semibold text-white">{th?'ปิดตัวอย่าง':'Close preview'}</button><p className="mt-2 text-center text-xs text-text-muted">{th?'หน้าตรวจสอบนี้ไม่สร้างรายการสั่งซื้อ':'This review does not create an order'}</p></footer>
  </dialog>
}

export default function BundleReviewStorefront({bundles,locale}:{bundles:StoreBundle[];locale:string}) {
  const [selection,setSelection]=useState<{bundle:StoreBundle;variant:BundlePackage}|null>(null)
  const th=locale==='th'
  return <BundleStorefrontView bundles={bundles} locale={locale} onJoin={(bundle,variant)=>setSelection({bundle,variant})}
    notice={<div className="page-container pt-4"><p role="note" className="rounded-lg border border-accent/20 bg-bg-card px-4 py-3 text-xs leading-relaxed text-text-muted">{th?'สำหรับแอดมินเท่านั้น · ตรวจหน้าแพ็กเกจสมาชิกก่อนเปิดขายจริง':'Admins only · Review the membership page before launch'}</p></div>}>
    {selection&&<ReviewSummary key={selection.variant.id} {...selection} locale={locale} onClose={()=>setSelection(null)}/>}
  </BundleStorefrontView>
}
