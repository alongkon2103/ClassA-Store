"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { HalloweenDraw, HalloweenState } from "@/lib/halloweenEvent"

export function useHalloweenEvent(live: boolean) {
  const [state, setState] = useState<HalloweenState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const version = useRef(0)
  const refresh = useCallback(async (signal?: AbortSignal) => {
    const started = version.current
    try {
      const response = await fetch("/api/events/halloween", { cache: "no-store", signal })
      if (!response.ok) throw new Error("unavailable")
      const data = await response.json() as HalloweenState
      if (!signal?.aborted && started === version.current) { setState(data); setError(null) }
    } catch { if (!signal?.aborted && started === version.current) setError("unavailable") }
  }, [])
  useEffect(() => {
    if (!live) return
    const controller = new AbortController()
    void refresh(controller.signal)
    return () => controller.abort()
  }, [live, refresh])
  useEffect(() => {
    if (!live || !state || state.phase === "ended") return
    const next = state.phase === "upcoming" ? state.startsAt : state.endsAt
    const wait = new Date(next).getTime() - new Date(state.serverNow).getTime() + 1000
    const timer = setTimeout(() => void refresh(), Math.max(1000, Math.min(wait, 2147483647)))
    return () => clearTimeout(timer)
  }, [live, state, refresh])
  const request = async (path: "" | "/claim", body: Record<string, unknown>) => {
    version.current++ // A pre-draw status response must never erase a committed prize.
    const response = await fetch(`/api/events/halloween${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
    const data = await response.json()
    if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "unavailable")
    const draw = data.draw as HalloweenDraw
    version.current++ // Also invalidate reads started while this request was in flight.
    setError(null)
    setState(current => current ? { ...current, draw } : current)
    return draw
  }
  return { state, error, refresh, request }
}

export function halloweenErrorText(code: string, th: boolean) {
  const messages: Record<string, [string, string]> = {
    unauthorized: ["กรุณาเข้าสู่ระบบก่อนร่วมกิจกรรม", "Please sign in to join."],
    upcoming: ["กิจกรรมยังไม่เริ่ม ลองใหม่ตามเวลาที่ประกาศ", "The event has not started yet."],
    ended: ["กิจกรรมสิ้นสุดแล้ว", "The event has ended."],
    account_unavailable: ["บัญชีนี้ไม่สามารถร่วมกิจกรรมได้ กรุณาติดต่อร้าน", "This account cannot join. Please contact the store."],
    ign_required: ["กรอกชื่อผู้ใช้ Roblox เพื่อรับเกม", "Enter your Roblox username."],
    ign_invalid: ["ตรวจสอบรูปแบบชื่อผู้ใช้ Roblox อีกครั้ง", "Check the Roblox username format."],
    ign_not_found: ["ไม่พบชื่อผู้ใช้ Roblox นี้", "This Roblox username was not found."],
    roblox_unavailable: ["Roblox ยังตรวจสอบไม่ได้ รางวัลยังอยู่ ลองรับใหม่อีกครั้ง", "Roblox is unavailable. Your prize is saved; please retry."],
  }
  return messages[code]?.[th ? 0 : 1] ?? (th ? "เชื่อมต่อไม่สำเร็จ ลองใหม่ได้ ระบบจะไม่สุ่มหรือแจกซ้ำ" : "Could not connect. Retry safely without drawing or awarding twice.")
}
