"use client"
import { variantLabel } from "@/lib/i18n/locale"

// หน้าสินค้าของเกมพาร์ทเนอร์แบบขายในเว็บเรา (Maki) — โครงเดียวกับหน้าสินค้าเรา
// เฟส 1: แสดงข้อมูล/ราคา ปุ่มซื้อยังปิดอยู่ (รอ Stripe ของ Maki พร้อม) · ไม่มีรีวิว/รายการโปรด (ยังไม่ผูก products)
import { useState } from "react"
import { useLocale, useTranslations } from "next-intl"
import { Link } from "@/i18n/routing"
import { getImageUrl } from "@/lib/getImageUrl"
import ImageCarousel from "@/components/products/ImageCarousel"

export type PartnerPlan = { key: string; plan: "1m" | "perma"; label_th: string; label_en: string; duration_days: number; is_lifetime: boolean; sell_price_thb: number | null; available: boolean; has_preset: boolean }
export type PartnerProductData = {
  slug: string; name_th: string; name_en: string; partner_name: string
  description_th: string | null; description_en: string | null
  images: string[]; plans: PartnerPlan[]
}
type Related = { slug: string; name_th: string; name_en: string; image: string | null; min_price: number }

const hlSvg = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const }
const HIGHLIGHTS: { key: string; icon: React.ReactNode }[] = [
  { key: "auto_update", icon: <svg {...hlSvg}><polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" /></svg> },
  { key: "new_content", icon: <svg {...hlSvg}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg> },
  { key: "presets", icon: <svg {...hlSvg}><rect x="2" y="3" width="20" height="14" rx="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" /></svg> },
  { key: "tikfinity", icon: <svg {...hlSvg}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg> },
]

export default function PartnerProductClient({ product, related, usdRate }: { product: PartnerProductData; related: Related[]; usdRate: number | null }) {
  const t = useTranslations("ProductPage")
  const tc = useTranslations("Common")
  const locale = useLocale()
  const isTH = locale === "th"
  const name = isTH ? product.name_th : product.name_en
  const desc = isTH ? (product.description_th || product.description_en) : (product.description_en || product.description_th)
  const images = product.images.length ? product.images : ["/placeholder.png"]
  const [imgIdx, setImgIdx] = useState(0)
  const sellable = product.plans.filter((p) => p.available)
  const [pkgKey, setPkgKey] = useState<string | null>(sellable.length ? sellable[sellable.length - 1].key : null)
  const cur = product.plans.find((p) => p.key === pkgKey) ?? null
  const baht = (n: number) => `฿${n.toLocaleString()}`
  const usd = (n: number) => (usdRate ? ` / $${(n * usdRate).toFixed(2)}` : "")

  return (
    <div className="min-h-screen">
      <div className="page-container pt-5">
        <nav className="flex items-center gap-2 text-[0.72rem] text-text-dim mb-5">
          <Link href="/products" className="hover:text-text-base">{t("breadcrumb_shop")}</Link>
          <span>›</span>
          <span className="text-accent-light">{tc("partner")}</span>
          <span>›</span>
          <span className="text-text-muted truncate">{name}</span>
        </nav>
      </div>

      <div className="page-container">
        <div className="grid grid-cols-1 lg:grid-cols-[1.15fr_1fr] gap-8 lg:gap-12 mb-12 items-start">
          {/* แกลเลอรี */}
          <div className="flex flex-col gap-3">
            <ImageCarousel images={images.map((u) => getImageUrl(u))} alt={name} index={imgIdx} onChange={setImgIdx}>
              <span className="absolute top-3.5 left-3.5 px-3 py-1 bg-violet-500 text-white rounded-lg text-[0.65rem] font-bold uppercase tracking-[0.05em] z-10">{tc("partner")} · {product.partner_name}</span>
            </ImageCarousel>
            {images.length > 1 && (
              <div className="grid grid-cols-6 gap-2">
                {images.slice(0, 12).map((u, i) => (
                  <button key={i} onClick={() => setImgIdx(i)}
                    className={`h-[60px] rounded-lg border-2 overflow-hidden transition-colors ${i === imgIdx ? "border-accent-light" : "border-border-soft hover:border-accent-light/60"}`}>
                    <img src={getImageUrl(u)} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ข้อมูล */}
          <div>
            <h1 className="text-[1.6rem] sm:text-[2rem] font-black tracking-[-0.02em] leading-tight mb-3">{name}</h1>
            <div className="flex flex-wrap gap-2 mb-4">
              <span className="px-3 py-1 rounded-lg text-[0.72rem] font-bold bg-violet-500/15 text-violet-300 border border-violet-500/25">{product.partner_name}</span>
              <span className="px-3 py-1 rounded-lg text-[0.72rem] font-bold bg-accent/10 text-accent-light border border-accent/20">{t("partner_by", { name: product.partner_name })}</span>
            </div>

            <ul className="list-none flex flex-col gap-3 mb-7">
              {HIGHLIGHTS.map(({ key, icon }) => (
                <li key={key} className="flex items-start gap-3 text-sm text-text-muted leading-relaxed">
                  <span className="text-accent-light mt-0.5 shrink-0">{icon}</span>
                  {t(`highlight_${key}`)}
                </li>
              ))}
            </ul>

            {/* แพ็กเกจ */}
            <h3 className="text-[0.95rem] font-bold mb-3">{t("options")}</h3>
            <div className="grid grid-cols-2 gap-3 mb-4">
              {product.plans.map((p) => (
                <button key={p.key} disabled={!p.available} onClick={() => setPkgKey(p.key)}
                  className={`text-left rounded-xl border p-4 transition ${pkgKey === p.key ? "border-accent bg-accent/[0.08]" : "border-border-soft bg-bg-card hover:border-border-light"} disabled:opacity-50 disabled:cursor-not-allowed`}>
                  <div className="text-[0.82rem] font-bold mb-1">{variantLabel(p, locale)}</div>
                  {p.available ? (
                    <div className="text-[1.15rem] font-extrabold text-accent-lighter">{baht(p.sell_price_thb as number)}<span className="text-[0.68rem] text-text-dim font-medium">{usd(p.sell_price_thb as number)}</span></div>
                  ) : (
                    <div className="text-[0.75rem] text-text-dim">{t("plan_unavailable")}</div>
                  )}
                </button>
              ))}
            </div>

            <button disabled className="w-full py-4 rounded-xl text-white text-base font-bold flex items-center justify-center gap-2 bg-accent opacity-60 cursor-not-allowed">
              {t("partner_buy_soon")}{cur?.sell_price_thb != null ? ` · ${baht(cur.sell_price_thb)}` : ""}
            </button>
            <p className="text-[0.75rem] text-text-dim leading-relaxed mt-3">{t("partner_delivery_note")}</p>
            {product.plans.some((p) => p.has_preset) && <p className="text-[0.75rem] text-text-dim mt-1">✦ {t("partner_preset_note")}</p>}
          </div>
        </div>

        {/* รายละเอียด + สินค้าอื่น */}
        <div className="grid grid-cols-1 md:grid-cols-[1fr_320px] gap-9 pb-12">
          <div className="min-w-0">
            <h3 className="text-lg font-extrabold mb-4">{t("description_title")}</h3>
            {desc ? (
              <div className="prose-product max-w-none text-[0.88rem] text-text-muted leading-[1.85] whitespace-pre-line [&_img]:rounded-xl [&_a]:text-accent-light [&_h1]:text-text-base [&_h2]:text-text-base [&_h3]:text-text-base [&_strong]:text-text-base"
                   dangerouslySetInnerHTML={{ __html: desc }} />
            ) : <p className="text-[0.88rem] text-text-dim">—</p>}
          </div>
          {related.length > 0 && (
            <aside>
              <h3 className="text-base font-extrabold mb-3.5">{t("related_title")}</h3>
              <div className="flex flex-col gap-2.5">
                {related.map((r) => (
                  <Link key={r.slug} href={`/products/${r.slug}`}
                    className="flex gap-3 p-3 bg-bg-card border border-border-soft rounded-xl hover:border-accent/30 hover:-translate-y-0.5 transition-all">
                    <div className="w-[72px] h-[72px] rounded-lg overflow-hidden shrink-0" style={{ background: "var(--gradient-thumb)" }}>
                      <img src={getImageUrl(r.image || "/placeholder.png")} alt="" className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 flex flex-col justify-center min-w-0">
                      <h4 className="text-[0.82rem] font-bold mb-0.5 truncate">{isTH ? r.name_th : r.name_en}</h4>
                      <div className="text-[0.68rem] text-text-dim mb-1">{t("from")}</div>
                      <div className="text-sm font-extrabold text-accent-lighter">{baht(r.min_price)}</div>
                    </div>
                  </Link>
                ))}
              </div>
            </aside>
          )}
        </div>
      </div>
    </div>
  )
}
