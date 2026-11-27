'use client'
import {formatDisplayMoney} from '@/lib/displayCurrency'
import {useSession} from 'next-auth/react'
import {ChevronRight,ShieldCheck,UserRound,ArrowLeft} from 'lucide-react'
import Navbar from '@/components/Navbar'
import {Link} from '@/i18n/routing'
import ProductModal from '@/components/products/ProductModal'
import {bundlePackagePrice,type StoreBundle} from '@/lib/bundleCatalog'
import {getImageUrl} from '@/lib/getImageUrl'
import {variantLabel} from '@/lib/i18n/locale'
import styles from '@/components/bundles/MembershipCheckout.module.css'

/** Website checkout reuses the existing provider form, without an overlay or portal. */
export default function BundleCheckout({bundle,locale,usdRate}:{bundle:StoreBundle|null;locale:string;usdRate?:number}){
 const th=locale==='th',{data:session}=useSession(),variant=bundle?.product_variants[0]
 const canBrowseMembership=session?.user?.provider!=='tikkies-checkout'
 const name=th?bundle?.name_th||bundle?.name_en:bundle?.name_en||bundle?.name_th
 return <div className={styles.page}>
  <Navbar/>
  <main className={styles.main} data-testid="membership-checkout-page">
   <nav className={styles.breadcrumb} aria-label={th?'เส้นทางหน้า':'Breadcrumb'}><Link href="/">ClassA-Store</Link><ChevronRight size={14}/>{canBrowseMembership?<Link href="/bundles">{th?'สมาชิก':'Membership'}</Link>:<span>{th?'สมาชิก':'Membership'}</span>}<ChevronRight size={14}/><span aria-current="page">{th?'ชำระเงิน':'Checkout'}</span></nav>
   <header className={styles.heading}><h1>{th?'สมัครสมาชิก A Class Games':'A Class Games membership'}</h1><p>{th?'ตรวจสอบรายละเอียดและเลือกช่องทางชำระเงิน':'Review your membership and choose a payment method'}</p></header>
   {bundle&&variant?<div className={styles.layout}>
    <div className={styles.overview}>
     <section className={styles.plan} aria-labelledby="selected-membership">
      <div className={styles.planTop}>{bundle.product_images[0]&&<img className={styles.planCover} src={getImageUrl(bundle.product_images[0].url)} alt=""/>}<div><p className={styles.eyebrow}>{th?'แพ็กเกจที่เลือก':'Your membership'}</p><h2 id="selected-membership">{name}</h2><p className={styles.period}>{variantLabel(variant,locale)}</p></div></div>
      <div className={styles.price}><strong>{formatDisplayMoney(bundlePackagePrice(bundle,variant),locale,usdRate)}</strong><span>{th?'ก่อนค่าธรรมเนียม':'USD estimate before payment fees'}</span></div>
      {bundle.bundle_includes_tikkies&&<div className={styles.feature}><ShieldCheck size={20}/><span>{th?'รวมสมาชิก Tikkies ครบทุกฟังก์ชัน':'Full Tikkies membership included'}</span></div>}
     </section>

    </div>
    <section className={styles.formColumn} aria-labelledby="membership-payment-title"><div className={styles.formHeader}><h2 id="membership-payment-title">{th?'ข้อมูลสมัครสมาชิก':'Membership details'}</h2>{session?.user&&<div className={styles.account}>{session.user.image?<img src={session.user.image} alt="" referrerPolicy="no-referrer"/>:<span className={styles.accountIcon}><UserRound size={20}/></span>}<div className={styles.accountText}><strong>{session.user.name||session.user.email}</strong><span>{session.user.email}</span></div></div>}</div><ProductModal key={[bundle.id,variant.id,bundlePackagePrice(bundle,variant),variant.duration_type,variant.duration_days].join(':')} product={bundle} presentation="membership-page" initialUsdRate={usdRate} initialVariantId={variant.id} onClose={()=>{}}/></section>
    <section className={styles.games} aria-labelledby="membership-games-title"><div className={styles.sectionHeading}><h2 id="membership-games-title">{th?'เกมในสมาชิก':'Included games'}</h2><span>{bundle.games.length} {th?'เกม':'games'}</span></div><ul className={styles.gameGrid}>{bundle.games.map(game=><li key={game.id} className={styles.game} data-testid="checkout-game">{game.cover&&<img src={getImageUrl(game.cover)} alt="" loading="lazy"/>}<strong>{th?game.name_th||game.name_en:game.name_en||game.name_th}</strong></li>)}</ul><p className={styles.accessNote}>{bundle.bundle_requires_roblox?(th?'ใช้ชื่อ Roblox เดียวกันสำหรับทุกเกมในชุด สิทธิ์ Tikkies ผูกกับบัญชีที่ใช้ซื้อ':'One Roblox username applies to all included games. Tikkies access belongs to the purchasing account.'):(th?'สิทธิ์เกมและ Tikkies ผูกกับบัญชีที่ใช้ซื้อ':'Game and Tikkies access belong to the purchasing account.')}</p></section>
   </div>:<div className={styles.unavailable}><p>{canBrowseMembership?(th?'แพ็กเกจนี้เปลี่ยนแปลงหรือยังไม่พร้อมให้ซื้อ กรุณาตรวจสอบแพ็กเกจอีกครั้ง':'This offer changed or is unavailable. Please check the current membership.'):(th?'รายละเอียดแพ็กเกจเปลี่ยนแล้ว กรุณากลับไปกดซื้อใหม่ใน Tikkies':'This offer has changed. Reopen membership checkout from Tikkies.')}</p><Link href={canBrowseMembership?'/bundles':'/'}><ArrowLeft size={16}/>{canBrowseMembership?(th?'ดูแพ็กเกจสมาชิก':'View memberships'):(th?'กลับหน้าเว็บไซต์':'Back to the website')}</Link></div>}
  </main>
  <footer className={styles.footer}><span>A Class Games + Tikkies</span><nav><Link href="/rules">{th?'เงื่อนไขการใช้งาน':'Terms'}</Link><Link href="/privacy">{th?'ความเป็นส่วนตัว':'Privacy'}</Link><Link href="/contact">{th?'ติดต่อเรา':'Contact'}</Link></nav></footer>
 </div>
}
