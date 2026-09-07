"use client"

// ฟอร์มเขียน/แก้รีวิวของสินค้า 1 ชิ้น — ใช้ซ้ำในหน้าสินค้า, หน้ารีวิวของฉัน
// และ modal รายละเอียดออเดอร์ (คุยกับ /api/reviews/[slug] ซึ่งเช็คว่าซื้อจริงแล้วเอง)
//
// สองโหมด: parent ส่ง initial + canReview มาเอง (หน้าสินค้าโหลดรีวิวทั้งชุดอยู่แล้ว)
// หรือไม่ส่งมา ฟอร์มจะไปถาม API เอง (modal ออเดอร์) — ถ้า initial เปลี่ยนจากข้างนอก
// ให้ parent ใส่ key ใหม่เพื่อ remount แทนการ sync state
import { useEffect, useState } from "react"
import { useTranslations } from "next-intl"
import Stars from "./Stars"

export type MyReview = { rating: number; comment: string | null } | null

export default function ReviewForm({ slug, initial, canReview, onSaved, onDeleted, compact = false }: {
  slug: string
  initial?: MyReview
  canReview?: boolean
  onSaved?: (review: { rating: number; comment: string | null }) => void
  onDeleted?: () => void
  /** ไม่มีกรอบการ์ด (ใช้ตอนวางในการ์ด/โมดัลที่มีกรอบอยู่แล้ว) */
  compact?: boolean
}) {
  const t = useTranslations("Reviews")
  const selfLoad = initial === undefined
  const [mine, setMine] = useState<MyReview>(initial ?? null)
  const [allowed, setAllowed] = useState<boolean | null>(selfLoad ? null : (canReview ?? false))
  const [rating, setRating] = useState(initial?.rating ?? 0)
  const [comment, setComment] = useState(initial?.comment ?? "")
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => {
    if (!selfLoad) return
    let alive = true
    fetch(`/api/reviews/${slug}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!alive) return
        if (!d) { setAllowed(false); return }
        setMine(d.myReview ?? null)
        setAllowed(!!d.canReview)
        setRating(d.myReview?.rating ?? 0)
        setComment(d.myReview?.comment ?? "")
      })
    return () => { alive = false }
  }, [selfLoad, slug])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!rating || busy) return
    setBusy(true); setMsg(null)
    try {
      const r = await fetch(`/api/reviews/${slug}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, comment }),
      })
      if (r.ok) {
        const saved = { rating, comment: comment.trim() || null }
        setMine(saved); setMsg(t("saved")); onSaved?.(saved)
      } else {
        const d = await r.json().catch(() => null)
        setMsg(d?.error === "must_purchase" ? t("must_purchase") : d?.error === "unauthorized" ? t("login_first") : t("error"))
      }
    } finally { setBusy(false) }
  }

  const remove = async () => {
    if (busy) return
    setBusy(true)
    try {
      const r = await fetch(`/api/reviews/${slug}`, { method: "DELETE" })
      if (r.ok) { setMine(null); setRating(0); setComment(""); setMsg(null); onDeleted?.() }
    } finally { setBusy(false) }
  }

  if (allowed === null) return <p className="text-text-muted text-sm py-2">{t("loading")}</p>
  if (!allowed) {
    return <p className="text-[0.8rem] text-text-dim bg-bg-card border border-border-soft rounded-[14px] p-4">{t("must_purchase")}</p>
  }

  return (
    <form onSubmit={submit} className={compact ? "" : "bg-bg-card border border-border-soft rounded-[14px] p-5"}>
      <p className="text-[0.9rem] font-bold mb-3">{mine ? t("edit_title") : t("write_title")}</p>
      <div className="flex items-center gap-2 mb-3">
        <Stars value={rating} size={22} onPick={setRating} />
        {rating > 0 && <span className="text-[0.8rem] text-text-muted">{rating}/5</span>}
      </div>
      <textarea
        value={comment} onChange={(e) => setComment(e.target.value)} rows={3} maxLength={1000}
        placeholder={t("placeholder")}
        className="w-full rounded-lg bg-bg-input border border-border-soft px-3.5 py-2.5 text-[0.85rem] text-text-base outline-none focus:border-accent transition-colors placeholder:text-text-dim"
      />
      <div className="flex items-center gap-2 mt-3 flex-wrap">
        <button type="submit" disabled={!rating || busy}
                className="px-5 py-2.5 rounded-lg bg-accent hover:bg-accent-light text-white text-[0.82rem] font-semibold disabled:opacity-50 transition-colors">
          {busy ? "..." : t("submit")}
        </button>
        {mine && (
          <button type="button" onClick={remove} disabled={busy}
                  className="px-4 py-2.5 rounded-lg border border-border-soft text-text-muted hover:text-hot hover:border-hot/40 text-[0.82rem] transition-colors">
            {t("delete")}
          </button>
        )}
        {msg && <span className="text-[0.78rem] text-text-muted">{msg}</span>}
      </div>
    </form>
  )
}
