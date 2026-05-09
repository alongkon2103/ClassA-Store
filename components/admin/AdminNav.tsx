"use client"

import { Link, usePathname } from "@/i18n/routing"

import { useTranslations } from "next-intl"

const links = [
  { href: "/admin", key: "dashboard", icon: "" },
  { href: "/admin/analytics", key: "analytics", icon: "" },
  { href: "/admin/products", key: "products", icon: "" },
  { href: "/admin/consignment", key: "consignment", icon: "" },
  // { href: "/admin/keys",       key: "game_keys",   icon: "" },
  { href: "/admin/orders", key: "orders", icon: "" },
  { href: "/admin/users", key: "users", icon: "" },
  { href: "/admin/gifts", key: "gifts", icon: "" },

  { href: "/admin/tiktok-simulator", key: "tiktok simulator", icon: "" },
]

export default function AdminNav() {
  const pathname = usePathname()
  const t = useTranslations("Admin")

  return (
    <aside className="fixed left-0 top-0 h-screen w-56 bg-bg-card border-r border-accent/10 flex flex-col">
      {/* Logo */}
      <div className="px-5 py-6 border-b border-accent/10">
        <p className="text-[11px] tracking-widest text-text-muted uppercase mb-1">{t("admin_panel")}</p>
        <p className="font-bold text-[16px]">Game Store</p>
      </div>

      {/* Nav Links */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {links.map(({ href, key, icon }) => {
          const active = href === "/admin"
            ? pathname === "/admin"
            : pathname.startsWith(href)

          return (
            <Link key={href} href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all ${active
                  ? "bg-accent/15 text-accent-light"
                  : "text-text-muted hover:bg-white/5 hover:text-text-base"
                }`}
            >
              <span className="text-base">{icon}</span>
              {t(key)}
              {active && (
                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-accent-light" />
              )}
            </Link>
          )
        })}
      </nav>

      {/* Bottom */}
      <div className="px-4 py-4 border-t border-accent/10">
        <Link href="/" className="flex items-center gap-2 text-[12px] text-text-muted hover:text-text-base transition">
          <span>←</span> {t("back_to_store")}
        </Link>
      </div>
    </aside>
  )
}
