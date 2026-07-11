// In-app notification helper. Creating a notification is ALWAYS best-effort —
// it must never block or fail the source action (a payout, an order, etc.).
// Callers await these AFTER their own transaction has committed.
//
// Text is NOT stored: we store `type` + a structured `data` payload and render
// the localized string on the client (next-intl), so a notification reads in
// the viewer's own language (th/en).

import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"

export type NotificationType =
  | "payout_paid"       // data: { amount }
  | "payout_rejected"   // data: { amount, reason }
  | "commission_earned" // data: { amount }

type NotifyInput = {
  userId: string
  type: NotificationType
  data?: Prisma.InputJsonValue
  link?: string | null
}

// Fire-and-await, but swallow all errors: a notification is a nicety, never a
// reason to 500 the real request.
export async function notify(input: NotifyInput): Promise<void> {
  try {
    await prisma.notifications.create({
      data: {
        user_id: input.userId,
        type: input.type,
        data: input.data ?? undefined,
        link: input.link ?? null,
      },
    })
  } catch (e) {
    console.error("notify() failed (non-fatal):", e)
  }
}
