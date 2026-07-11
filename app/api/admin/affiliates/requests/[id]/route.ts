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

  try {
    const result = await prisma.$transaction(async (tx) => {
      const request = await tx.affiliate_payouts.findUnique({
        where: { id },
        select: { id: true, status: true },
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
        // Reject: return the earnings to the affiliate's pending balance.
        await tx.affiliate_earnings.updateMany({
          where: { payout_id: id, status: "requested" },
          data: { status: "pending", payout_id: null },
        })
        await tx.affiliate_payouts.update({ where: { id }, data: { status: "rejected" } })
      }
      return { ok: true as const }
    })

    if (!result.ok) {
      const status = result.code === "NOT_FOUND" ? 404 : 409
      return NextResponse.json({ error: result.code }, { status })
    }
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    console.error("resolve request error:", err)
    return NextResponse.json({ error: "Failed to resolve request" }, { status: 500 })
  }
}
