"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function OrderStatusPoller({
  orderId,
  currentStatus,
  hasKey,
}: {
  orderId: string
  currentStatus: string
  hasKey: boolean
}) {
  const router = useRouter()

  useEffect(() => {
    const isCompleted =
      currentStatus === "paid" || currentStatus === "Admin Buy"

    if (isCompleted && hasKey) return
    if (currentStatus === "expired") return

    let interval: ReturnType<typeof setInterval> | null = null

    // PromptPay flow: user opens bank app and the browser tab goes hidden.
    // Pausing the poll while hidden saves ~20 reqs/min/tab without any UX cost —
    // the visibilitychange handler immediately re-checks status when they return.
    const tick = async () => {
      try {
        const res = await fetch(`/api/orders/${orderId}/status`)
        const data = await res.json()

        const isPaid =
          data.status === "paid" || data.status === "Admin Buy"

        if (isPaid && (!isCompleted || data.isFulfilled)) {
          if (interval) clearInterval(interval)
          router.refresh()
        }
      } catch (err) {
        console.error("Polling error:", err)
      }
    }

    const start = () => {
      if (interval) return
      interval = setInterval(tick, 3000)
    }

    const stop = () => {
      if (interval) {
        clearInterval(interval)
        interval = null
      }
    }

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        tick() // immediate refresh when user returns to the tab
        start()
      } else {
        stop()
      }
    }

    if (document.visibilityState === "visible") start()
    document.addEventListener("visibilitychange", onVisibilityChange)

    return () => {
      stop()
      document.removeEventListener("visibilitychange", onVisibilityChange)
    }
  }, [orderId, currentStatus, hasKey, router])

  return null
}
