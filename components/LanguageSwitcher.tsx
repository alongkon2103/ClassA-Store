"use client"

import { useLocale } from "next-intl"
import { usePathname, useRouter } from "@/i18n/routing"
import { motion, AnimatePresence } from "framer-motion"

export default function LanguageSwitcher() {
  const locale = useLocale()
  const router = useRouter()
  const pathname = usePathname()

  const toggleLocale = () => {
    const newLocale = locale === "en" ? "th" : "en"
    router.replace(pathname, { locale: newLocale })
  }

  return (
    <button
      onClick={toggleLocale}
      className="w-10 h-10 flex items-center justify-center rounded-xl border border-accent/20 bg-bg-card text-text-muted hover:text-accent-light hover:bg-accent/5 transition-all text-[11px] font-bold"
      aria-label="Toggle language"
    >
      <AnimatePresence mode="wait">
        <motion.span
          key={locale}
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -5 }}
          transition={{ duration: 0.15 }}
        >
          {locale === "th" ? "EN" : "TH"}
        </motion.span>
      </AnimatePresence>
    </button>
  )
}