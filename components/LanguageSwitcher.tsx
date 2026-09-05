"use client"

// เมนูเลือกภาษาแบบ dropdown ตามดีไซน์ใหม่ (TH/EN/JP/CN)
// ja/zh ยังแปลไม่ครบ — ระบบ i18n จะ fallback เป็นอังกฤษให้เองในคีย์ที่ยังไม่มี
import { useEffect, useRef, useState } from "react"
import { useLocale } from "next-intl"
import { usePathname, useRouter } from "@/i18n/routing"
import { AnimatePresence, motion } from "framer-motion"

const LANGS = [
  { locale: "th", code: "TH", flag: "🇹🇭", name: "ไทย" },
  { locale: "en", code: "EN", flag: "🇺🇸", name: "English" },
  { locale: "ja", code: "JP", flag: "🇯🇵", name: "日本語" },
  { locale: "zh", code: "CN", flag: "🇨🇳", name: "中文" },
] as const

export default function LanguageSwitcher() {
  const locale = useLocale()
  const router = useRouter()
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const boxRef = useRef<HTMLDivElement>(null)

  // ปิดเมนูเมื่อคลิกที่อื่น
  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onDoc)
    return () => document.removeEventListener("mousedown", onDoc)
  }, [open])

  const current = LANGS.find((l) => l.locale === locale) ?? LANGS[1]

  const pick = (next: string) => {
    setOpen(false)
    if (next !== locale) router.replace(pathname, { locale: next as "th" })
  }

  return (
    <div ref={boxRef} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Change language"
        className={`w-[38px] h-[38px] rounded-[10px] border text-[0.78rem] font-bold tracking-[0.02em] flex items-center justify-center transition-all ${
          open
            ? "border-accent text-accent-light bg-accent/[0.08]"
            : "border-border-soft text-text-muted hover:text-text-base hover:border-border-light hover:bg-white/[0.03]"
        }`}
      >
        {current.code}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18 }}
            className="absolute right-0 top-[calc(100%+6px)] min-w-[150px] rounded-[10px] p-1.5 z-50 bg-bg-card border border-border-soft shadow-[0_12px_40px_rgba(0,0,0,0.5)]"
          >
            {LANGS.map((l) => {
              const active = l.locale === locale
              return (
                <button
                  key={l.locale}
                  onClick={() => pick(l.locale)}
                  className={`flex items-center gap-2.5 w-full px-3 py-[9px] rounded-md text-[0.82rem] transition-colors ${
                    active ? "text-accent-light bg-accent/[0.08]" : "text-text-muted hover:text-text-base hover:bg-accent/10"
                  }`}
                >
                  <span>{l.flag}</span>
                  {l.name}
                  {active && (
                    <svg className="ml-auto" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </button>
              )
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
