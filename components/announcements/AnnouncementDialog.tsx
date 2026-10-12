"use client"

import { useEffect, useRef } from "react"
import { useLocale, useTranslations } from "next-intl"
import { getImageUrl } from "@/lib/getImageUrl"
import { localeTag } from "@/lib/i18n/locale"
import type { WebAnnouncementInput } from "@/lib/webAnnouncements"

// Content is allowlisted before reaching this shared storefront/preview dialog.
export default function AnnouncementDialog({ announcement, onClose }: {
  announcement: WebAnnouncementInput
  onClose: () => void
}) {
  const t = useTranslations("WebAnnouncements")
  const locale = useLocale()
  const ref = useRef<HTMLDialogElement>(null)
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
  const date = new Intl.DateTimeFormat(localeTag(locale), { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bangkok" }).format(new Date(announcement.startsAt))
  return (
    <dialog ref={ref} aria-labelledby="web-announcement-title" aria-modal="true"
      onCancel={(e) => { e.preventDefault(); onClose() }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      className="fixed inset-0 m-auto w-[calc(100%-32px)] max-w-[640px] max-h-[calc(100dvh-32px)] overflow-y-auto rounded-2xl border border-border-soft bg-bg-card p-0 text-text-base shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm">
      <div>
        <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-border-soft bg-bg-card px-5 py-4 sm:px-6">
          <div>
            <p className="text-xs font-semibold text-accent-light">{t("announcement")}</p>
            <h2 id="web-announcement-title" className="mt-1 text-xl font-bold break-words">{announcement.title}</h2>
            <p className="mt-1 text-xs text-text-dim">{date} · {t("timezone_short")}</p>
          </div>
          <button type="button" autoFocus onClick={onClose} aria-label={t("close")} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border-soft text-text-muted hover:bg-bg-base focus-visible:outline-2 focus-visible:outline-accent">✕</button>
        </header>
        <div className="px-5 py-4 sm:px-6">
          {announcement.imageUrl && <img src={getImageUrl(announcement.imageUrl)} alt="" className="mb-4 max-h-[400px] w-full rounded-xl object-contain" />}
          <div className="prose max-w-none overflow-x-auto break-words text-sm [&_mark]:bg-gold/20 [&_mark]:text-text-base" dangerouslySetInnerHTML={{ __html: announcement.content }} />
        </div>
        <footer className="border-t border-border-soft px-5 py-4 sm:px-6">
          <button type="button" onClick={onClose} className="w-full rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-on-accent hover:brightness-110">{t("acknowledge")}</button>
        </footer>
      </div>
    </dialog>
  )
}
