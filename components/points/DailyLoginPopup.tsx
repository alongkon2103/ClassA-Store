"use client"

// หน้าต่าง Daily Login: เด้งวันละครั้งตอนเข้าเว็บ ถ้าล็อกอินแล้วและวันนี้ยังไม่ได้รับแต้มรายวัน
// + เปิดซ้ำได้จากไอคอนของขวัญบน Navbar (event daily-popup-open) แม้รับแล้ว — โชว์ปฏิทิน/วันต่อเนื่อง/นับถอยหลังถึงเที่ยงคืน
// ปฏิทินสัปดาห์นี้ (จันทร์–อาทิตย์ ตามเวลาไทย) ติ๊กวันที่รับแล้ว + จำนวนวันที่เข้าต่อเนื่อง
// ปิดแล้วไม่เด้งซ้ำทั้งวัน (จำใน localStorage ตามวันไทย) · ไม่เด้งในหน้า admin / ชำระเงิน / editor รูปไลฟ์
import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import { useRouter } from "@/i18n/routing"
import { localeTag } from "@/lib/i18n/locale"
import { DAILY_POPUP_OPEN_EVT, fetchDailyStatus, notifyDailyChanged, useCountdown, type DailyStatusView } from "./DailyClaim"

const SKIP = ["/admin", "/checkout", "/livegen"]
const seenKey = (day: string) => `daily-popup:${day}`
const markSeen = (day: string) => { try { localStorage.setItem(seenKey(day), "1") } catch { /* storage ปิดอยู่ */ } }

export default function DailyLoginPopup() {
  const t = useTranslations("Account")
  const locale = useLocale()
  const router = useRouter()
  const pathname = usePathname() ?? ""
  const skip = SKIP.some((p) => pathname.includes(p))
  const [st, setSt] = useState<DailyStatusView | null>(null)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [got, setGot] = useState<number | null>(null)
  const [err, setErr] = useState(false)
  const cd = useCountdown(st?.nextResetAt ?? null, open && !!st?.claimedToday)

  // กดไอคอนของขวัญบน Navbar → เปิดดูปฏิทินได้ทุกเมื่อ (สถานะสดจาก server ไม่ใช้ cache)
  useEffect(() => {
    const onOpen = () => {
      fetchDailyStatus(true).then((d) => {
        if (!d || !d.signedIn || !d.enabled) return
        setSt(d); setGot(null); setErr(false); setOpen(true)
      })
    }
    window.addEventListener(DAILY_POPUP_OPEN_EVT, onOpen)
    return () => window.removeEventListener(DAILY_POPUP_OPEN_EVT, onOpen)
  }, [])

  useEffect(() => {
    if (skip) return
    let alive = true
    fetchDailyStatus().then((d) => {
      if (!alive || !d || !d.signedIn || !d.enabled || d.claimedToday) return
      try { if (localStorage.getItem(seenKey(d.todayKey))) return } catch { /* อ่านไม่ได้ก็เด้งตามปกติ */ }
      setSt(d)
      setOpen(true)
    })
    return () => { alive = false }
  }, [skip])

  const close = () => {
    if (st) markSeen(st.todayKey)
    setOpen(false)
  }

  const claim = async () => {
    if (!st || busy) return
    setBusy(true); setErr(false)
    try {
      const r = await fetch("/api/points/daily", { method: "POST" })
      const d = await r.json().catch(() => ({}))
      if (r.ok || d.error === "already_claimed") {
        setSt((s) => (s ? { ...s, ...d, claimedToday: true } : s))
        if (r.ok) setGot(d.points)
        markSeen(st.todayKey)
        notifyDailyChanged()
        router.refresh() // ยอดแต้มใน sidebar / หน้า Coins มาจาก server
      } else setErr(true)
    } catch { setErr(true) } finally { setBusy(false) }
  }

  if (!open || !st) return null
  const pts = st.points.toLocaleString()
  const weekday = new Intl.DateTimeFormat(localeTag(locale), { weekday: "short", timeZone: "UTC" })

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={close}>
      <div role="dialog" aria-modal="true" aria-labelledby="daily-login-title" onClick={(e) => e.stopPropagation()}
           className="w-full max-w-[420px] rounded-2xl border border-gold/25 bg-bg-card p-6 shadow-[0_24px_60px_rgba(0,0,0,0.55)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p id="daily-login-title" className="text-[1.15rem] font-black">{t("daily_popup_title")}</p>
            <p className="text-[0.8rem] text-text-muted mt-1 leading-[1.5]">{t("daily_popup_sub", { points: pts })}</p>
          </div>
          <button onClick={close} aria-label={t("daily_popup_close")}
                  className="w-8 h-8 shrink-0 rounded-lg text-text-dim hover:text-text-base hover:bg-white/[0.05] flex items-center justify-center transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>

        {/* ปฏิทินสัปดาห์นี้ */}
        <div className="grid grid-cols-7 gap-1.5 mt-5">
          {st.week.map((d) => {
            const date = new Date(`${d.key}T00:00:00Z`)
            const isToday = d.key === st.todayKey
            const future = d.key > st.todayKey
            return (
              <div key={d.key}
                   className={`rounded-xl py-2 flex flex-col items-center gap-0.5 border ${
                     d.claimed ? "border-gold/40 bg-gold/15 text-gold" : isToday ? "border-accent/50 bg-accent/10 text-text-base" : "border-border-soft text-text-dim"
                   } ${future ? "opacity-50" : ""}`}>
                <span className="text-[0.6rem] font-semibold">{weekday.format(date)}</span>
                <span className="text-[0.9rem] font-bold leading-none">{date.getUTCDate()}</span>
                <span className="text-[0.7rem] h-4 leading-4">{d.claimed ? "✓" : isToday ? "•" : ""}</span>
              </div>
            )
          })}
        </div>

        <p className="mt-4 text-center text-[0.88rem] font-semibold text-gold">
          {st.streak > 0 ? t("daily_streak", { n: st.streak }) : t("daily_streak_none")}
        </p>

        {got != null || st.claimedToday ? (
          <div className="mt-4 text-center">
            <p className="text-[0.95rem] font-bold text-success">✓ {got != null ? t("daily_done", { points: got.toLocaleString() }) : t("daily_claimed")}</p>
            {cd && <p className="text-[0.75rem] text-text-dim mt-1">{t("daily_next", { time: cd.text })}</p>}
            <button onClick={close} className="mt-4 w-full py-3 rounded-xl border border-border-soft text-[0.85rem] font-semibold text-text-muted hover:text-text-base transition-colors">
              {t("daily_popup_close")}
            </button>
          </div>
        ) : (
          <div className="mt-4 flex gap-2">
            <button onClick={close} className="flex-1 py-3 rounded-xl border border-border-soft text-[0.85rem] font-semibold text-text-muted hover:text-text-base transition-colors">
              {t("daily_popup_later")}
            </button>
            <button onClick={claim} disabled={busy}
                    className="flex-[2] py-3 rounded-xl text-[0.9rem] font-bold text-[#1a1200] bg-gold hover:brightness-110 active:scale-[0.98] transition disabled:opacity-60">
              {busy ? "..." : t("daily_claim", { points: pts })}
            </button>
          </div>
        )}
        {err && <p className="mt-2 text-center text-[0.75rem] text-hot">{t("daily_error")}</p>}
      </div>
    </div>
  )
}
