"use client"

import { Link, usePathname } from "@/i18n/routing"
import { signOut, useSession } from "next-auth/react"
import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useTheme } from "./ThemeContext"
import { useTranslations } from "next-intl"
import LanguageSwitcher from "./LanguageSwitcher"

const navItems = [
  { href: "/", labelKey: "home", auth: false, flag: null },
  { href: "/products", labelKey: "shop", auth: false, flag: null },
  { href: "/livegen", labelKey: "livegen", auth: false, flag: "livegen_enabled" as const },
  { href: "/orders", labelKey: "orders", auth: true, flag: null },
  { href: "/contact", labelKey: "contact", auth: false, flag: null },
  { href: "/rules", labelKey: "rules", auth: false, flag: null },
  { href: "/affiliate", labelKey: "affiliate", auth: "affiliate", flag: null },
  { href: "/admin", labelKey: "admin", auth: "admin_or_partnership", flag: null },
]

// Cache the flag fetch across page navs so we don't refetch on every Navbar
// remount. Module-level so it persists for the SPA session.
let cachedFlags: Record<string, boolean> | null = null
let flagsPromise: Promise<Record<string, boolean>> | null = null

function getCachedFeatureFlags(): Promise<Record<string, boolean>> {
  if (cachedFlags) return Promise.resolve(cachedFlags)
  if (flagsPromise) return flagsPromise
  flagsPromise = fetch("/api/public/feature-flags")
    .then((r) => (r.ok ? r.json() : {}))
    .then((data) => {
      cachedFlags = data
      return data
    })
    .catch(() => ({}))
  return flagsPromise
}

export default function Navbar() {
  const { data: session } = useSession()
  const pathname = usePathname()
  const t = useTranslations("Navbar")
  const { theme, toggleTheme } = useTheme()
  const [logoutOpen, setLogoutOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [featureFlags, setFeatureFlags] = useState<Record<string, boolean>>(cachedFlags ?? {})

  const isActive = (href: string) => pathname === href

  useEffect(() => { setMenuOpen(false) }, [pathname])

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : ""
    return () => { document.body.style.overflow = "" }
  }, [menuOpen])

  useEffect(() => {
    let cancelled = false
    getCachedFeatureFlags().then((flags) => {
      if (!cancelled) setFeatureFlags(flags)
    })
    return () => { cancelled = true }
  }, [])

  const visibleItems = navItems.filter((item) => {
    if (item.auth === true && !session) return false
    if (item.auth === "admin_or_partnership" &&
      session?.user?.role !== "admin" &&
      session?.user?.role !== "partnership") return false
    if (item.auth === "affiliate" && session?.user?.role !== "affiliate") return false
    // Feature-flag-gated items are hidden until we've fetched the flags AND
    // the flag is true. Defaulting to hidden means a disabled feature never
    // leaks into the nav even briefly.
    if (item.flag && !featureFlags[item.flag]) return false
    return true
  })

  const provider = session?.user?.provider

  return (
    <>
      {/* ── NAV BAR ── */}
      <motion.nav
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="sticky top-0 z-50 flex items-center justify-between px-6 md:px-10 py-4 border-b backdrop-blur-md"
        style={{
          borderColor: "var(--color-border-soft)",
          background: "var(--color-navbar-bg)"
        }}
      >
        {/* LOGO */}
        <Link
          href="/"
          className="font-display text-[20px] font-bold tracking-wide text-text-base no-underline"
        >
          A Class <span className="text-accent-light">Store</span>
        </Link>

        {/* NAV LINKS — desktop */}
        <ul className="hidden md:flex items-center gap-1 lg:gap-2 list-none m-0 p-0">
          {visibleItems.map((item) => (
            <li key={item.href}>
              <Link
                href={
                  item.href === "/admin" && session?.user?.role === "partnership"
                    ? "/admin/products"
                    : item.href
                }
                className={`text-[13.5px] px-3 py-1.5 rounded-lg transition-colors no-underline ${isActive(item.href)
                  ? "font-medium text-accent-light bg-accent/5"
                  : "text-text-muted hover:text-text-base hover:bg-white/[0.04]"
                  }`}
              >
                {t(item.labelKey)}
              </Link>
            </li>
          ))}
        </ul>

        {/* RIGHT SIDE */}
        <div className="flex items-center gap-3">
          {/* LANGUAGE SWITCHER */}
          <LanguageSwitcher />

          {/* THEME TOGGLE */}
          <button
            onClick={toggleTheme}
            className="w-9 h-9 flex items-center justify-center rounded-lg border border-accent/20 text-text-muted hover:text-accent-light hover:bg-accent/5 transition-all"
            aria-label="Toggle theme"
          >
            <AnimatePresence mode="wait" initial={false}>
              {theme === "dark" ? (
                <motion.svg
                  key="moon"
                  initial={{ y: 10, opacity: 0, rotate: 45 }}
                  animate={{ y: 0, opacity: 1, rotate: 0 }}
                  exit={{ y: -10, opacity: 0, rotate: -45 }}
                  transition={{ duration: 0.2 }}
                  width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                >
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </motion.svg>
              ) : (
                <motion.svg
                  key="sun"
                  initial={{ y: 10, opacity: 0, rotate: -45 }}
                  animate={{ y: 0, opacity: 1, rotate: 0 }}
                  exit={{ y: -10, opacity: 0, rotate: 45 }}
                  transition={{ duration: 0.2 }}
                  width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="5" />
                  <line x1="12" y1="1" x2="12" y2="3" />
                  <line x1="12" y1="21" x2="12" y2="23" />
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                  <line x1="1" y1="12" x2="3" y2="12" />
                  <line x1="21" y1="12" x2="23" y2="12" />
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                </motion.svg>
              )}
            </AnimatePresence>
          </button>

          {/* AUTH BUTTON — desktop */}
          <div className="hidden md:block">
            {!session ? (
              <Link
                href="/login"
                className="flex items-center gap-2 text-white text-on-accent text-[13px] font-medium px-5 py-2 rounded-lg no-underline transition-all hover:opacity-90 hover:scale-105 active:scale-95"
                style={{ background: "var(--color-accent)" }}
              >
                <LoginIcon />
                {t("login")}
              </Link>
            ) : (
              <button
                onClick={() => setLogoutOpen(true)}
                className="flex items-center gap-2 text-white text-on-accent text-[13px] font-medium px-5 py-2 rounded-lg cursor-pointer hover:opacity-90 hover:scale-105 active:scale-95 transition-all"
                style={{ background: providerColor(provider) }}
              >
                <ProviderIcon provider={provider} />
                {session.user?.name || t("logged_in")}
              </button>
            )}
          </div>

          {/* HAMBURGER — mobile */}
          <button
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Toggle menu"
            className="md:hidden flex flex-col justify-center items-center w-9 h-9 rounded-lg transition-colors"
            style={{ color: "var(--color-text-muted)" }}
          >
            <span
              className="block w-5 h-[1.5px] bg-current transition-all duration-300 origin-center"
              style={{ transform: menuOpen ? "translateY(4px) rotate(45deg)" : "none" }}
            />
            <span
              className="block w-5 h-[1.5px] bg-current my-[3.5px] transition-all duration-300"
              style={{ opacity: menuOpen ? 0 : 1 }}
            />
            <span
              className="block w-5 h-[1.5px] bg-current transition-all duration-300 origin-center"
              style={{ transform: menuOpen ? "translateY(-4px) rotate(-45deg)" : "none" }}
            />
          </button>
        </div>
      </motion.nav>

      {/* ── MOBILE MENU ── */}
      <AnimatePresence>
        {menuOpen && (
          <>
            {/* Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMenuOpen(false)}
              className="md:hidden fixed inset-0 z-40 backdrop-blur-[4px]"
              style={{
                background: "var(--color-overlay)",
              }}
            />

            {/* Slide-in panel */}
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="md:hidden fixed top-0 right-0 z-50 h-full w-[280px] flex flex-col"
              style={{
                background: "var(--color-bg-card)",
                borderLeft: "1px solid var(--color-border-soft)",
              }}
            >
              {/* Panel header */}
              <div
                className="flex items-center justify-between px-6 py-4 border-b"
                style={{ borderColor: "var(--color-border-soft)" }}
              >
                <span className="font-display text-[17px] font-bold" style={{ color: "var(--color-text-base)" }}>
                  Class A <span style={{ color: "var(--color-accent-light)" }}>Store</span>
                </span>
                <button
                  onClick={() => setMenuOpen(false)}
                  className="p-1.5 rounded-lg transition-colors"
                  style={{ color: "var(--color-text-muted)" }}
                  aria-label="Close menu"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>

              {/* Nav links */}
              <nav className="flex-1 px-4 py-5 flex flex-col gap-1 overflow-y-auto">
                {visibleItems.map((item) => (
                  <Link
                    key={item.href}
                    href={
                      item.href === "/admin" && session?.user?.role === "partnership"
                        ? "/admin/products"
                        : item.href
                    }
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl no-underline text-[14px] font-medium transition-all"
                    style={{
                      background: isActive(item.href) ? "rgba(66,122,181,.15)" : "transparent",
                      color: isActive(item.href) ? "var(--color-accent-light)" : "var(--color-text-muted)",
                      borderLeft: isActive(item.href) ? "2px solid var(--color-accent-light)" : "2px solid transparent",
                    }}
                  >
                    {t(item.labelKey)}
                  </Link>
                ))}
              </nav>

              {/* Auth section */}
              <div className="px-4 py-5 border-t" style={{ borderColor: "var(--color-border-soft)" }}>
                {!session ? (
                  <Link
                    href="/login"
                    onClick={() => setMenuOpen(false)}
                    className="w-full flex items-center justify-center gap-2 text-white text-on-accent text-[13px] font-medium px-5 py-3 rounded-xl no-underline transition-all hover:opacity-90 active:scale-95"
                    style={{ background: "var(--color-accent)" }}
                  >
                    <LoginIcon />
                    {t("login")}
                  </Link>
                ) : (
                  <div className="flex flex-col gap-2">
                    {/* User info */}
                    <div
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                      style={{ background: providerBg(provider) }}
                    >
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                        style={{ background: providerColor(provider) }}
                      >
                        <ProviderIcon provider={provider} size={15} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium truncate" style={{ color: "var(--color-text-base)" }}>
                          {session.user?.name || t("logged_in")}
                        </p>
                        <p className="text-[11px] truncate" style={{ color: "var(--color-text-muted)" }}>
                          {provider === "google" ? t("signed_in_google") : t("signed_in_discord")}
                        </p>
                      </div>
                    </div>
                    {/* Logout */}
                    <button
                      onClick={() => { setMenuOpen(false); setLogoutOpen(true) }}
                      className="w-full flex items-center justify-center gap-2 text-[13px] font-medium px-5 py-2.5 rounded-xl transition-colors"
                      style={{
                        background: "rgba(239,68,68,.10)",
                        border: "1px solid rgba(239,68,68,.25)",
                        color: "#f87171",
                      }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                        <polyline points="16 17 21 12 16 7" />
                        <line x1="21" y1="12" x2="9" y2="12" />
                      </svg>
                      {t("logout")}
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── LOGOUT MODAL ── */}
      <AnimatePresence>
        {logoutOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center backdrop-blur-sm"
            style={{ background: "var(--color-overlay)" }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 10 }}
              className="rounded-xl p-5 w-[320px] shadow-xl"
              style={{
                background: "var(--color-bg-card)",
                border: "1px solid var(--color-border-soft)",
              }}
            >
              <div className="flex items-center gap-2.5 mb-3">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                  style={{ background: providerColor(provider) }}
                >
                  <ProviderIcon provider={provider} size={15} />
                </div>
                <div>
                  <p className="font-semibold text-[15px] leading-tight" style={{ color: "var(--color-text-base)" }}>{t("logout")}?</p>
                  <p className="text-[11px]" style={{ color: "var(--color-text-muted)" }}>
                    {provider === "google" ? t("signed_in_google") : t("signed_in_discord")}
                  </p>
                </div>
              </div>
              <p className="text-[13px] mb-5" style={{ color: "var(--color-text-muted)" }}>
                {t("signout_confirm")}
              </p>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setLogoutOpen(false)}
                  className="px-4 py-2 text-[13px] rounded-lg transition-colors"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  {t("cancel")}
                </button>
                <button
                  onClick={() => { signOut(); setLogoutOpen(false) }}
                  className="px-4 py-2 text-[13px] rounded-lg bg-red-500 hover:bg-red-600 text-white transition"
                >
                  {t("logout")}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

// ── helpers ──────────────────────────────────────────────────────

function providerColor(provider?: string) {
  if (provider === "google") return "#4285f4"
  return "var(--color-discord)" // discord default
}

function providerBg(provider?: string) {
  if (provider === "google") return "rgba(66,133,244,.10)"
  return "rgba(88,101,242,.10)"
}

// ── icons ─────────────────────────────────────────────────────────

function ProviderIcon({ provider, size = 15 }: { provider?: string; size?: number }) {
  if (provider === "google") return <GoogleIcon size={size} />
  return <DiscordIcon size={size} />
}

function GoogleIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="white">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  )
}

function DiscordIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="white">
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z" />
    </svg>
  )
}

function LoginIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
      <polyline points="10 17 15 12 10 7" />
      <line x1="15" y1="12" x2="3" y2="12" />
    </svg>
  )
}
