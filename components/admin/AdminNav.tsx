"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Link, usePathname } from "@/i18n/routing"
import { useSession } from "next-auth/react"
import { useTranslations } from "next-intl"
import { ChevronDown, Search, X } from "lucide-react"

const groups = [
  {
    title: "overview",
    items: [
      { href: "/admin", key: "dashboard", roles: ["admin"] },
      { href: "/admin/analytics", key: "analytics", roles: ["admin"] },
      { href: "/admin/visitors", key: "visitors", roles: ["admin"] },
      { href: "/admin/settings", key: "settings", roles: ["admin"] },
      { href: "/admin/announcements", key: "web_announcements", roles: ["admin"] },
    ]
  },
  {
    title: "catalog",
    items: [
      { href: "/admin/products", key: "products", roles: ["admin", "partnership"] },
      { href: "/admin/storefront-order", key: "storefront_order", roles: ["admin"] },
      { href: "/admin/game-categories", key: "game_categories", roles: ["admin"] },
      { href: "/admin/game-templates", key: "game_templates", roles: ["admin"] },
      { href: "/admin/partner-store", key: "partner_store", roles: ["admin"] },
      { href: "/admin/gifts", key: "gifts", roles: ["admin"] },
      { href: "/admin/discount-codes", key: "discount_codes", roles: ["admin"] },
      { href: "/admin/points", key: "points_nav", roles: ["admin"] },
    ]
  },
  {
    title: "revenue_sharing",
    items: [
      { href: "/admin/stripe", key: "stripe", roles: ["admin"] },
      { href: "/admin/paypal-review", key: "ppr_nav", roles: ["admin"] },
      { href: "/admin/partner-store/transactions", key: "partner_transactions", roles: ["admin"] },
      { href: "/admin/partners", key: "partners", roles: ["admin"] },
      { href: "/admin/partnership", key: "partnership_earnings", roles: ["admin"] },
      { href: "/admin/affiliates", key: "affiliates", roles: ["admin"], badge: "affiliate_requests" },
      { href: "/admin/consignment", key: "consignment", roles: ["admin"] },
    ]
  },
  {
    title: "operations",
    items: [
      { href: "/admin/orders", key: "orders", roles: ["admin", "partnership"] },
      { href: "/admin/maki-orders", key: "maki_orders", roles: ["admin"] },
      { href: "/admin/whitelist", key: "whitelist", roles: ["admin", "partnership"] },
      { href: "/admin/users", key: "users", roles: ["admin", "partnership"] },
      { href: "/admin/upgrade-premium", key: "nav_title", roles: ["admin"] },
    ]
  },
  {
    title: "desktop_program",
    items: [
      { href: "/admin/desktop", key: "desktop_dashboard", roles: ["admin"] },
      { href: "/admin/desktop/users", key: "user_monitor", roles: ["admin"] },
      { href: "/admin/desktop/plugin", key: "plugin_manage", roles: ["admin"] },
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
  const n = useTranslations("Admin.navigation")
  const { data: session } = useSession()
  const userRole = session?.user?.role || "user"
  const [open, setOpen] = useState(false)
  const [badges, setBadges] = useState<Record<string, number>>({})
  const [query, setQuery] = useState("")
  const [expanded, setExpanded] = useState<Record<string, { path: string; open: boolean }>>({})
  const searchRef = useRef<HTMLInputElement>(null)
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const closeMenu = useCallback(() => { setOpen(false); menuButtonRef.current?.focus() }, [])

  // Live counts for sidebar badges (e.g. pending withdrawal requests). Polled so
  // a new request shows up without a manual refresh.
  useEffect(() => {
    if (userRole !== "admin" && userRole !== "partnership") return
    let cancelled = false
    const load = async () => {
      try {
        const r = await fetch("/api/admin/nav-badges")
        if (r.ok && !cancelled) setBadges(await r.json())
      } catch { /* transient */ }
    }
    load()
    const iv = setInterval(load, 45_000)
    return () => { cancelled = true; clearInterval(iv) }
  }, [userRole])

  // Close the mobile drawer on route change so it doesn't stay open after navigating
  useEffect(() => {
    setOpen(false)
  }, [pathname])

  // Prevent body scroll while the mobile drawer is open
  useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow
      document.body.style.overflow = "hidden"
      const onEscape = (event: KeyboardEvent) => {
        if (event.key === "Escape") closeMenu()
      }
      window.addEventListener("keydown", onEscape)
      return () => {
        document.body.style.overflow = prev
        window.removeEventListener("keydown", onEscape)
      }
    }
  }, [open, closeMenu])

  const roleGroups = groups.map(group => ({
    ...group,
    items: group.items.filter(item => item.roles.includes(userRole))
  })).filter(group => group.items.length > 0)
  const activeHref = roleGroups.flatMap(group => group.items)
    .filter(item => pathname === item.href || (item.href !== "/admin" && item.href !== "/admin/desktop" && pathname.startsWith(item.href + "/")))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href
  const normalize = (value: string) => value.normalize("NFKC").toLowerCase()
  const term = normalize(query.trim())
  const filteredGroups = roleGroups.map(group => {
    const groupMatch = normalize(t(group.title)).includes(term)
    return { ...group, items: group.items.filter(item => !term || groupMatch || normalize(t(item.key)).includes(term)) }
  }).filter(group => group.items.length > 0)
  const clearSearch = () => { setQuery(""); searchRef.current?.focus() }

  return (
    <>
      {/* Mobile top bar — fixed, only visible below lg */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-40 h-14 bg-bg-card border-b border-accent/10 flex items-center justify-between px-4">
        <button
          ref={menuButtonRef}
          type="button"
          aria-label={n("open_menu")}
          aria-expanded={open}
          aria-controls="admin-sidebar"
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
          onClick={closeMenu}
          aria-hidden="true"
        />
      )}

      {/* Sidebar — fixed on desktop, slide-in drawer on mobile */}
      <aside
        id="admin-sidebar"
        className={`fixed top-0 left-0 z-50 h-dvh w-72 max-w-[calc(100%-48px)] lg:w-56 bg-bg-card border-r border-accent/10 flex flex-col transition-transform duration-200 motion-reduce:transition-none lg:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full max-lg:invisible"
          }`}
      >
        {/* Logo + close button (mobile only) */}
        <div className="px-5 py-6 border-b border-accent/10 flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-text-muted mb-1">{t("admin_panel")}</p>
            <p className="font-bold text-[16px]">Game Store</p>
          </div>
          <button
            type="button"
            aria-label={n("close_menu")}
            onClick={closeMenu}
            className="lg:hidden w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/5 text-text-muted -mr-2"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="border-b border-border-soft px-3 py-3">
          <div className="flex h-11 items-center gap-2 rounded-lg border border-border-soft bg-bg-input px-3 focus-within:border-accent focus-within:ring-1 focus-within:ring-accent">
            <Search size={16} className="shrink-0 text-text-muted" aria-hidden="true" />
            <input ref={searchRef} role="searchbox" aria-label={n("search_label")} placeholder={n("search_placeholder")} value={query}
              onChange={e => setQuery(e.target.value)} onKeyDown={e => { if (e.key === "Escape" && query) { e.preventDefault(); e.stopPropagation(); clearSearch() } }}
              className="min-w-0 flex-1 bg-transparent text-[13px] text-text-base outline-none placeholder:text-text-dim" />
            {query && <button type="button" onClick={clearSearch} aria-label={n("clear_search")} className="flex h-9 w-7 shrink-0 items-center justify-center rounded text-text-muted hover:text-text-base focus-visible:outline-2 focus-visible:outline-accent"><X size={15} /></button>}
          </div>
        </div>

        {/* Search opens matching groups; navigation opens the current page's group. */}
        <nav aria-label={t("admin_panel")} className="min-h-0 flex-1 px-3 py-3 space-y-2 overflow-y-auto custom-scrollbar">
          {term && filteredGroups.length > 0 && <p role="status" className="px-3 pb-1 text-xs text-text-muted">{n("result_count", { count: filteredGroups.reduce((count, group) => count + group.items.length, 0) })}</p>}
          {term && filteredGroups.length === 0 && <div className="px-3 py-5 text-sm text-text-muted"><p role="status" className="break-words">{n("no_results", { query: query.trim() })}</p><button type="button" onClick={clearSearch} className="mt-3 font-semibold text-accent-light underline underline-offset-4">{n("clear_search")}</button></div>}
          {filteredGroups.map(group => {
            const isExpanded = !!term || (expanded[group.title]?.path === pathname ? expanded[group.title].open : group.items.some(item => item.href === activeHref))
            const pendingCount = group.items.reduce((sum, item) => {
              const badgeKey = (item as { badge?: string }).badge
              return sum + (badgeKey ? (badges[badgeKey] || 0) : 0)
            }, 0)
            return <div key={group.title} className="space-y-1">
              <button type="button" aria-expanded={isExpanded} aria-controls={`admin-group-${group.title}`} disabled={!!term}
                onClick={() => setExpanded(current => ({ ...current, [group.title]: { path: pathname, open: !isExpanded } }))}
                className="flex min-h-11 w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-xs font-bold leading-5 text-text-base enabled:hover:bg-bg-base focus-visible:outline-2 focus-visible:outline-accent disabled:cursor-default">
                <span className="min-w-0 flex-1">{t(group.title)}</span>
                {!isExpanded && pendingCount > 0 && <span aria-label={n("pending_count", { count: pendingCount })} className="flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-full bg-hot px-1 text-[10px] font-bold leading-none text-on-accent">{pendingCount > 9 ? "9+" : pendingCount}</span>}
                <ChevronDown size={16} aria-hidden="true" className={`shrink-0 text-text-muted transition-transform motion-reduce:transition-none ${isExpanded ? "" : "-rotate-90"}`} />
              </button>
              <div id={`admin-group-${group.title}`} hidden={!isExpanded} className="space-y-1">
              {group.items.map((item) => {
                const { href, key } = item
                const active = href === activeHref
                const badgeKey = (item as { badge?: string }).badge
                const count = badgeKey ? (badges[badgeKey] || 0) : 0

                return (
                  <Link key={href} href={href}
                    aria-current={active ? "page" : undefined}
                    onClick={() => { setQuery(""); setOpen(false) }}
                    className={`flex min-h-11 items-center gap-2 px-3 py-2 rounded-lg text-[13px] font-medium leading-5 transition-colors focus-visible:outline-2 focus-visible:outline-accent ${active
                      ? "bg-accent/15 text-accent-light"
                      : "text-text-muted hover:bg-bg-base hover:text-text-base"
                      }`}
                  >
                    <span className="min-w-0 flex-1 break-words">{t(key)}</span>
                    {count > 0 && (
                      <span className="shrink-0 min-w-[18px] h-[18px] px-1 rounded-full bg-hot text-on-accent text-[10px] font-bold flex items-center justify-center leading-none">
                        {count > 9 ? "9+" : count}
                      </span>
                    )}
                    {active && (
                      <span aria-hidden="true" className="shrink-0 w-1 h-3 rounded-full bg-accent-light" />
                    )}
                  </Link>
                )
              })}
              </div>
            </div>
          })}
        </nav>

        {/* Bottom */}
        <div className="px-4 py-4 border-t border-accent/10 bg-bg-card">
          <Link href="/" className="flex min-h-11 items-center gap-2 text-[13px] text-text-muted hover:text-text-base transition-colors">
            {t("back_to_store")}
          </Link>
        </div>
      </aside>
    </>
  )
}
