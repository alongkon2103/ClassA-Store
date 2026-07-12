// app/api/admin/affiliates/requests/[id]/route.ts   ([id] = affiliate_payouts id)
//
// PATCH { action: "paid" | "reject" } → resolve a withdrawal request.
//   paid   → request paid; its covered earnings requested → paid.
//   reject → request rejected; its covered earnings returned to pending so the
//            affiliate can request again (amount goes back to their balance).
// Both run in a transaction and are idempotent-guarded (only acts on a request
// that is still "requested").

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { validateAdmin } from "@/lib/adminAuth"
import { notify } from "@/lib/notifications"
import { sendWithdrawPaidEmail, sendWithdrawRejectedEmail } from "@/lib/affiliateMail"

export const runtime = "nodejs"

type Params = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
  const admin = await validateAdmin(["admin"])
  if (!admin.isValid) return admin.response

  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const action = body.action
  if (action !== "paid" && action !== "reject") {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  }
  // Rejecting requires a reason — it's shown to the affiliate.
  const reason: string = action === "reject" ? (body.reason?.trim() || "") : ""
  if (action === "reject" && !reason) {
    return NextResponse.json({ error: "Reason required", errorCode: "REASON_REQUIRED" }, { status: 400 })
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const request = await tx.affiliate_payouts.findUnique({
        where: { id },
        select: { id: true, status: true, affiliate_user_id: true, amount: true, method: true },
      })
      if (!request) return { ok: false as const, code: "NOT_FOUND" }
      if (request.status !== "requested") return { ok: false as const, code: "ALREADY_RESOLVED" }

      if (action === "paid") {
        await tx.affiliate_payouts.update({ where: { id }, data: { status: "paid", paid_at: new Date() } })
        await tx.affiliate_earnings.updateMany({
          where: { payout_id: id, status: "requested" },
          data: { status: "paid", paid_at: new Date() },
        })
      } else {
        // Reject: return the earnings to the affiliate's pending balance, and
        // record the reason so the affiliate can see why.
        await tx.affiliate_earnings.updateMany({
          where: { payout_id: id, status: "requested" },
          data: { status: "pending", payout_id: null },
        })
        await tx.affiliate_payouts.update({ where: { id }, data: { status: "rejected", reject_reason: reason } })
      }
      return { ok: true as const, affiliateUserId: request.affiliate_user_id, amount: Number(request.amount), method: request.method }
    })

    if (!result.ok) {
      const status = result.code === "NOT_FOUND" ? 404 : 409
      return NextResponse.json({ error: result.code }, { status })
    }

    // Notify the affiliate of the outcome (best-effort, after commit).
    if (action === "paid") {
      await notify({ userId: result.affiliateUserId, type: "payout_paid", data: { amount: result.amount }, link: "/affiliate" })
      // Email the affiliate that their withdrawal was approved, CC admins.
      const [user, prof] = await Promise.all([
        prisma.users.findUnique({ where: { id: result.affiliateUserId }, select: { email: true, username: true } }),
        prisma.affiliate_profiles.findUnique({ where: { user_id: result.affiliateUserId }, select: { display_name: true } }),
      ])
      await sendWithdrawPaidEmail({
        affiliateName: prof?.display_name || user?.username || "นายหน้า",
        affiliateEmail: user?.email ?? null,
        amount: result.amount,
        method: result.method,
      })
    } else {
      await notify({ userId: result.affiliateUserId, type: "payout_rejected", data: { amount: result.amount, reason }, link: "/affiliate" })
      // Email the affiliate the rejection + reason, CC admins.
      const [user, prof] = await Promise.all([
        prisma.users.findUnique({ where: { id: result.affiliateUserId }, select: { email: true, username: true } }),
        prisma.affiliate_profiles.findUnique({ where: { user_id: result.affiliateUserId }, select: { display_name: true } }),
      ])
      await sendWithdrawRejectedEmail({
        affiliateName: prof?.display_name || user?.username || "affiliate",
        affiliateEmail: user?.email ?? null,
        amount: result.amount,
        reason,
      })
    }
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    console.error("resolve request error:", err)
    return NextResponse.json({ error: "Failed to resolve request" }, { status: 500 })
  }
}
