"use client"
import { localeTag } from "@/lib/i18n/locale"

// หน้า "ข้อมูลบัญชี" — แก้ได้แค่ชื่อที่แสดง (อีเมล/รูปมาจาก Discord/Google)
import { useState } from "react"
import { useLocale, useTranslations } from "next-intl"
import { Link, useRouter } from "@/i18n/routing"

type User = { username: string; email: string | null; avatar: string | null; role: string; created_at: string | null }

export default function AccountInfoClient({ user, provider, stats }: {
  user: User
  provider: string | null
  stats: { orders: number; favorites: number; reviews: number }
}) {
  const t = useTranslations("Account")
  const locale = useLocale()
  const router = useRouter()
  const [name, setName] = useState(user.username)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const initial = (user.username || "A").trim()[0]?.toUpperCase() ?? "A"
  const since = user.created_at
    ? new Date(user.created_at).toLocaleDateString(localeTag(locale), { day: "numeric", month: "short", year: "numeric" })
    : "—"
  const roleLabel = ({ admin: t("role_admin"), affiliate: t("role_affiliate"), partnership: t("role_partnership") } as Record<string, string>)[user.role] ?? t("role_user")
  const providerLabel = provider === "discord" ? "Discord" : provider === "google" ? "Google" : provider ? provider : "—"

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    const v = name.trim()
    if (v.length < 2 || v.length > 32) { setMsg({ ok: false, text: t("name_invalid") }); return }
    setBusy(true); setMsg(null)
    try {
      const r = await fetch("/api/account", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: v }) })
      if (r.ok) { setMsg({ ok: true, text: t("saved") }); router.refresh() }
      else setMsg({ ok: false, text: t("save_error") })
    } finally { setBusy(false) }
  }

  const field = "w-full px-4 py-2.5 rounded-lg border border-border-soft bg-bg-input text-text-base text-[0.85rem] outline-none focus:border-accent transition-colors"
  const label = "block text-[0.72rem] font-semibold text-text-dim uppercase tracking-[0.04em] mb-1.5"

  return (
    <div>
      <h1 className="text-[1.2rem] sm:text-[1.5rem] font-black mb-5">{t("info_title")}</h1>

      {/* โปรไฟล์ */}
      <div className="bg-bg-card border border-border-soft rounded-[14px] p-6 mb-4">
        <div className="flex items-center gap-4 mb-6">
          {user.avatar ? (
            <img src={user.avatar} alt="" className="w-[72px] h-[72px] rounded-full object-cover" />
          ) : (
            <div className="w-[72px] h-[72px] rounded-full flex items-center justify-center text-[1.4rem] font-extrabold text-white text-on-accent"
                 style={{ background: "linear-gradient(135deg,var(--color-accent),var(--color-accent-lighter))" }}>{initial}</div>
          )}
          <div className="min-w-0">
            <div className="text-[1.05rem] font-bold truncate">{user.username}</div>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="px-2.5 py-[3px] rounded-md text-[0.65rem] font-bold bg-accent/[0.12] text-accent-lighter border border-accent/15">{roleLabel}</span>
              <span className="text-[0.72rem] text-text-dim">{t("member_since")} {since}</span>
            </div>
          </div>
        </div>

        <form onSubmit={save} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={label}>{t("display_name")}</label>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={32} className={field} />
          </div>
          <div>
            <label className={label}>{t("email")}</label>
            <input value={user.email ?? "—"} readOnly className={`${field} opacity-70 cursor-not-allowed`} />
          </div>
          <div>
            <label className={label}>{t("login_via")}</label>
            <input value={providerLabel} readOnly className={`${field} opacity-70 cursor-not-allowed`} />
          </div>
          <div className="flex items-end gap-3">
            <button type="submit" disabled={busy || name.trim() === user.username}
                    className="px-6 py-2.5 rounded-lg bg-accent hover:bg-accent-light text-white text-[0.82rem] font-semibold disabled:opacity-50 transition-colors">
              {busy ? t("saving") : t("save")}
            </button>
            {msg && <span className={`text-[0.78rem] ${msg.ok ? "text-success" : "text-hot"}`}>{msg.text}</span>}
          </div>
        </form>
      </div>

      {/* สถิติ → ลิงก์ไปหน้าที่เกี่ยวข้อง */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { href: "/orders", n: stats.orders, label: t("stat_orders") },
          { href: "/account/favorites", n: stats.favorites, label: t("stat_favorites") },
          { href: "/account/reviews", n: stats.reviews, label: t("stat_reviews") },
        ].map((x) => (
          <Link key={x.href} href={x.href} className="bg-bg-card border border-border-soft rounded-[14px] p-5 hover:border-accent/40 transition-colors">
            <div className="text-[1.6rem] font-black text-accent-light leading-none mb-1">{x.n}</div>
            <div className="text-[0.78rem] text-text-muted">{x.label}</div>
          </Link>
        ))}
      </div>
    </div>
  )
}
