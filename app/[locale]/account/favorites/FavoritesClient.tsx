"use client"

// หน้า "รายการโปรด" — การ์ดเกมชุดเดียวกับหน้าร้าน + ปุ่มเอาออก
import { useState } from "react"
import { useLocale, useTranslations } from "next-intl"
import { Link } from "@/i18n/routing"
import GameCard from "@/components/GameCard"
import { categoryName, type CategoryLabel } from "@/lib/gameCategories"
import { useAutoDiscounts } from "@/lib/useAutoDiscounts"

export type FavoriteItem = {
  id: string; slug: string; name_th: string; name_en: string
  description_th: string | null; description_en: string | null
  type: string | null; price: number; preview_video_url: string | null; is_featured: boolean
  image: string | null; variants: { price: number; min?: number }[] // min = ขั้นต่ำ Maki (เกม Maki เท่านั้น)
  rating_avg: number | null; rating_count: number
  maki?: boolean // เกมพาร์ทเนอร์ Maki — ราคาขีดฆ่าคิดแบบ Maki (ไม่ต่ำกว่าขั้นต่ำ Maki)
  category?: CategoryLabel | null // หมวดหมู่เกม → ป้ายบนการ์ด
}

function plain(html: string | null | undefined, max = 90) {
  if (!html) return ""
  const t = html.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim()
  return t.length > max ? `${t.slice(0, max).trimEnd()}…` : t
}

export default function FavoritesClient({ items: initial, usdRate }: { items: FavoriteItem[]; usdRate: number | null }) {
  const t = useTranslations("Account")
  const tHome = useTranslations("Home")
  const locale = useLocale()
  const isTH = locale === "th"
  const { bestDiscountedPrice, bestMakiPrice } = useAutoDiscounts()
  const [items, setItems] = useState(initial)
  const [busy, setBusy] = useState<string | null>(null)

  const remove = async (slug: string) => {
    setBusy(slug)
    try {
      const r = await fetch(`/api/favorites/${slug}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ saved: false }),
      })
      if (r.ok) setItems((xs) => xs.filter((x) => x.slug !== slug))
    } finally { setBusy(null) }
  }

  return (
    <div>
      <div className="flex items-end justify-between gap-3 mb-5">
        <h1 className="text-[1.2rem] sm:text-[1.5rem] font-black">{t("fav_title")}</h1>
        <span className="text-[0.82rem] text-text-dim">{t("fav_count", { count: items.length })}</span>
      </div>

      {items.length === 0 ? (
        <div className="bg-bg-card border border-border-soft rounded-[14px] p-10 text-center">
          <p className="text-text-muted text-sm mb-4">{t("fav_empty")}</p>
          <Link href="/products" className="inline-flex px-6 py-2.5 bg-accent hover:bg-accent-light text-white text-[14px] font-bold rounded-xl transition-colors">
            {t("browse")}
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 min-[480px]:grid-cols-2 xl:grid-cols-3 gap-4">
          {items.map((p) => {
            const cheapest = p.variants.length ? p.variants.reduce((a, b) => (a.price <= b.price ? a : b)) : null
            const base = cheapest ? cheapest.price : p.price
            const deal = p.maki ? bestMakiPrice(p.id, base, cheapest?.min ?? 0) : bestDiscountedPrice(p.id, base)
            const hasDeal = deal != null && deal < base
            return (
              <div key={p.id} className="flex flex-col gap-2">
                <GameCard
                  name={isTH ? p.name_th : p.name_en}
                  description={plain(isTH ? p.description_th : p.description_en)}
                  image={p.image}
                  previewVideo={p.preview_video_url}
                  platform={categoryName(p.category, isTH)}
                  badge={p.is_featured ? { text: "HOT", kind: "hot" } : null}
                  price={hasDeal ? (deal as number) : base}
                  oldPrice={hasDeal ? base : null}
                  usdRate={usdRate}
                  buyLabel={tHome("buy_short")}
                  rating={p.rating_avg}
                  reviewCount={p.rating_count}
                  href={`/products/${p.slug}`}
                />
                <button onClick={() => remove(p.slug)} disabled={busy === p.slug}
                        className="self-end inline-flex items-center gap-1 text-[0.72rem] text-text-dim hover:text-hot transition-colors disabled:opacity-50">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                  {t("fav_remove")}
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
