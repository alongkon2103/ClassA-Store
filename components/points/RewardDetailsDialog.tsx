"use client"

import { useEffect, useId, useRef, useState, type ReactNode } from "react"
import { useLocale, useTranslations } from "next-intl"
import { getImageUrl } from "@/lib/getImageUrl"
import type { RewardView } from "@/lib/pointsRedeem"

export default function RewardDetailsDialog({ reward, meta, onClose, children }: {
  reward: RewardView; meta: string; onClose: () => void; children: ReactNode
}) {
  const t = useTranslations("Account")
  const isTH = useLocale() === "th"
  const title = (isTH ? reward.title_th : reward.title_en) || reward.title_th
  const description = (isTH ? reward.description_th : reward.description_en) || reward.description_th || reward.description_en
  const [index, setIndex] = useState(0)
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const images = reward.image_urls
  useEffect(() => {
    const dialog = ref.current
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    dialog?.showModal()
    const overflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      dialog?.close()
      document.body.style.overflow = overflow
      if (previousFocus?.isConnected) previousFocus.focus()
    }
  }, [])

  return (
    <dialog ref={ref} aria-labelledby={titleId} aria-modal="true"
      onCancel={(e) => { e.preventDefault(); onClose() }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      className="fixed inset-0 m-auto w-[calc(100%-32px)] max-w-[720px] max-h-[calc(100dvh-32px)] overflow-y-auto rounded-2xl border border-border-soft bg-bg-card p-0 text-text-base shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm">
      <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-border-soft bg-bg-card px-5 py-4 sm:px-6">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-gold">{t("redeem_details")}</p>
          <h2 id={titleId} className="mt-1 text-xl font-bold break-words">{title}</h2>
        </div>
        <button type="button" onClick={onClose} aria-label={t("daily_popup_close")}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border-soft text-text-muted hover:bg-bg-base focus-visible:outline-2 focus-visible:outline-accent">✕</button>
      </header>
      <div className="space-y-4 px-5 py-4 sm:px-6">
        {images.length > 0 && (
          <div className="space-y-3">
            <img src={getImageUrl(images[index])} alt={t("redeem_image", { title, n: index + 1 })} className="max-h-[380px] w-full rounded-xl bg-bg-base object-contain" />
            {images.length > 1 && <>
              <div className="flex items-center justify-between gap-3">
                <button type="button" onClick={() => setIndex((index + images.length - 1) % images.length)} aria-label={t("redeem_previous_image")}
                  className="h-10 w-10 rounded-lg border border-border-soft hover:bg-bg-base">←</button>
                <p aria-live="polite" className="text-xs text-text-muted">{index + 1} / {images.length}</p>
                <button type="button" onClick={() => setIndex((index + 1) % images.length)} aria-label={t("redeem_next_image")}
                  className="h-10 w-10 rounded-lg border border-border-soft hover:bg-bg-base">→</button>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {images.map((url, i) => <button type="button" key={`${url}-${i}`} onClick={() => setIndex(i)} aria-pressed={i === index}
                  aria-label={t("redeem_image", { title, n: i + 1 })}
                  className={`h-16 w-24 shrink-0 overflow-hidden rounded-lg border-2 focus-visible:outline-2 focus-visible:outline-accent ${i === index ? "border-gold" : "border-border-soft hover:border-gold/50"}`}>
                  <img src={getImageUrl(url)} alt="" className="h-full w-full object-cover" />
                </button>)}
              </div>
            </>}
          </div>
        )}
        <p className="text-sm text-accent-light">{meta}</p>
        {description && <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-text-muted">{description}</p>}
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-dim">
          {reward.available != null && <p>{t("redeem_left", { n: reward.available })}</p>}
          {reward.per_user_limit != null && <p>{t("redeem_limit", { n: reward.per_user_limit })}</p>}
        </div>
      </div>
      <footer className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 border-t border-border-soft bg-bg-card px-5 py-4 sm:px-6">
        <span className="text-lg font-black text-gold">{t("redeem_cost", { points: reward.cost.toLocaleString() })}</span>
        {children}
      </footer>
    </dialog>
  )
}
