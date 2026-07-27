// app/api/affiliate/withdraw/route.ts
//
// POST → the affiliate requests a withdrawal of their WHOLE pending balance.
// Creates one affiliate_payouts row status="requested" and moves the covered
// earnings pending → requested (locking them so they can't be double-requested
// or swept by an admin direct-pay). Admin later marks it paid or rejects it.
//
// Guards: must have payout info set, no open request already, and pending must
// reach the admin-configured minimum.

import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getAffiliateMinWithdraw, getAffiliateWithdrawWaitDays, withdrawAvailableAt } from "@/lib/affiliateConfig"
import { sendWithdrawRequestedEmail } from "@/lib/affiliateMail"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const userId = session.user.id

  const profile = await prisma.affiliate_profiles.findUnique({
    where: { user_id: userId },
    select: { payout_method: true, payout_detail: true, is_active: true },
  })
  if (!profile) return NextResponse.json({ error: "Not an affiliate" }, { status: 403 })
  if (!profile.payout_method || !profile.payout_detail) {
    return NextResponse.json({ error: "NO_PAYOUT_INFO", errorCode: "NO_PAYOUT_INFO" }, { status: 400 })
  }

  const [minWithdraw, waitDays] = await Promise.all([getAffiliateMinWithdraw(), getAffiliateWithdrawWaitDays()])

  try {
    const result = await prisma.$transaction(async (tx) => {
      // One open request at a time.
      const open = await tx.affiliate_payouts.count({ where: { affiliate_user_id: userId, status: "requested" } })
      if (open > 0) return { ok: false as const, code: "ALREADY_REQUESTED" }

      const pending = await tx.affiliate_earnings.findMany({
        where: { affiliate_user_id: userId, status: "pending" },
        select: { id: true, commission_amount: true },
      })
      const total = Math.round(pending.reduce((s, e) => s + Number(e.commission_amount), 0) * 100) / 100
      if (pending.length === 0 || total <= 0) return { ok: false as const, code: "NO_PENDING" }

      // Onboarding maturity gate (one-time): the affiliate's first-ever earning
      // must be at least `waitDays` old. Anchor on the earliest earning of ANY
      // status so it never resets after a withdrawal. pending>0 here guarantees
      // at least one earning row exists.
      const first = await tx.affiliate_earnings.findFirst({
        where: { affiliate_user_id: userId },
        orderBy: { created_at: "asc" },
        select: { created_at: true },
      })
      const availableAt = withdrawAvailableAt(first?.created_at ?? null, waitDays)
      if (availableAt !== null && Date.now() < availableAt) {
        return { ok: false as const, code: "WAITING_PERIOD", availableAt: new Date(availableAt).toISOString(), waitDays }
      }

      if (total < minWithdraw) return { ok: false as const, code: "BELOW_MIN", min: minWithdraw }

      const request = await tx.affiliate_payouts.create({
        data: {
          affiliate_user_id: userId,
          amount: total,
          status: "requested",
          method: profile.payout_method,
          detail: profile.payout_detail, // snapshot where to send
          requested_at: new Date(),
        },
      })

      // Lock exactly the earnings we priced. Any concurrent change → count
      // mismatch → throw → whole request rolls back (no partial lock).
      const upd = await tx.affiliate_earnings.updateMany({
        where: { id: { in: pending.map((e) => e.id) }, status: "pending" },
        data: { status: "requested", payout_id: request.id },
      })
      if (upd.count !== pending.length) throw new Error("CONCURRENT")

      return { ok: true as const, amount: total }
    })

    if (!result.ok) {
      const status = result.code === "NO_PENDING" ? 400 : 409
      return NextResponse.json(
        { error: result.code, errorCode: result.code, min: result.min, availableAt: result.availableAt, waitDays: result.waitDays },
        { status },
      )
    }

    // Notify admins of the new request, CC the affiliate (best-effort).
    const [user, prof] = await Promise.all([
      prisma.users.findUnique({ where: { id: userId }, select: { email: true, username: true } }),
      prisma.affiliate_profiles.findUnique({ where: { user_id: userId }, select: { display_name: true } }),
    ])
    await sendWithdrawRequestedEmail({
      affiliateName: prof?.display_name || user?.username || "นายหน้า",
      affiliateEmail: user?.email ?? null,
      amount: result.amount,
      method: profile.payout_method,
      detail: profile.payout_detail,
    })

    return NextResponse.json(result)
  } catch (err: unknown) {
    if ((err as Error)?.message === "CONCURRENT") {
      return NextResponse.json({ error: "Please try again", errorCode: "CONCURRENT" }, { status: 409 })
    }
    console.error("withdraw request error:", err)
    return NextResponse.json({ error: "Failed to request withdrawal" }, { status: 500 })
  }
}

// DELETE → the affiliate cancels their own open request (before admin acts on
// it). The reserved earnings go back to their pending balance.
export async function DELETE() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const userId = session.user.id

  try {
    const result = await prisma.$transaction(async (tx) => {
      const open = await tx.affiliate_payouts.findFirst({
        where: { affiliate_user_id: userId, status: "requested" },
        select: { id: true },
      })
      if (!open) return { ok: false as const }
      await tx.affiliate_earnings.updateMany({
        where: { payout_id: open.id, status: "requested" },
        data: { status: "pending", payout_id: null },
      })
      await tx.affiliate_payouts.update({ where: { id: open.id }, data: { status: "cancelled" } })
      return { ok: true as const }
    })
    if (!result.ok) return NextResponse.json({ error: "No open request", errorCode: "NO_REQUEST" }, { status: 400 })
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    console.error("withdraw cancel error:", err)
    return NextResponse.json({ error: "Failed to cancel" }, { status: 500 })
  }
}
