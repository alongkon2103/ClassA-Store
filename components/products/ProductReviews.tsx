"use client"
import { localeTag } from "@/lib/i18n/locale"

// ระบบรีวิวจริง: ดึงจาก /api/reviews/[slug]
// เขียนรีวิวได้เฉพาะคนที่ซื้อสินค้านี้และจ่ายเงินแล้ว (ฝั่ง API เป็นคนบังคับ)
import { useCallback, useEffect, useState } from "react"
import { useLocale, useTranslations } from "next-intl"
import Stars from "@/components/reviews/Stars"
import ReviewForm from "@/components/reviews/ReviewForm"
import type { ReviewPointsState } from "@/lib/points"

type Review = {
  id: string
  rating: number
  comment: string | null
  created_at: string | null
  mine: boolean
  user: { name: string; avatar: string | null }
}
type Data = {
  average: number
  count: number
  distribution: number[] // index 0 = 1 ดาว
  canReview: boolean
  myReview: { rating: number; comment: string | null } | null
  reviewPoints?: ReviewPointsState | null
  reviews: Review[]
}

export default function ProductReviews({ slug, onSummary }: { slug: string; onSummary?: (s: { average: number; count: number }) => void }) {
  const t = useTranslations("Reviews")
  const locale = useLocale()
  const [data, setData] = useState<Data | null>(null)

  const load = useCallback(async () => {
    const r = await fetch(`/api/reviews/${slug}`, { cache: "no-store" })
    if (!r.ok) return
    const d: Data = await r.json()
    setData(d)
    onSummary?.({ average: d.average, count: d.count })
  }, [slug, onSummary])

  useEffect(() => { load() }, [load])

  if (!data) return <p className="text-text-muted text-sm py-6">{t("loading")}</p>

  const fmtDate = (s: string | null) =>
    s ? new Date(s).toLocaleDateString(localeTag(locale), { day: "numeric", month: "short", year: "numeric" }) : ""

  return (
    <div>
      {/* สรุปคะแนน */}
      {data.count > 0 ? (
        <div className="flex flex-col sm:flex-row items-center gap-6 bg-bg-card border border-border-soft rounded-[14px] p-6 mb-6">
          <div className="text-center shrink-0 px-4">
            <div className="text-[2.4rem] font-black leading-none">{data.average.toFixed(1)}</div>
            <div className="flex justify-center mt-1.5"><Stars value={Math.round(data.average)} /></div>
            <div className="text-[0.7rem] text-text-dim mt-1.5">{t("count", { count: data.count })}</div>
          </div>
          <div className="flex-1 flex flex-col gap-1.5 w-full">
            {[5, 4, 3, 2, 1].map((star) => {
              const n = data.distribution[star - 1] ?? 0
              const pct = data.count ? Math.round((n / data.count) * 100) : 0
              return (
                <div key={star} className="flex items-center gap-2 text-xs text-text-dim">
                  <span className="w-3 text-right">{star}</span>
                  <div className="flex-1 h-2 bg-border-soft rounded-full overflow-hidden">
                    <div className="h-full bg-gold rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="w-8 text-right text-[0.7rem]">{pct}%</span>
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <p className="text-text-muted text-sm mb-6">{t("empty")}</p>
      )}

      {/* ฟอร์มเขียน/แก้รีวิว — key ผูกกับรีวิวที่มีอยู่ เพื่อ remount เมื่อโหลดข้อมูลใหม่ */}
      <div className="mb-6">
        <ReviewForm
          key={data.myReview ? `${data.myReview.rating}|${data.myReview.comment ?? ""}` : "new"}
          slug={slug}
          initial={data.myReview}
          canReview={data.canReview}
          points={data.reviewPoints ?? null}
          onSaved={load}
          onDeleted={load}
        />
      </div>

      {/* รายการรีวิว */}
      <div className="flex flex-col gap-3">
        {data.reviews.map((r) => (
          <div key={r.id} className="bg-bg-card border border-border-soft rounded-[14px] p-5">
            <div className="flex items-center gap-3 mb-2.5">
              {r.user.avatar
                ? <img src={r.user.avatar} alt="" className="w-9 h-9 rounded-full object-cover" />
                : <div className="w-9 h-9 rounded-full bg-accent/20 flex items-center justify-center text-[0.8rem] font-bold text-accent-light">{r.user.name[0]?.toUpperCase()}</div>}
              <div>
                <div className="text-[0.82rem] font-bold flex items-center gap-2">
                  {r.user.name}
                  {r.mine && <span className="text-[0.6rem] px-1.5 py-0.5 rounded bg-accent/15 text-accent-light font-semibold">{t("you")}</span>}
                </div>
                <div className="text-[0.68rem] text-text-dim">{fmtDate(r.created_at)}</div>
              </div>
              <div className="ml-auto"><Stars value={r.rating} /></div>
            </div>
            {r.comment && <p className="text-[0.85rem] text-text-muted leading-[1.75] whitespace-pre-line">{r.comment}</p>}
          </div>
        ))}
      </div>
    </div>
  )
}
