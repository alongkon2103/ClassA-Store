"use client"

// ปุ่มรับแต้มรายวัน (วันละครั้ง รีเซ็ตเที่ยงคืนเวลาไทย) — 3 ขนาด:
//   icon    = ไอคอนของขวัญบน Navbar โชว์ตลอด (ทอง = ยังไม่รับ · ขาว = รับแล้ว) กดแล้วเปิดหน้าต่างปฏิทิน Daily Login
//   compact = ปุ่มใต้ป้าย AC Points ใน sidebar บัญชี
//   card    = การ์ดใหญ่ในหน้า Coins ของฉัน พร้อมนับถอยหลังถึงเที่ยงคืน
// หลายตัวบนหน้าเดียวกัน sync กันผ่าน event + router.refresh() ให้ยอดแต้มฝั่ง server อัปเดต
import { useCallback, useEffect, useState } from "react"
import { useTranslations } from "next-intl"
import { useRouter } from "@/i18n/routing"

export type DailyStatusView = {
  enabled: boolean; points: number; claimedToday: boolean; nextResetAt: string; signedIn: boolean
  todayKey: string; streak: number; week: { key: string; claimed: boolean }[]
}
type Status = DailyStatusView
const EVT = "daily-points-changed"

// หลายตัวบนหน้าเดียวกันขอสถานะพร้อมกัน → ใช้ request เดียว (เก็บไว้ 3 วิ)
let shared: { at: number; p: Promise<Status | null> } | null = null
function fetchStatus(force = false): Promise<Status | null> {
  if (!force && shared && Date.now() - shared.at < 3000) return shared.p
  const p = fetch("/api/points/daily", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).catch(() => null)
  shared = { at: Date.now(), p }
  return p
}
// ให้หน้าต่าง Daily Login ใช้ cache + event เดียวกัน (กดรับที่ไหนก็ sync ทุกปุ่ม)
export const fetchDailyStatus = (force = false) => fetchStatus(force)
export function notifyDailyChanged() {
  shared = null
  window.dispatchEvent(new Event(EVT))
}
// ไอคอนบน Navbar ขอเปิดหน้าต่างปฏิทิน (DailyLoginPopup ฟัง event นี้) — ดูซ้ำได้ทั้งวัน ไม่ว่าจะรับแล้วหรือยัง
export const DAILY_POPUP_OPEN_EVT = "daily-popup-open"
export const openDailyPopup = () => window.dispatchEvent(new Event(DAILY_POPUP_OPEN_EVT))

const GiftIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 12 20 22 4 22 4 12" /><rect x="2" y="7" width="20" height="5" /><line x1="12" y1="22" x2="12" y2="7" />
    <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" /><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
  </svg>
)

export function useCountdown(target: string | null, active: boolean) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!active) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [active])
  if (!target) return null
  const ms = Math.max(0, new Date(target).getTime() - now)
  const h = Math.floor(ms / 3600_000), m = Math.floor((ms % 3600_000) / 60_000), s = Math.floor((ms % 60_000) / 1000)
  return { ms, text: `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` }
}

export default function DailyClaim({ variant }: { variant: "icon" | "compact" | "card" }) {
  const t = useTranslations("Account")
  const router = useRouter()
  const [st, setSt] = useState<Status | null>(null)
  const [busy, setBusy] = useState(false)
  const [flash, setFlash] = useState<number | null>(null) // แต้มที่เพิ่งได้ (โชว์แป๊บเดียว)
  const [err, setErr] = useState(false)

  const load = useCallback((force = false) => { fetchStatus(force).then((d) => d && setSt(d)) }, [])
  useEffect(() => { load() }, [load])
  useEffect(() => {
    const on = () => load(true)
    window.addEventListener(EVT, on)
    return () => window.removeEventListener(EVT, on)
  }, [load])

  const claimed = !!st?.claimedToday
  const cd = useCountdown(st?.nextResetAt ?? null, variant === "card" && claimed)
  // ข้ามเที่ยงคืนตอนเปิดหน้าค้างไว้ → ถามสถานะใหม่ (ได้สิทธิ์วันใหม่)
  useEffect(() => { if (cd && cd.ms === 0 && claimed) load(true) }, [cd, claimed, load])

  const claim = async () => {
    if (busy || !st || claimed) return
    setBusy(true); setErr(false)
    try {
      const r = await fetch("/api/points/daily", { method: "POST" })
      const d = await r.json().catch(() => ({}))
      if (r.ok || d.error === "already_claimed") {
        setSt((s) => (s ? { ...s, ...d, claimedToday: true } : s))
        if (r.ok) { setFlash(d.points); setTimeout(() => setFlash(null), 2500) }
        notifyDailyChanged()
        router.refresh() // ยอดแต้มใน sidebar / หน้า Coins มาจาก server
      } else setErr(true)
    } catch { setErr(true) } finally { setBusy(false) }
  }

  if (!st || !st.enabled || !st.signedIn) return null
  const pts = st.points.toLocaleString()

  if (variant === "icon") {
    const label = claimed ? t("daily_claimed") : t("daily_claim", { points: pts })
    return (
      <button onClick={openDailyPopup} title={label} aria-label={label}
        className={`relative w-[38px] h-[38px] flex items-center justify-center rounded-[10px] border transition-all ${
          claimed
            ? "border-border-soft text-text-base hover:border-border-light hover:bg-white/[0.03]"
            : "border-gold/30 text-gold bg-gold/10 hover:bg-gold/20"}`}>
        <GiftIcon />
        {!claimed && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-hot ring-2 ring-bg-base animate-pulse" />}
      </button>
    )
  }

  if (variant === "compact") {
    return claimed ? (
      <p className="mt-2 text-[0.7rem] text-text-dim">✓ {flash != null ? t("daily_done", { points: flash.toLocaleString() }) : t("daily_claimed")}</p>
    ) : (
      <button onClick={claim} disabled={busy}
        className="mt-2 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[0.75rem] font-bold text-[#1a1200] bg-gold hover:brightness-110 transition disabled:opacity-60">
        <GiftIcon size={14} />
        {busy ? "..." : t("daily_claim", { points: pts })}
      </button>
    )
  }

  // card
  return (
    <div className={`rounded-[14px] border p-5 flex flex-col sm:flex-row sm:items-center gap-4 ${claimed ? "border-border-soft bg-bg-card" : "border-gold/30 bg-gold/[0.06]"}`}>
      <span className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${claimed ? "bg-white/[0.04] text-text-dim" : "bg-gold/15 text-gold"}`}>
        <GiftIcon size={22} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[0.95rem] font-bold">{t("daily_title")}</p>
        <p className="text-[0.78rem] text-text-muted mt-0.5">{t("daily_sub", { points: pts })}</p>
        {st.streak > 0 && <p className="text-[0.75rem] font-semibold text-gold mt-1">{t("daily_streak", { n: st.streak })}</p>}
        {err && <p className="text-[0.75rem] text-hot mt-1">{t("daily_error")}</p>}
      </div>
      {claimed ? (
        <div className="sm:text-right shrink-0">
          <p className="text-[0.85rem] font-bold text-success">✓ {flash != null ? t("daily_done", { points: flash.toLocaleString() }) : t("daily_claimed")}</p>
          {cd && <p className="text-[0.72rem] text-text-dim mt-0.5">{t("daily_next", { time: cd.text })}</p>}
        </div>
      ) : (
        <button onClick={claim} disabled={busy}
          className="shrink-0 inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-[0.88rem] font-bold text-[#1a1200] bg-gold hover:brightness-110 active:scale-[0.98] transition disabled:opacity-60">
          <GiftIcon size={16} />
          {busy ? "..." : t("daily_claim", { points: pts })}
        </button>
      )}
    </div>
  )
}
