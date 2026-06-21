"use client"

import { motion } from "framer-motion"
import { useTranslations } from "next-intl"
import Link from "next/link"

export default function Hero() {
  const t = useTranslations("Home")

  return (
    <section className="relative min-h-[78vh] flex flex-col items-center justify-center text-center px-6 sm:px-10 py-20 overflow-hidden">
      {/* Single subtle radial glow centered behind text — keeps the section
          from feeling completely flat without adding visual noise. */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 50% 40% at 50% 45%, rgba(91,147,204,.10) 0%, transparent 70%)",
        }}
      />

      <div className="relative z-10 flex flex-col items-center max-w-3xl">
        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="font-display font-bold leading-none tracking-tight mb-5"
          style={{ fontSize: "clamp(52px, 9vw, 96px)" }}
        >
          A Class{" "}
          <span
            className="bg-clip-text text-transparent"
            style={{
              backgroundImage:
                "linear-gradient(135deg, var(--color-accent-light) 0%, var(--color-accent) 100%)",
            }}
          >
            Store
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          className="text-text-muted font-light text-base sm:text-[17px] max-w-xl mx-auto mb-9 leading-relaxed"
        >
          {t("hero_subtitle")}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="flex gap-3 flex-wrap justify-center"
        >
          <Link
            href="/products"
            className="group inline-flex items-center gap-2 bg-accent hover:bg-accent-light text-white font-medium text-[15px] px-7 py-3 rounded-xl transition-all hover:-translate-y-0.5 active:scale-95"
          >
            {t("browse_shop")}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="transition-transform group-hover:translate-x-0.5">
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </Link>

          <a
            href="https://discord.gg/vCuPy8H9ub"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 border border-accent/20 hover:border-accent-light text-text-base text-[15px] px-7 py-3 rounded-xl transition-colors active:scale-95"
          >
            <DiscordIcon size={16} />
            {t("Join_disocrd_Hero")}
          </a>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-[12px] text-text-muted"
        >
          <Stat label={t("hero_stat_delivery")} />
          <Divider />
          <Stat label={t("hero_stat_secure")} />
        </motion.div>
      </div>
    </section>
  )
}

function Stat({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-accent-light">
        <polyline points="20 6 9 17 4 12" />
      </svg>
      {label}
    </span>
  )
}

function Divider() {
  return <span className="hidden sm:inline w-1 h-1 rounded-full bg-accent/30" aria-hidden />
}

function DiscordIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.078.078 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z" />
    </svg>
  )
}
