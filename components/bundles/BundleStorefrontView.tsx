"use client"
import {formatDisplayMoney} from "@/lib/displayCurrency"

import { useState, type ReactNode } from "react"
import { ArrowDown, ArrowRight, Check, ChevronDown, Download, Gamepad2, Layers3, Package, Play, ShieldCheck, Users, X } from "lucide-react"
import { Link } from "@/i18n/routing"
import Navbar from "@/components/Navbar"
import Footer from "@/components/home/Footer"
import HalloweenPage from "@/components/HalloweenPage"
import { bundleCopy } from "@/components/bundles/copy"
import type { BundleGame, BundlePackage, StoreBundle } from "@/lib/bundleCatalog"
import { bundlePackagePrice } from "@/lib/bundleCatalog"
import { getImageUrl } from "@/lib/getImageUrl"
import styles from "@/app/[locale]/bundles/BundleStorefront.module.css"

type Copy = ReturnType<typeof bundleCopy>
const programVersion = "0.9.42"
// Verified public Windows release; /downloads/release currently returns 404.
const programDownload = `https://aclassstore.com/downloads/Tikkies-Tools-Setup-${programVersion}.exe`

const name = (item: { name_th: string; name_en: string }, locale: string) => locale === "th" ? item.name_th || item.name_en : item.name_en || item.name_th

function Cover({ src, alt = "" }: { src?: string | null; alt?: string }) {
  const [failed, setFailed] = useState(false)
  return src && !failed
    ? <img src={getImageUrl(src)} alt={alt} onError={() => setFailed(true)} />
    : <div className={styles.coverFallback} role={alt ? "img" : undefined} aria-label={alt || undefined}><Gamepad2 size={36} strokeWidth={1.5} /></div>
}

function FeatureList({ items }: { items: string[] }) {
  return <ul className="space-y-3.5">{items.map(item => <li key={item} className="flex items-start gap-2.5 text-[0.85rem] leading-relaxed text-text-muted"><Check size={17} className="mt-0.5 shrink-0 text-accent-light" aria-hidden="true" /><span>{item}</span></li>)}</ul>
}

function HeroGameShowcase({games,locale,copy,fullAccess}:{games:BundleGame[];locale:string;copy:Copy;fullAccess:boolean}) {
  const featured = games.find(game=>game.slug==='ac-universe') ?? games[0]
  const [playing,setPlaying] = useState(false)
  const [videoFailed,setVideoFailed] = useState(false)
  if(!featured)return null
  let videoUrl:string|null = null
  try {
    if(featured.previewVideo){
      const parsed=new URL(getImageUrl(featured.previewVideo),'https://aclassstore.com')
      if(parsed.protocol==='https:'&&!parsed.username&&!parsed.password&&/\.(mp4|webm)$/i.test(parsed.pathname))videoUrl=parsed.href
    }
  } catch { /* Invalid media keeps the real product image visible. */ }
  const others=games.filter(game=>game.id!==featured.id)
  return <div className={`${styles.heroScene} ${playing?styles.scenePlaying:''}`} aria-label={copy.gamesTitle} data-testid="hero-game-showcase">
    {others.slice(0,2).map((game,index)=><div key={game.id} className={index===0?styles.sceneCoverLeft:styles.sceneCoverRight} aria-hidden="true"><Cover src={game.cover}/></div>)}
    <div className={styles.previewFrame}>
      <div className={styles.previewTopbar}><Gamepad2 size={16} aria-hidden="true"/><span>{name(featured,locale)}</span></div>
      <div className={styles.previewMedia}>
        {playing&&videoUrl&&!videoFailed?<><video key={videoUrl} src={videoUrl} poster={getImageUrl(featured.previewImage||featured.cover||'')} autoPlay playsInline muted controls onEnded={()=>setPlaying(false)} onError={()=>{setPlaying(false);setVideoFailed(true)}} aria-label={locale==='th'?'คลิปตัวอย่าง '+name(featured,locale):'Game preview: '+name(featured,locale)}/><button type="button" className={styles.previewClose} onClick={()=>setPlaying(false)} aria-label={locale==='th'?'ปิดคลิปตัวอย่าง':'Close game preview'}><X size={16}/></button></>:<>
          <Cover src={featured.previewImage||featured.cover} alt={locale==='th'?'ภาพเกม '+name(featured,locale):name(featured,locale)+' game image'}/>
          {videoUrl&&!videoFailed&&<button type="button" className={styles.previewPlay} onClick={()=>setPlaying(true)} aria-label={locale==='th'?'ดูคลิปตัวอย่าง '+name(featured,locale):'Watch '+name(featured,locale)+' preview'} data-testid="hero-preview-play"><Play size={24} fill="currentColor" aria-hidden="true"/></button>}
          <span className={styles.previewCaption}>{locale==='th'?'ภาพตัวอย่างเกม':'Game preview'}</span>
        </>}
      </div>
    </div>
    <div className={styles.sceneNoteTop}>
      <span className={styles.sceneNoteIcon}><Layers3 size={20} aria-hidden="true"/></span>
      <div><strong>{locale==='th'?games.length+' เกมในสมาชิก':games.length+' games included'}</strong><span>{copy.oneMembership}</span></div>
    </div>
    <div className={styles.sceneNoteBottom}>
      <span className={styles.sceneNoteIcon}><ShieldCheck size={20} aria-hidden="true"/></span>
      <div><strong>{fullAccess?copy.fullFeatures:copy.includedRights}</strong><span>{locale==='th'?'พร้อมสำหรับไลฟ์ของคุณ':'Ready for your next stream'}</span></div>
    </div>
  </div>
}

function MembershipPlan({ bundle, copy, onJoin,locale,usdRate }: { bundle: StoreBundle; copy: Copy;locale:string;usdRate?:number; onJoin: (bundle: StoreBundle, variant: BundlePackage) => void }) {
  const variant = bundle.product_variants[0]
  return <article className="flex min-w-0 flex-col rounded-[14px] border-2 border-accent bg-bg-card p-6 sm:p-8" data-testid="membership-plan">
    <div className="mb-3 flex items-center justify-between gap-3"><h3 className="text-[1.2rem] font-extrabold">{copy.membershipName}</h3><span className="shrink-0 rounded-md bg-accent/10 px-2.5 py-1 text-[0.7rem] font-bold text-accent-light">{copy.monthly}</span></div>
    <p className="text-[0.82rem] leading-relaxed text-text-muted">{copy.memberDescription}</p>
    <div className="mb-6 mt-6 flex flex-wrap items-baseline gap-x-2"><strong className="text-[3rem] font-extrabold leading-none tracking-[-0.03em] text-accent-light tabular-nums" data-testid="membership-price">{formatDisplayMoney(bundlePackagePrice(bundle, variant),locale,usdRate)}</strong><span className="text-[0.85rem] text-text-muted" data-testid="membership-period">/ {variant.duration_days} {copy.days}</span></div>
    <FeatureList items={[copy.memberGames, ...copy.memberFeatures, ...(bundle.bundle_includes_tikkies ? [copy.fullFeatures] : []), copy.renewal]} />
    <div className="mt-auto pt-8"><button type="button" onClick={() => onJoin(bundle, variant)} className="flex w-full items-center justify-center gap-2 rounded-[10px] bg-accent px-5 py-3.5 text-[0.9rem] font-bold text-on-accent transition-colors hover:bg-accent-light active:scale-[.99]" data-testid="membership-subscribe">{copy.subscribe}<ArrowRight size={17} /></button><p className="mt-3 text-center text-[0.65rem] leading-relaxed text-text-dim">{copy.fees}</p></div>
  </article>
}

export default function BundleStorefrontView({ bundles, locale, onJoin, notice, children,usdRate }: { bundles: StoreBundle[]; locale: string;usdRate?:number; onJoin: (bundle: StoreBundle, variant: BundlePackage) => void; notice?: ReactNode; children?: ReactNode }) {
  const copy = bundleCopy(locale)
  const games = Array.from(new Map(bundles.flatMap(bundle => bundle.games).map(game => [game.id, game])).values())
  const startingPrice = bundles.length ? Math.min(...bundles.map(bundle => bundlePackagePrice(bundle, bundle.product_variants[0]))) : null
  const benefits = [
    { Icon: Users, title: copy.oneMembership, text: copy.access },
    { Icon: Layers3, title: copy.samePeriod, text: copy.timed },
    { Icon: ShieldCheck, title: copy.includedRights, text: copy.includedRightsSub },
  ]

  return <HalloweenPage className="min-h-screen flex flex-col bg-bg-base text-text-base">
    <Navbar />
    {notice}
    <main className="flex-1" data-testid="bundle-storefront">
      <div className="page-container pb-12 pt-6">
        <section className={styles.hero}>
          <div className={styles.heroBackdrop} aria-hidden="true">{games.slice(0,6).map(game=><div key={game.id}><Cover src={game.cover}/></div>)}</div>
          <div className={styles.heroCopy}>
            <span className="mb-5 inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/15 px-3.5 py-1 text-[0.7rem] font-bold text-accent-lighter"><Gamepad2 size={14} />{copy.eyebrow}</span>
            <h1 className="text-[2rem] font-black leading-[1.15] tracking-[-0.03em] sm:text-[2.4rem] lg:text-[3.4rem]">{copy.title}<br /><span className="text-accent-lighter">{copy.titleAccent}</span></h1>
            <p className="mb-6 mt-4 max-w-[440px] text-[0.9rem] leading-[1.8] text-text-muted">{copy.intro}</p>
            <div className="flex flex-wrap items-center gap-3">
              <a href="#membership" className="inline-flex items-center justify-center gap-2 rounded-[10px] bg-accent px-6 py-3.5 text-[0.85rem] font-bold text-on-accent transition-colors hover:bg-accent-light">{copy.explore}<ArrowDown size={16} /></a>
              <a href={programDownload} className="inline-flex items-center gap-2 rounded-[10px] border border-border-light px-5 py-3.5 text-[0.85rem] font-semibold transition-colors hover:bg-bg-card" data-testid="program-download"><Download size={16} />{copy.download}</a>
            </div>
            {startingPrice !== null && <p className="mt-4 text-[0.75rem] text-text-muted">{copy.from} <span className="font-bold text-text-base">{formatDisplayMoney(startingPrice,locale,usdRate)}</span><span className="mx-2 text-text-dim">·</span>{copy.heroFoot}</p>}
          </div>
          {games.length > 0 && <HeroGameShowcase games={games} locale={locale} copy={copy} fullAccess={bundles.some(bundle=>bundle.bundle_includes_tikkies)}/>}
        </section>

        <div className="my-6 grid gap-px overflow-hidden rounded-xl border border-border-soft bg-border-soft sm:grid-cols-3">{benefits.map(({ Icon, title, text }) => <div key={title} className="flex items-center gap-3 bg-bg-surface px-5 py-4"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] border border-accent/20 bg-accent/10 text-accent-light"><Icon size={19} /></span><div><p className="text-[0.8rem] font-bold">{title}</p><p className="mt-0.5 text-[0.7rem] text-text-dim">{text}</p></div></div>)}</div>

        {games.length > 0 && <section id="games" className={styles.section}>
          <div className="mb-5"><h2 className="text-[1.25rem] font-extrabold">{copy.gamesTitle}</h2><p className="mt-1 text-[0.82rem] text-text-muted">{copy.gamesIntro}</p></div>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{games.map(game => <Link key={game.id} href={`/products/${game.slug}`} className="group overflow-hidden rounded-[14px] border border-border-soft bg-bg-card transition-colors hover:border-accent/40" data-testid="bundle-game"><div className={styles.gameArtwork}><Cover src={game.cover} alt={name(game, locale)} /></div><div className="p-3.5"><p className="mb-1 text-[0.65rem] font-semibold text-accent-light">{game.type === "desktop_program" ? "PC" : "ROBLOX"}</p><h3 className="truncate text-[0.85rem] font-bold">{name(game, locale)}</h3><span className="mt-3 inline-flex items-center gap-1.5 text-[0.7rem] text-text-muted">{copy.gameDetails}<ArrowRight size={13} /></span></div></Link>)}</div>
        </section>}

        <section id="membership" className={styles.section}>
          <div className="mb-5"><h2 className="text-[1.25rem] font-extrabold">{copy.pricing}</h2><p className="mt-1 text-[0.82rem] text-text-muted">{copy.pricingIntro}</p></div>
          <div className="grid gap-5 md:grid-cols-2">
            <article className="flex min-w-0 flex-col rounded-[14px] border border-border-soft bg-bg-card p-6 sm:p-8" data-testid="free-download-plan">
              <h3 className="mb-3 text-[1.2rem] font-extrabold">{copy.freeTitle}</h3><p className="text-[0.82rem] leading-relaxed text-text-muted">{copy.freeDescription}</p>
              <div className="mb-1 mt-6 flex items-baseline gap-2"><strong className="text-[3rem] font-extrabold leading-none tabular-nums">0</strong><span className="text-[0.85rem] text-text-muted">{copy.baht}</span></div><p className="mb-6 mt-3 text-[0.75rem] text-text-dim">{copy.freePriceNote}</p>
              <FeatureList items={copy.freeFeatures} />
              <p className="mt-4 border-t border-border-soft pt-4 text-[0.72rem] leading-relaxed text-text-dim">{copy.freeFoot}</p>
              <div className="mt-auto pt-8"><a href={programDownload} className="flex w-full items-center justify-center gap-2 rounded-[10px] border border-border-light bg-bg-surface px-5 py-3.5 text-[0.9rem] font-bold transition-colors hover:border-accent hover:text-accent-light" data-testid="program-download"><Download size={17} />{copy.downloadFree}</a><p className="mt-3 text-center text-[0.65rem] text-text-dim">{copy.downloadHint} · v{programVersion}</p></div>
            </article>
            {bundles.length ? bundles.map(bundle => <MembershipPlan key={bundle.id} bundle={bundle} copy={copy} onJoin={onJoin} locale={locale} usdRate={usdRate} />) : <div className="rounded-[14px] border border-border-soft bg-bg-card px-6 py-12 text-center"><Package size={32} className="mx-auto mb-4 text-text-dim" /><h3 className="font-bold">{copy.emptyTitle}</h3><p className="mx-auto mb-5 mt-2 max-w-lg text-sm text-text-muted">{copy.emptyText}</p><Link href="/products" className="text-sm font-semibold text-accent-light">{copy.emptyButton} →</Link></div>}
          </div>
          {bundles.length > 0 && <p className="mt-4 text-[0.75rem] leading-relaxed text-text-muted">{copy.usageNote}</p>}
        </section>

        <section className={styles.section} id="how-it-works"><h2 className="mb-5 text-[1.25rem] font-extrabold">{copy.howTitle}</h2><div className="grid gap-4 md:grid-cols-3">{[[copy.step1, copy.step1Body], [copy.step2, copy.step2Body], [copy.step3, copy.step3Body]].map(([title, body], index) => <div key={title} className="rounded-xl border border-border-soft bg-bg-card p-5"><span className="mb-3 flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10 text-[0.8rem] font-bold text-accent-light">{index + 1}</span><h3 className="mb-2 text-[0.85rem] font-bold">{title}</h3><p className="text-[0.78rem] leading-[1.8] text-text-muted">{body}</p></div>)}</div></section>
        <section className={styles.section}><h2 className="mb-5 text-[1.25rem] font-extrabold">{copy.faqTitle}</h2><div className="overflow-hidden rounded-xl border border-border-soft bg-bg-card">{[[copy.faq1, copy.faq1Body], [copy.faq2, copy.faq2Body], [copy.faq3, copy.faq3Body]].map(([question, answer]) => <details key={question} className={styles.faqItem}><summary className="flex cursor-pointer items-center justify-between gap-4 px-5 py-4 text-[0.85rem] font-semibold">{question}<ChevronDown size={16} className="shrink-0 text-text-dim" /></summary><p className="px-5 pb-5 text-[0.8rem] leading-[1.8] text-text-muted">{answer}</p></details>)}</div></section>
      </div>
    </main>
    <Footer />
    {children}
  </HalloweenPage>
}
