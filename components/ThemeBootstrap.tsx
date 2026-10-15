"use client"

import { useRef } from "react"
import { useServerInsertedHTML } from "next/navigation"
import { themeBootstrap } from "@/lib/themeBootstrap"

export default function ThemeBootstrap() {
  const inserted = useRef(false)
  // Insert before streamed page content, without mounting a script during client navigation or Fast Refresh.
  useServerInsertedHTML(() => {
    if (inserted.current) return null
    inserted.current = true
    return <script id="initial-store-theme" dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
  })
  return null
}
