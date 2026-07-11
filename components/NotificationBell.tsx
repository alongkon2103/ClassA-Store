"use client"

// In-app notification bell for affiliates. Polls /api/notifications, shows an
// unread badge, and drops down a localized list. Opening the panel marks
// everything read (the items stay in the list, just lose the "unread" accent).
// Only rendered for users with the affiliate role.

import { useCallback, useEffect, useRef, useState } from "react"
import { useSession } from "next-auth/react"
import { useTranslations } from "next-intl"
import { motion, AnimatePresence } from "framer-motion"
import { useRouter } from "@/i18n/routing"

type Notif = {
  id: string
  type: string
  data: { amount?: number; reason?: string } | Record<string, unknown>
  link: string | null
  read: boolean
  created_at: string
}

const baht = (n: unknown) => Number(n ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })

export default function NotificationBell() {
  const { data: session } = useSession()
  const t = useTranslations("Notifications")
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<Notif[]>([])
  const [unread, setUnread] = useState(0)
  const wrapRef = useRef<HTMLDivElement>(null)

  const isAffiliate = session?.user?.role === "affiliate"

  const refetch = useCallback(async () => {
    try {
      const r = await fetch("/api/notifications")
      if (!r.ok) return
      const j = await r.json()
      setItems(j.items ?? [])
      setUnread(j.unread ?? 0)
    } catch { /* offline / transient — keep last state */ }
  }, [])

  // Poll while mounted; also refetch when the tab regains focus.
  useEffect(() => {
    if (!isAffiliate) return
    refetch()
    const iv = setInterval(refetch, 45_000)
    const onFocus = () => refetch()
    window.addEventListener("focus", onFocus)
    return () => { clearInterval(iv); window.removeEventListener("focus", onFocus) }
  }, [isAffiliate, refetch])

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false) }
    document.addEventListener("mousedown", onDown)
    document.addEventListener("keydown", onKey)
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey) }
  }, [open])

  const markAllRead = useCallback(async () => {
    if (unread === 0) return
    setUnread(0)
    setItems((prev) => prev.map((n) => ({ ...n, read: true })))
    try { await fetch("/api/notifications", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }) }
    catch { /* best-effort; next poll reconciles */ }
  }, [unread])

  const toggle = () => {
    const next = !open
    setOpen(next)
    if (next) markAllRead()
  }

  const openItem = (n: Notif) => {
    setOpen(false)
    if (n.link) router.push(n.link)
  }

  if (!isAffiliate) return null

  const content = (n: Notif) => {
    const d = n.data as { amount?: number; reason?: string }
    switch (n.type) {
      case "payout_paid":
        return { icon: "check", tone: "green", title: t("payout_paid_title"), body: t("payout_paid_body", { amount: baht(d.amount) }) }
      case "payout_rejected":
        return { icon: "x", tone: "red", title: t("payout_rejected_title"), body: t("payout_rejected_body", { amount: baht(d.amount), reason: d.reason || "-" }) }
      case "commission_earned":
        return { icon: "coin", tone: "amber", title: t("commission_earned_title"), body: t("commission_earned_body", { amount: baht(d.amount) }) }
      default:
        return { icon: "coin", tone: "amber", title: n.type, body: "" }
    }
  }

  const relTime = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime()
    const m = Math.floor(diff / 60000)
    if (m < 1) return t("just_now")
    if (m < 60) return t("minutes_ago", { n: m })
    const h = Math.floor(m / 60)
    if (h < 24) return t("hours_ago", { n: h })
    return t("days_ago", { n: Math.floor(h / 24) })
  }

  return (
    <div ref={wrapRef} className="relative">
      <button
        onClick={toggle}
        aria-label={t("title")}
        className="relative w-9 h-9 flex items-center justify-center rounded-lg border border-accent/20 text-text-muted hover:text-accent-light hover:bg-accent/5 transition-all"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[17px] h-[17px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center leading-none ring-2 ring-[var(--color-navbar-bg)]">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 mt-2 w-[320px] max-w-[calc(100vw-2rem)] rounded-2xl bg-bg-card border border-accent/15 shadow-xl z-50 overflow-hidden"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-accent/10">
              <p className="text-[13px] font-semibold">{t("title")}</p>
            </div>
            <div className="max-h-[380px] overflow-y-auto custom-scrollbar">
              {items.length === 0 ? (
                <p className="text-center text-[13px] text-text-muted py-10">{t("empty")}</p>
              ) : (
                items.map((n) => {
                  const c = content(n)
                  return (
                    <button
                      key={n.id}
                      onClick={() => openItem(n)}
                      className={`w-full text-left flex gap-3 px-4 py-3 border-b border-accent/[0.06] last:border-0 transition-colors hover:bg-accent/[0.04] ${n.read ? "" : "bg-accent/[0.03]"}`}
                    >
                      <span className={`mt-0.5 w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${TONE[c.tone]}`}>
                        <NotifIcon name={c.icon} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="text-[13px] font-medium truncate">{c.title}</span>
                          {!n.read && <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />}
                        </span>
                        <span className="block text-[12px] text-text-muted mt-0.5 leading-snug">{c.body}</span>
                        <span className="block text-[11px] text-text-muted/70 mt-1">{relTime(n.created_at)}</span>
                      </span>
                    </button>
                  )
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

const TONE: Record<string, string> = {
  green: "bg-green-500/12 text-green-400",
  red: "bg-red-500/12 text-red-400",
  amber: "bg-amber-500/12 text-amber-400",
}

function NotifIcon({ name }: { name: string }) {
  const p = { width: 15, height: 15, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const }
  if (name === "check") return <svg {...p}><polyline points="20 6 9 17 4 12" /></svg>
  if (name === "x") return <svg {...p}><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
  return <svg {...p}><circle cx="12" cy="12" r="8" /><path d="M14.8 9a2 2 0 0 0-1.8-1h-1.5a1.7 1.7 0 0 0 0 3.4h1a1.7 1.7 0 0 1 0 3.4H11a2 2 0 0 1-1.8-1" /><path d="M12 7v1" /><path d="M12 16v1" /></svg>
}
