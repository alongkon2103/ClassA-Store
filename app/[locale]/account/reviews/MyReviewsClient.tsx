"use client"
import { localeTag } from "@/lib/i18n/locale"

import { useState } from "react"
import { useLocale, useTranslations } from "next-intl"
import Image from "next/image"
import { Link, useRouter } from "@/i18n/routing"
import type { ReviewPointsState } from "@/lib/points"
import { getImageUrl } from "@/lib/getImageUrl"
import Stars from "@/components/reviews/Stars"
import ReviewForm from "@/components/reviews/ReviewForm"

type Review = { rating: number; comment: string | null; updated_at: string | null }
export type ReviewItem = { slug: string; name_th: string; name_en: string; image: string | null; bought_at: string | null; review: Review | null; points: ReviewPointsState }

/** perReview = แต้มต่อรีวิวตอนนี้ (0 = ระบบแต้ม/แต้มรีวิวปิด → ไม่โชว์ป้าย) */
export default function MyReviewsClient({ items: initial, perReview }: { items: ReviewItem[]; perReview: number }) {
  const t = useTranslations("Account")
  const locale = useLocale()
  const isTH = locale === "th"
  const [items, setItems] = useState(initial)
  const [open, setOpen] = useState<string | null>(null)
  const router = useRouter()

  const fmt = (s: string | null) =>
    s ? new Date(s).toLocaleDateString(localeTag(locale), { day: "numeric", month: "short", year: "numeric" }) : "—"
  const done = items.filter((x) => x.review).length

  const patch = (slug: string, review: Review | null, points?: ReviewPointsState) =>
    setItems((xs) => xs.map((x) => (x.slug === slug ? { ...x, review, ...(points ? { points } : {}) } : x)))
  const available = items.filter((x) => x.points.state === "available" && !x.review).length

  return (
    <div>
      <div className="flex items-end justify-between gap-3 mb-1">
        <h1 className="text-[1.2rem] sm:text-[1.5rem] font-black">{t("rev_title")}</h1>
        {items.length > 0 && <span className="text-[0.82rem] text-text-dim">{t("rev_progress", { done, total: items.length })}</span>}
      </div>
      <p className="text-[0.82rem] text-text-dim mb-5">{t("rev_sub")}</p>

      {/* แต้มรีวิว — โชว์เฉพาะตอนระบบแต้มเปิดและตั้งแต้มต่อรีวิวไว้ */}
      {perReview > 0 && items.length > 0 && (
        <div className="rounded-[14px] border border-gold/25 bg-gold/[0.06] px-5 py-4 mb-5 flex items-start gap-3">
          <span className="w-9 h-9 rounded-full bg-gold/15 text-gold flex items-center justify-center shrink-0">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10" /></svg>
          </span>
          <div className="min-w-0">
            <p className="text-[0.9rem] font-bold text-gold">{t("rev_points_banner", { points: perReview.toLocaleString() })}</p>
            {available > 0 && <p className="text-[0.78rem] text-text-muted mt-0.5">{t("rev_points_left", { n: available, total: (available * perReview).toLocaleString() })}</p>}
            <p className="text-[0.72rem] text-text-dim mt-1 leading-relaxed">{t("rev_points_rules")}</p>
          </div>
        </div>
      )}

      {items.length === 0 ? (
        <div className="bg-bg-card border border-border-soft rounded-[14px] p-10 text-center">
          <p className="text-text-muted text-sm mb-4">{t("rev_empty")}</p>
          <Link href="/products" className="inline-flex px-6 py-2.5 bg-accent hover:bg-accent-light text-white text-[14px] font-bold rounded-xl transition-colors">
            {t("browse")}
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((x) => {
            const name = isTH ? x.name_th : x.name_en
            const isOpen = open === x.slug
            return (
              <div key={x.slug} className="bg-bg-card border border-border-soft rounded-[14px] p-5">
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="w-14 h-14 rounded-lg overflow-hidden shrink-0 relative" style={{ background: "var(--gradient-thumb)" }}>
                    {x.image && <Image src={getImageUrl(x.image)} alt={name} fill sizes="56px" className="object-cover" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <Link href={`/products/${x.slug}`} className="text-[0.88rem] font-bold hover:text-accent-light transition-colors block truncate">{name}</Link>
                    <div className="text-[0.7rem] text-text-dim mt-0.5">{t("rev_bought_on", { date: fmt(x.bought_at) })}</div>
                    {x.review && (
                      <div className="flex items-center gap-2 mt-1.5">
                        <Stars value={x.review.rating} size={13} />
                        <span className="text-[0.68rem] text-text-dim">{t("rev_reviewed_on", { date: fmt(x.review.updated_at) })}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 ml-auto">
                    {x.points.state === "available" && (
                      <span className="px-2.5 py-[3px] rounded-md text-[0.65rem] font-bold bg-gold/10 text-gold border border-gold/25">{t("rev_points_badge", { points: x.points.points.toLocaleString() })}</span>
                    )}
                    {x.points.state === "earned" && (
                      <span className="px-2.5 py-[3px] rounded-md text-[0.65rem] font-bold bg-success/10 text-success border border-success/20">✓ {t("rev_points_earned", { points: x.points.points.toLocaleString() })}</span>
                    )}
                    {!x.review && x.points.state !== "available" && (
                      <span className="px-2.5 py-[3px] rounded-md text-[0.65rem] font-bold bg-accent/[0.12] text-accent-lighter border border-accent/15">{t("rev_not_yet")}</span>
                    )}
                    <button onClick={() => setOpen(isOpen ? null : x.slug)}
                            className={`px-3.5 py-[7px] rounded-lg text-[0.72rem] font-semibold transition-colors ${
                              x.review ? "border border-border-soft text-text-muted hover:bg-white/[0.03] hover:text-text-base" : "bg-accent hover:bg-accent-light text-white"}`}>
                      {isOpen ? t("rev_close") : x.review ? t("rev_edit") : t("rev_write")}
                    </button>
                  </div>
                </div>

                {x.review?.comment && !isOpen && (
                  <p className="text-[0.82rem] text-text-muted leading-[1.7] mt-3 whitespace-pre-line">{x.review.comment}</p>
                )}

                {isOpen && (
                  <div className="mt-4 pt-4 border-t border-border-soft">
                    <ReviewForm
                      key={`${x.slug}-${x.review ? "edit" : "new"}`}
                      slug={x.slug}
                      initial={x.review ? { rating: x.review.rating, comment: x.review.comment } : null}
                      canReview
                      compact
                      points={x.points}
                      onSaved={(r, earned) => {
                        patch(x.slug, { ...r, updated_at: new Date().toISOString() }, earned ? { state: "earned", points: earned } : undefined)
                        if (earned) router.refresh() // อัปเดตยอดแต้มใน sidebar
                      }}
                      onDeleted={(reversed) => {
                        patch(x.slug, null, reversed ? { state: "none", points: 0 } : undefined)
                        setOpen(null)
                        if (reversed) router.refresh()
                      }}
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
