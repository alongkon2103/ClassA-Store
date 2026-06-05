"use client"

import { useEffect, useRef } from "react"
import { usePathname } from "next/navigation"
import { useLocale } from "next-intl"

export default function PageTracker() {
  const pathname = usePathname()
  const locale = useLocale()
  const lastSent = useRef<string>("")

  useEffect(() => {
    if (!pathname) return
    if (pathname.startsWith("/api") || pathname.includes("/admin")) return

    const cleanPath = pathname.split("?")[0]
    if (lastSent.current === cleanPath) return
    lastSent.current = cleanPath

    const payload = JSON.stringify({
      path: cleanPath,
      referrer: document.referrer || null,
      locale,
    })

    try {
      if (navigator.sendBeacon) {
        const blob = new Blob([payload], { type: "application/json" })
        navigator.sendBeacon("/api/track", blob)
      } else {
        fetch("/api/track", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: payload,
          keepalive: true,
        }).catch(() => {})
      }
    } catch {}
  }, [pathname, locale])

  return null
}
