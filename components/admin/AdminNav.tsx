"use client"

import { useEffect, useState } from "react"
import { Link, usePathname } from "@/i18n/routing"
import { useSession } from "next-auth/react"
import { useTranslations } from "next-intl"

const groups = [
  {
    title: "overview",
    items: [
      { href: "/admin", key: "dashboard", roles: ["admin"] },
      { href: "/admin/analytics", key: "analytics", roles: ["admin"] },
      { href: "/admin/visitors", key: "visitors", roles: ["admin"] },
      { href: "/admin/settings", key: "settings", roles: ["admin"] },
    ]
  },
  {
    title: "catalog",
    items: [
      { href: "/admin/products", key: "products", roles: ["admin", "partnership"] },
      { href: "/admin/gifts", key: "gifts", roles: ["admin"] },
      { href: "/admin/discount-codes", key: "discount_codes", roles: ["admin"] },
    ]
  },
  {
    title: "revenue_sharing",
    items: [
      { href: "/admin/partners", key: "partners", roles: ["admin"] },
      { href: "/admin/partnership", key: "partnership_earnings", roles: ["admin"] },
      { href: "/admin/consignment", key: "consignment", roles: ["admin"] },
    ]
  },
  {
    title: "operations",
    items: [
      { href: "/admin/whitelist", key: "whitelist", roles: ["admin", "partnership"] },
      { href: "/admin/orders", key: "orders", roles: ["admin", "partnership"] },
      { href: "/admin/users", key: "users", roles: ["admin", "partnership"] },
      { href: "/admin/upgrade-premium", key: "nav_title", roles: ["admin"] },
    ]
  },
  {
    title: "desktop_program",
    items: [
      { href: "/admin/desktop", key: "desktop_dashboard", roles: ["admin"] },
      { href: "/admin/desktop/users", key: "user_monitor", roles: ["admin"] },
      { href: "/admin/desktop/announcements", key: "announcements", roles: ["admin"] },
    ]
  },
  {
    title: "tools",
    items: [
      { href: "/admin/tiktok-simulator", key: "tiktok_simulator", roles: ["admin"] },
    ]
  }
]

export default function AdminNav() {
  const pathname = usePathname()
  const t = useTranslations("Admin")
  const { data: session } = useSession()
  const userRole = session?.user?.role || "user"
  const [open, setOpen] = useState(false)

  // Close the mobile drawer on route change so it doesn't stay open after navigating
  useEffect(() => {
    setOpen(false)
  }, [pathname])

  // Prevent body scroll while the mobile drawer is open
  useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow
      document.body.style.overflow = "hidden"
      return () => {
        document.body.style.overflow = prev
      }
    }
  }, [open])

  const filteredGroups = groups.map(group => ({
    ...group,
    items: group.items.filter(item => item.roles.includes(userRole))
  })).filter(group => group.items.length > 0)

  return (
    <>
      {/* Mobile top bar — fixed, only visible below lg */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-40 h-14 bg-bg-card border-b border-accent/10 flex items-center justify-between px-4">
        <button
          aria-label="Open admin menu"
          onClick={() => setOpen(true)}
          className="w-10 h-10 -ml-2 flex items-center justify-center rounded-lg hover:bg-white/5 text-text-base"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
        <div className="text-center">
          <p className="text-[9px] tracking-widest text-text-muted uppercase leading-none">
            {t("admin_panel")}
          </p>
          <p className="font-bold text-[14px] leading-tight">Game Store</p>
        </div>
        {/* Spacer to balance the menu button so the title centres */}
        <span className="w-10" aria-hidden="true" />
      </header>

      {/* Mobile drawer overlay */}
      {open && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar — fixed on desktop, slide-in drawer on mobile */}
      <aside
        className={`fixed top-0 left-0 z-50 h-screen w-56 bg-bg-card border-r border-accent/10 flex flex-col transition-transform duration-200 lg:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"
          }`}
      >
        {/* Logo + close button (mobile only) */}
        <div className="px-5 py-6 border-b border-accent/10 flex items-start justify-between">
          <div>
            <p className="text-[11px] tracking-widest text-text-muted uppercase mb-1">{t("admin_panel")}</p>
            <p className="font-bold text-[16px]">Game Store</p>
          </div>
          <button
            aria-label="Close admin menu"
            onClick={() => setOpen(false)}
            className="lg:hidden w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/5 text-text-muted -mr-2"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Nav Links */}
        <nav className="flex-1 px-3 py-4 space-y-6 overflow-y-auto custom-scrollbar">
          {filteredGroups.map((group, gIdx) => (
            <div key={gIdx} className="space-y-1">
              <p className="px-3 text-[10px] font-bold text-text-muted uppercase tracking-wider mb-2 opacity-50">
                {t(group.title) || group.title.replace("_", " ")}
              </p>
              {group.items.map(({ href, key }) => {
                const active = (href === "/admin" || href === "/admin/desktop")
                  ? pathname === href
                  : pathname.startsWith(href)

                return (
                  <Link key={href} href={href}
                    className={`flex items-center gap-3 px-4 py-2 rounded-xl text-[13px] font-medium transition-all ${active
                      ? "bg-accent/15 text-accent-light"
                      : "text-text-muted hover:bg-white/5 hover:text-text-base"
                      }`}
                  >
                    <span className="truncate">{t(key)}</span>
                    {active && (
                      <span className="ml-auto w-1 h-3 rounded-full bg-accent-light" />
                    )}
                  </Link>
                )
              })}
            </div>
          ))}
        </nav>

        {/* Bottom */}
        <div className="px-4 py-4 border-t border-accent/10 bg-bg-card">
          <Link href="/" className="flex items-center gap-2 text-[12px] text-text-muted hover:text-text-base transition">
            {t("back_to_store")}
          </Link>
        </div>
      </aside>
    </>
  )
}
