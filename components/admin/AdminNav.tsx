"use client"

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

  const filteredGroups = groups.map(group => ({
    ...group,
    items: group.items.filter(item => item.roles.includes(userRole))
  })).filter(group => group.items.length > 0)

  return (
    <aside className="fixed left-0 top-0 h-screen w-56 bg-bg-card border-r border-accent/10 flex flex-col">
      {/* Logo */}
      <div className="px-5 py-6 border-b border-accent/10">
        <p className="text-[11px] tracking-widest text-text-muted uppercase mb-1">{t("admin_panel")}</p>
        <p className="font-bold text-[16px]">Game Store</p>
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
  )
}
