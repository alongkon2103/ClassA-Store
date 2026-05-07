"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function OrderStatusPoller({ orderId, currentStatus, hasKey }: { orderId: string, currentStatus: string, hasKey: boolean }) {
  const router = useRouter()

  useEffect(() => {
    // If already paid and has key, no need to poll
    if (currentStatus === "paid" && hasKey) return
    if (currentStatus === "expired") return

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/orders/${orderId}/status`)
        const data = await res.json()

        // Refresh if status changed to paid OR if it's paid but we just got a key
        if (data.status === "paid" && (currentStatus !== "paid" || data.isFulfilled)) {
          clearInterval(interval)
          router.refresh()
        }
      } catch (err) {
        console.error("Polling error:", err)
      }
    }, 3000) // Poll every 3 seconds

    return () => clearInterval(interval)
  }, [orderId, currentStatus, hasKey, router])

  return null
}
