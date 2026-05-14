"use client"

import { useState, useMemo } from "react"
import { useRouter } from "@/i18n/routing"
import { format } from "date-fns"
import { useTranslations, useLocale } from "next-intl"
import { th, enUS } from "date-fns/locale"

export default function UsersClient({ users }: { users: any[] }) {
  const t = useTranslations("Admin")
  const locale = useLocale()
  const dateLocale = locale === "th" ? th : enUS
  const router = useRouter()

  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState<"all" | "admin" | "user">("all")
  const [loadingId, setLoadingId] = useState<string | null>(null)

  const filtered = useMemo(() => {
    return users
      .filter((u) => filter === "all" || u.role === filter)
      .filter((u) =>
        u.username.toLowerCase().includes(search.toLowerCase()) ||
        (u.email ?? "").toLowerCase().includes(search.toLowerCase())
      )
  }, [users, search, filter])

  const handleRoleToggle = async (id: string, current: string) => {
    const newRole = current === "admin" ? "user" : "admin"
    if (!confirm(t("change_role_confirm", { role: newRole }))) return
    setLoadingId(id)
    await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: newRole }),
    })
    setLoadingId(null)
    router.refresh()
  }

  const handleDelete = async (id: string) => {
    if (!confirm(t("delete_user_confirm"))) return
    setLoadingId(id)
    await fetch(`/api/admin/users/${id}`, { method: "DELETE" })
    setLoadingId(null)
    router.refresh()
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-[24px] font-bold">{t("users")}</h1>
        <p className="text-text-muted text-[13px] mt-0.5">{users.length} {t("total")}</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("search_users")}
          className="flex-1 min-w-[200px] bg-bg-card border border-accent/15 rounded-xl px-4 py-2.5 text-[13px] placeholder:text-text-muted outline-none focus:border-accent/40"
        />
        <div className="flex gap-1 bg-bg-card border border-accent/15 rounded-xl p-1">
          {(["all", "admin", "user"] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition capitalize ${filter === f ? "bg-accent/20 text-accent-light" : "text-text-muted hover:text-text-base"
                }`}>
              {t(f)}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-bg-card border border-accent/10 rounded-2xl overflow-hidden">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="text-left text-[11px] text-text-muted border-b border-white/5 bg-white/[0.02]">
              <th className="px-5 py-3.5 font-medium">{t("user")}</th>
              <th className="px-4 py-3.5 font-medium">{t("provider")}</th>
              <th className="px-4 py-3.5 font-medium">{t("orders")}</th>
              <th className="px-4 py-3.5 font-medium">{t("role")}</th>
              <th className="px-4 py-3.5 font-medium">{t("joined")}</th>
              <th className="px-4 py-3.5 font-medium">{t("actions")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center py-12 text-text-muted">{t("no_users")}</td>
              </tr>
            )}
            {filtered.map((u) => (
              <tr key={u.id} className="hover:bg-white/[0.02] transition">
                {/* User */}
                <td className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    {u.avatar ? (
                      <img src={u.avatar} className="w-8 h-8 rounded-full object-cover" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center text-[13px] font-bold text-accent-light">
                        {u.username?.[0]?.toUpperCase()}
                      </div>
                    )}
                    <div>
                      <p className="font-medium">{u.username}</p>
                      <p className="text-[11px] text-text-muted">{u.email ?? "—"}</p>
                    </div>
                  </div>
                </td>

                {/* Provider */}
                <td className="px-4 py-4">
                  <div className="flex gap-1 flex-wrap">
                    {u.accounts.map((a: any) => (
                      <span key={a.provider}
                        className="text-[11px] px-2 py-0.5 rounded-full bg-accent/10 text-accent-light capitalize">
                        {a.provider}
                      </span>
                    ))}
                  </div>
                </td>

                {/* Orders */}
                <td className="px-4 py-4 text-text-muted">
                  {u._count.orders}
                </td>

                {/* Role */}
                <td className="px-4 py-4">
                  <span className={`text-[11px] px-2.5 py-1 rounded-full font-medium ${u.role === "admin"
                      ? "bg-purple-500/15 text-purple-400"
                      : "bg-white/5 text-text-muted"
                    }`}>
                    {u.role}
                  </span>
                </td>

                {/* Joined */}
                <td className="px-4 py-4 text-text-muted whitespace-nowrap">
                  {u.created_at ? format(new Date(u.created_at), "dd MMM yyyy", { locale: dateLocale }) : "—"}
                </td>

                {/* Actions */}
                <td className="px-4 py-4">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleRoleToggle(u.id, u.role)}
                      disabled={loadingId === u.id}
                      className="text-[12px] px-3 py-1.5 rounded-lg border border-accent/20 text-accent-light hover:bg-accent/10 transition disabled:opacity-40"
                    >
                      {u.role === "admin" ? "→ User" : "→ Admin"}
                    </button>
                    {/* <div className="flex items-center gap-3">
                      <button
                        type="button"
                        disabled={loadingId === u.id}
                        onClick={() => handleRoleToggle(u.id, u.role)}
                        className={`
      relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full
      transition-all duration-200 border-2
      ${u.role === "admin"
                            ? "bg-accent border-accent"
                            : "bg-slate-300 border-slate-400 dark:bg-zinc-700 dark:border-zinc-600"}
      ${loadingId === u.id ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}
    `}
                      >
                        <span
                          className={`
        inline-block h-4 w-4 rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.3)]
        transform transition-transform duration-200 ease-in-out
        ${u.role === "admin" ? "translate-x-5" : "translate-x-1"}
      `}
                        />
                      </button>
                    </div> */}
                    <button
                      onClick={() => handleDelete(u.id)}
                      disabled={loadingId === u.id}
                      className="text-[12px] px-3 py-1.5 rounded-lg border border-red-500/20 text-red-400 hover:bg-red-500/10 transition disabled:opacity-40"
                    >
                      {loadingId === u.id ? "..." : t("delete")}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
