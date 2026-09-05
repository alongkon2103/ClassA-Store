"use client"

// ระบบรีวิวจริง: ดึงจาก /api/reviews/[slug]
// เขียนรีวิวได้เฉพาะคนที่ซื้อสินค้านี้และจ่ายเงินแล้ว (ฝั่ง API เป็นคนบังคับ)
import { useCallback, useEffect, useState } from "react"
import { useLocale, useTranslations } from "next-intl"

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
  reviews: Review[]
}

function Stars({ value, size = 14, onPick }: { value: number; size?: number; onPick?: (n: number) => void }) {
  return (
    <span className="inline-flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <svg
          key={n}
          onClick={onPick ? () => onPick(n) : undefined}
          width={size} height={size} viewBox="0 0 24 24"
          className={`${n <= value ? "text-gold" : "text-border-light"} ${onPick ? "cursor-pointer hover:scale-110 transition-transform" : ""}`}
          fill="currentColor"
        >
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      ))}
    </span>
  )
}

export default function ProductReviews({ slug }: { slug: string }) {
  const t = useTranslations("Reviews")
  const locale = useLocale()
  const [data, setData] = useState<Data | null>(null)
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState("")
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const load = useCallback(async () => {
    const r = await fetch(`/api/reviews/${slug}`, { cache: "no-store" })
    if (!r.ok) return
    const d: Data = await r.json()
    setData(d)
    if (d.myReview) { setRating(d.myReview.rating); setComment(d.myReview.comment ?? "") }
  }, [slug])

  useEffect(() => { load() }, [load])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!rating || busy) return
    setBusy(true); setMsg(null)
    try {
      const r = await fetch(`/api/reviews/${slug}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, comment }),
      })
      if (r.ok) { setMsg(t("saved")); await load() }
      else {
        const d = await r.json().catch(() => null)
        setMsg(d?.error === "must_purchase" ? t("must_purchase") : d?.error === "unauthorized" ? t("login_first") : t("error"))
      }
    } finally { setBusy(false) }
  }

  const remove = async () => {
    setBusy(true)
    try {
      await fetch(`/api/reviews/${slug}`, { method: "DELETE" })
      setRating(0); setComment(""); setMsg(null); await load()
    } finally { setBusy(false) }
  }

  if (!data) return <p className="text-text-muted text-sm py-6">{t("loading")}</p>

  const fmtDate = (s: string | null) =>
    s ? new Date(s).toLocaleDateString(locale === "th" ? "th-TH" : "en-US", { day: "numeric", month: "short", year: "numeric" }) : ""

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

      {/* ฟอร์มเขียนรีวิว */}
      {data.canReview ? (
        <form onSubmit={submit} className="bg-bg-card border border-border-soft rounded-[14px] p-5 mb-6">
          <p className="text-[0.9rem] font-bold mb-3">{data.myReview ? t("edit_title") : t("write_title")}</p>
          <div className="flex items-center gap-2 mb-3">
            <Stars value={rating} size={22} onPick={setRating} />
            {rating > 0 && <span className="text-[0.8rem] text-text-muted">{rating}/5</span>}
          </div>
          <textarea
            value={comment} onChange={(e) => setComment(e.target.value)} rows={3} maxLength={1000}
            placeholder={t("placeholder")}
            className="w-full rounded-lg bg-bg-input border border-border-soft px-3.5 py-2.5 text-[0.85rem] text-text-base outline-none focus:border-accent transition-colors placeholder:text-text-dim resize-y"
          />
          <div className="flex items-center gap-2 mt-3">
            <button type="submit" disabled={!rating || busy}
                    className="px-5 py-2.5 rounded-lg bg-accent hover:bg-accent-light text-white text-[0.82rem] font-semibold disabled:opacity-50 transition-colors">
              {busy ? "..." : t("submit")}
            </button>
            {data.myReview && (
              <button type="button" onClick={remove} disabled={busy}
                      className="px-4 py-2.5 rounded-lg border border-border-soft text-text-muted hover:text-hot hover:border-hot/40 text-[0.82rem] transition-colors">
                {t("delete")}
              </button>
            )}
            {msg && <span className="text-[0.78rem] text-text-muted">{msg}</span>}
          </div>
        </form>
      ) : (
        <p className="text-[0.8rem] text-text-dim bg-bg-card border border-border-soft rounded-[14px] p-4 mb-6">{t("must_purchase")}</p>
      )}

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
