"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { usePathname } from "@/i18n/routing"
import { announcementStatus, type WebAnnouncement } from "@/lib/webAnnouncements"
import AnnouncementDialog from "./AnnouncementDialog"

const storageKey = (a: WebAnnouncement) => `web-announcement:${a.id}:${a.revision}`
const EXCLUDED = ["/admin", "/checkout", "/livegen"]

export default function WebAnnouncementPopup() {
  const pathname = usePathname()
  const skip = EXCLUDED.some((p) => pathname === p || pathname.startsWith(p + "/"))
  const [items, setItems] = useState<WebAnnouncement[]>([])
  const dismissed = useRef(new Set<string>())

  useEffect(() => {
    if (skip) return
    let stopped = false
    let timer: ReturnType<typeof setTimeout>
    let controller: AbortController
    const load = async () => {
      clearTimeout(timer)
      controller?.abort()
      const request = new AbortController()
      controller = request
      let delay = 60_000
      try {
        const r = await fetch("/api/public/web-announcements", { cache: "no-store", signal: request.signal })
        if (!r.ok) throw new Error("unavailable")
        const data: { announcements: WebAnnouncement[]; nextChangeAt: string | null } = await r.json()
        if (stopped || request.signal.aborted) return
        setItems(data.announcements.filter((a) => {
          if (announcementStatus(a) !== "active" || dismissed.current.has(storageKey(a))) return false
          try { return localStorage.getItem(storageKey(a)) !== "1" } catch { return true }
        }))
        if (data.nextChangeAt) delay = Math.max(250, Math.min(delay, Date.parse(data.nextChangeAt) - Date.now() + 100))
      } catch { /* Announcements must never block access when the API is unavailable. */ }
      if (!stopped && !request.signal.aborted) timer = setTimeout(load, delay)
    }
    const onVisible = () => { if (document.visibilityState === "visible") void load() }
    void load()
    window.addEventListener("focus", onVisible)
    document.addEventListener("visibilitychange", onVisible)
    return () => { stopped = true; clearTimeout(timer); controller?.abort(); window.removeEventListener("focus", onVisible); document.removeEventListener("visibilitychange", onVisible) }
  }, [skip, pathname])

  const item = items[0]
  const close = useCallback(() => {
    if (!item) return
    const key = storageKey(item)
    dismissed.current.add(key)
    try { localStorage.setItem(key, "1") } catch { /* Session memory still prevents repeat prompts. */ }
    setItems((current) => current.filter((a) => a.id !== item.id))
  }, [item])

  // Expiry closes an already open popup even if the next network request fails.
  useEffect(() => {
    if (!item?.endsAt) return
    const end = Date.parse(item.endsAt)
    let timer: ReturnType<typeof setTimeout>
    const check = () => {
      const remaining = end - Date.now()
      if (remaining <= 0) setItems((current) => current.filter((a) => announcementStatus(a) === "active"))
      else timer = setTimeout(check, Math.min(remaining, 2_147_483_647))
    }
    check()
    return () => clearTimeout(timer)
  }, [item])

  if (skip || !item || announcementStatus(item) !== "active") return null
  return <AnnouncementDialog key={storageKey(item)} announcement={item} onClose={close} />
}
