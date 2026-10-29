"use client"

import { useEffect, useId, useState } from "react"
import { Link } from "@/i18n/routing"
import type { HalloweenDraw } from "@/lib/halloweenEvent"
import { halloweenErrorText } from "./useHalloweenEvent"
import styles from "./HalloweenDrawPreview.module.css"

type Identity = { id: number; username: string; displayName: string; avatarUrl: string | null }
export default function HalloweenClaim({ draw, th, onClaim }: { draw: HalloweenDraw; th: boolean; onClaim: (ign: string | null) => Promise<void> }) {
  const [ign, setIgn] = useState("")
  const [verified, setVerified] = useState<Identity | null>(null)
  const [check, setCheck] = useState<"idle" | "checking" | "bad" | "unavailable">("idle")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [retry, setRetry] = useState(0)
  const inputId = useId()
  const roblox = draw.prize.kind === "game" && draw.prize.product.type === "roblox_whitelist"
  useEffect(() => {
    if (!roblox || draw.claimedAt || !ign.trim()) return
    const controller = new AbortController()
    let current = true
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/roblox/verify?username=${encodeURIComponent(ign.trim())}`, { signal: controller.signal })
        const data = await response.json()
        if (!current) return
        if (response.ok && data.ok && data.user) { setVerified(data.user); setCheck("idle") }
        else setCheck(!response.ok || data.reason === "network" ? "unavailable" : "bad")
      } catch { if (current) setCheck("unavailable") }
    }, 500)
    return () => { current = false; controller.abort(); clearTimeout(timer) }
  }, [ign, roblox, draw.claimedAt, retry])

  if (draw.claimedAt) return <div className={styles.claimed} role="status">
    <p>{draw.prize.kind === "points" ? (th ? "เพิ่ม AC Points เข้าบัญชีแล้ว" : "AC Points added to your balance") : draw.result?.permanent ? (th ? "บัญชีนี้มีสิทธิ์เล่นเกมถาวรอยู่แล้ว" : "You already have permanent access") : (th ? "รับสิทธิ์เล่นเกมเรียบร้อยแล้ว" : "Your game access is ready")}</p>
    {draw.result?.ign && <p className={styles.claimHint}>Roblox @{draw.result.ign}</p>}
    {draw.result && !draw.result.permanent && <p className={styles.claimHint}>{th ? "เล่นได้ถึง " : "Access until "}{new Date(draw.result.expiresAt).toLocaleString(th ? "th-TH" : "en-GB", { timeZone: "Asia/Bangkok", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })} (GMT+7)</p>}
    <Link href={draw.orderId ? `/orders/${draw.orderId}` : "/account/coins"} className={styles.openButton}>{th ? draw.orderId ? "ดูเกมของฉัน" : "ดู AC Points ของฉัน" : draw.orderId ? "View my game" : "View my AC Points"}</Link>
  </div>

  const claim = async () => {
    if (busy || (roblox && !verified)) return
    setBusy(true); setError(null)
    try { await onClaim(roblox ? verified!.username : null) }
    catch (e) { setError(halloweenErrorText(e instanceof Error ? e.message : "unavailable", th)) }
    finally { setBusy(false) }
  }
  return <div className={styles.claim}>
    {roblox ? <>
      <label htmlFor={inputId}>{th ? "รับสิทธิ์ให้บัญชี Roblox นี้" : "Receive the game on this Roblox account"}</label>
      <input id={inputId} value={ign} maxLength={20} autoComplete="off" autoCapitalize="none" spellCheck={false} placeholder={th ? "ชื่อผู้ใช้ Roblox (Username)" : "Roblox username"} disabled={busy} onChange={e => { setIgn(e.target.value); setVerified(null); setCheck(e.target.value.trim() ? "checking" : "idle"); setError(null) }} />
      <div className={styles.identity} role="status" aria-live="polite">
        {verified ? <>{verified.avatarUrl && <img src={verified.avatarUrl} alt="" width={42} height={42} />}<span><strong>{verified.displayName}</strong><small>@{verified.username}</small></span></> : <span>{check === "checking" ? (th ? "กำลังตรวจสอบบัญชี…" : "Checking account…") : check === "bad" ? (th ? "ไม่พบชื่อผู้ใช้นี้" : "Username not found") : check === "unavailable" ? (th ? "Roblox ยังตรวจสอบไม่ได้" : "Roblox is unavailable") : (th ? "ตรวจสอบชื่อและรูปให้ตรงกับบัญชีที่จะเล่น" : "Check the name and avatar before receiving the game.")}</span>}
        {check === "unavailable" && <button type="button" onClick={() => { setCheck("checking"); setRetry(x => x + 1) }}>{th ? "ตรวจอีกครั้ง" : "Retry"}</button>}
      </div>
    </> : <p className={styles.claimHint}>{th ? "รับสิทธิ์ให้บัญชีที่เข้าสู่ระบบนี้ ใช้ได้ในโปรแกรม AC Pig Panic" : "Receive access on this store account for the AC Pig Panic app."}</p>}
    <button type="button" className={styles.openButton} disabled={busy || (roblox && !verified)} onClick={claim}>{busy ? (th ? "กำลังรับสิทธิ์…" : "Receiving access…") : (th ? "รับสิทธิ์เล่นเกม" : "Receive game access")}</button>
    {error && <p role="alert" className={styles.error}>{error}</p>}
    <p className={styles.claimHint}>{th ? "มีเกมอยู่แล้วจะเพิ่มวันจากวันหมดอายุเดิม หากหมดอายุจะเริ่มนับเมื่อรับสิทธิ์" : "Active access is extended. Expired access starts from the time you claim."}</p>
  </div>
}
