"use client"

import React, { useState, useMemo } from "react"
import { useRouter } from "@/i18n/routing"
import { format } from "date-fns"
import { useTranslations, useLocale } from "next-intl"
import { th, enUS } from "date-fns/locale"
import { Monitor, RefreshCcw, Search, Shield, LogOut } from "lucide-react"
import type { Role } from "@prisma/client"

type DesktopUser = {
  id: string
  username: string
  email: string | null
  avatar: string | null
  role: Role
  hwid: string | null
  lastSeen: Date | null
  isOnlineDesktop: boolean
  nativeStatus: string
}

export default function DesktopUsersClient({ users }: { users: DesktopUser[] }) {
  const t = useTranslations("Admin")
  const locale = useLocale()
  const dateLocale = locale === "th" ? th : enUS
  const router = useRouter()
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState<"all" | "online" | "offline">("all")
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [kickingId, setKickingId] = useState<string | null>(null)

  const filtered = useMemo(() => {
    return users
      .filter((u) => {
        if (filter === "online") return u.isOnlineDesktop
        if (filter === "offline") return !u.isOnlineDesktop
        return true
      })
      .filter((u) =>
        u.username.toLowerCase().includes(search.toLowerCase()) ||
        (u.email ?? "").toLowerCase().includes(search.toLowerCase()) ||
        (u.hwid ?? "").toLowerCase().includes(search.toLowerCase())
      )
  }, [users, search, filter])

  const handleResetHWID = async (id: string, username: string) => {
    if (!confirm(`Reset HWID for ${username}?`)) return
    setLoadingId(id)
    try {
      const res = await fetch(`/api/admin/desktop/users/${id}/reset-hwid`, {
        method: "POST",
      })
      if (res.ok) {
        router.refresh()
      }
    } catch (error) {
      console.error(error)
    } finally {
      setLoadingId(null)
    }
  }

  const handleKick = async (id: string, username: string) => {
    if (!confirm(`Kick ${username} from desktop app?`)) return
    setKickingId(id)
    try {
      const res = await fetch(`/api/admin/desktop/users/${id}/kick`, {
        method: "POST",
      })
      if (res.ok) {
        router.refresh()
      }
    } catch (error) {
      console.error(error)
    } finally {
      setKickingId(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[24px] font-bold flex items-center gap-3">
            <Monitor className="text-accent" />
            {t("user_monitor")}
          </h1>
          <p className="text-text-muted text-[13px] mt-0.5">{users.length} {t("total")}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[300px]">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" size={16} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search username, email, or HWID..."
            className="w-full bg-bg-card border border-accent/15 rounded-xl pl-11 pr-4 py-2.5 text-[13px] placeholder:text-text-muted outline-none focus:border-accent/40"
          />
        </div>
        <div className="flex gap-1 bg-bg-card border border-accent/15 rounded-xl p-1">
          <button onClick={() => setFilter("all")}
            className={`px-4 py-1.5 rounded-lg text-[12px] font-medium transition ${filter === "all" ? "bg-accent/20 text-accent-light" : "text-text-muted hover:text-text-base"}`}>
            {t("all")}
          </button>
          <button onClick={() => setFilter("online")}
            className={`px-4 py-1.5 rounded-lg text-[12px] font-medium transition ${filter === "online" ? "bg-green-500/20 text-green-400" : "text-text-muted hover:text-text-base"}`}>
            Online
          </button>
          <button onClick={() => setFilter("offline")}
            className={`px-4 py-1.5 rounded-lg text-[12px] font-medium transition ${filter === "offline" ? "bg-red-500/20 text-red-400" : "text-text-muted hover:text-text-base"}`}>
            Offline
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-bg-card border border-accent/10 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-[13px] min-w-[700px]">
          <thead>
            <tr className="text-left text-[11px] text-text-muted border-b border-white/5 bg-white/[0.02]">
              <th className="px-5 py-3.5 font-medium">{t("user")}</th>
              <th className="px-4 py-3.5 font-medium">Status</th>
              <th className="px-4 py-3.5 font-medium">HWID</th>
              <th className="px-4 py-3.5 font-medium">Last Active</th>
              <th className="px-4 py-3.5 font-medium text-right">{t("actions")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center py-12 text-text-muted">No users found</td>
              </tr>
            )}
            {filtered.map((u) => (
              <tr key={u.id} className="hover:bg-white/[0.02] transition">
                {/* User */}
                <td className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    {u.avatar ? (
                      <img src={u.avatar} className="w-9 h-9 rounded-full object-cover border border-white/10" />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-accent/20 flex items-center justify-center text-[14px] font-bold text-accent-light">
                        {u.username?.[0]?.toUpperCase()}
                      </div>
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-bold">{u.username}</p>
                        {u.role === "admin" && <Shield size={12} className="text-purple-400" />}
                      </div>
                      <p className="text-[11px] text-text-muted">{u.email ?? "—"}</p>
                    </div>
                  </div>
                </td>

                {/* Status */}
                <td className="px-4 py-4">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${u.isOnlineDesktop ? "bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]" : "bg-white/20"}`} />
                    <span className={`text-[11px] font-bold uppercase tracking-wider ${u.isOnlineDesktop ? "text-green-400" : "text-text-muted"}`}>
                      {u.isOnlineDesktop ? "Online" : "Offline"}
                    </span>
                  </div>
                </td>

                {/* HWID */}
                <td className="px-4 py-4">
                  {u.hwid ? (
                    <code className="text-[10px] bg-white/5 px-2 py-1 rounded border border-white/5 text-text-muted truncate max-w-[120px] inline-block">
                      {u.hwid}
                    </code>
                  ) : (
                    <span className="text-[11px] text-text-muted/40 italic">Not Bound</span>
                  )}
                </td>

                {/* Last Active */}
                <td className="px-4 py-4">
                  <p className="text-[11px] font-medium">
                    {u.lastSeen ? format(new Date(u.lastSeen), "dd MMM HH:mm", { locale: dateLocale }) : "Never"}
                  </p>
                  <p className="text-[10px] text-text-muted capitalize">{u.nativeStatus?.toLowerCase()}</p>
                </td>

                {/* Actions */}
                <td className="px-4 py-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => handleKick(u.id, u.username)}
                      disabled={kickingId === u.id || !u.isOnlineDesktop}
                      className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider px-4 py-2 rounded-xl border border-amber-500/20 text-amber-400 hover:bg-amber-500/10 transition disabled:opacity-30 disabled:hover:bg-transparent"
                      title="Kick User"
                    >
                      {kickingId === u.id ? (
                        <RefreshCcw size={14} className="animate-spin" />
                      ) : (
                        <LogOut size={14} />
                      )}
                      Kick
                    </button>
                    <button
                      onClick={() => handleResetHWID(u.id, u.username)}
                      disabled={loadingId === u.id || !u.hwid}
                      className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider px-4 py-2 rounded-xl border border-red-500/20 text-red-400 hover:bg-red-500/10 transition disabled:opacity-30 disabled:hover:bg-transparent"
                    >
                      {loadingId === u.id ? (
                        <RefreshCcw size={14} className="animate-spin" />
                      ) : (
                        <RefreshCcw size={14} />
                      )}
                      Reset HWID
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  )
}
