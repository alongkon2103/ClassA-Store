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

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/orders/${orderId}/status`)
        const data = await res.json()

        const isPaid =
          data.status === "paid" || data.status === "Admin Buy"

        if (isPaid && (!isCompleted || data.isFulfilled)) {
          clearInterval(interval)
          router.refresh()
        }
      } catch (err) {
        console.error("Polling error:", err)
      }
    }, 3000)

    return () => clearInterval(interval)
  }, [orderId, currentStatus, hasKey, router])

  return null
}