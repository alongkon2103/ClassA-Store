"use client"

import { useLocale } from "next-intl"
import { usePathname, useRouter } from "@/i18n/routing"
import { motion } from "framer-motion"

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
      className="w-9 h-9 flex items-center justify-center rounded-lg border border-accent/20 text-text-muted hover:text-accent-light hover:bg-accent/5 transition-all text-[11px] font-bold"
      aria-label="Toggle language"
    >
      <motion.span
        key={locale}
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -5 }}
        transition={{ duration: 0.2 }}
      >
        {locale === "en" ? "EN" : "TH"}
      </motion.span>
    </button>
  )
}
