"use client"

import { useState } from "react"
import { useLocale, useTranslations } from "next-intl"
import Image from "next/image"
import { Link } from "@/i18n/routing"
import { getImageUrl } from "@/lib/getImageUrl"
import Stars from "@/components/reviews/Stars"
import ReviewForm from "@/components/reviews/ReviewForm"

type Review = { rating: number; comment: string | null; updated_at: string | null }
export type ReviewItem = { slug: string; name_th: string; name_en: string; image: string | null; bought_at: string | null; review: Review | null }

export default function MyReviewsClient({ items: initial }: { items: ReviewItem[] }) {
  const t = useTranslations("Account")
  const locale = useLocale()
  const isTH = locale === "th"
  const [items, setItems] = useState(initial)
  const [open, setOpen] = useState<string | null>(null)

  const fmt = (s: string | null) =>
    s ? new Date(s).toLocaleDateString(isTH ? "th-TH" : "en-US", { day: "numeric", month: "short", year: "numeric" }) : "—"
  const done = items.filter((x) => x.review).length

  const patch = (slug: string, review: Review | null) =>
    setItems((xs) => xs.map((x) => (x.slug === slug ? { ...x, review } : x)))

  return (
    <div>
      <div className="flex items-end justify-between gap-3 mb-1">
        <h1 className="text-[1.2rem] sm:text-[1.5rem] font-black">{t("rev_title")}</h1>
        {items.length > 0 && <span className="text-[0.82rem] text-text-dim">{t("rev_progress", { done, total: items.length })}</span>}
      </div>
      <p className="text-[0.82rem] text-text-dim mb-5">{t("rev_sub")}</p>

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
                  <div className="w-14 h-14 rounded-lg overflow-hidden shrink-0 relative" style={{ background: "linear-gradient(135deg,#141e36,#0d1526)" }}>
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
                    {!x.review && (
                      <span className="px-2.5 py-[3px] rounded-md text-[0.65rem] font-bold bg-accent/[0.12] text-accent-lighter border border-accent/15">{t("rev_not_yet")}</span>
                    )}
                    {/* TODO(points): ป้าย "+100 แต้ม" ตรงนี้เมื่อระบบแต้มพร้อม */}
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
                      onSaved={(r) => patch(x.slug, { ...r, updated_at: new Date().toISOString() })}
                      onDeleted={() => { patch(x.slug, null); setOpen(null) }}
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
