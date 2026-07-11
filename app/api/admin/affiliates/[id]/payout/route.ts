// app/api/admin/affiliates/[id]/payout/route.ts   ([id] = affiliate user_id)
//
// POST → settle this affiliate: create ONE affiliate_payouts row covering every
//        currently-PENDING earning, flip those earnings to paid and link them to
//        the payout. Atomic; the payout amount is the exact sum of what it covers
//        so "what did this ฿X pay for?" is always answerable via payout_id.

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { validateAdmin } from "@/lib/adminAuth"

type Params = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: Params) {
  const admin = await validateAdmin(["admin"])
  if (!admin.isValid) return admin.response

  try {
    const { id } = await params
    const body = await req.json().catch(() => ({}))
    const method: string | null = body.method?.trim() || null
    const note: string | null = body.note?.trim() || null

    const result = await prisma.$transaction(async (tx) => {
      // Lock the set by reading ids first, then only flip THOSE — so an earning
      // created between read and write isn't swept into this payout by mistake.
      const pending = await tx.affiliate_earnings.findMany({
        where: { affiliate_user_id: id, status: "pending" },
        select: { id: true, commission_amount: true },
      })
      if (pending.length === 0) return { ok: false as const, reason: "NO_PENDING" }

      const total = pending.reduce((s, e) => s + Number(e.commission_amount), 0)
      const roundedTotal = Math.round(total * 100) / 100

      const payout = await tx.affiliate_payouts.create({
        data: {
          affiliate_user_id: id,
          amount: roundedTotal,
          status: "paid", // admin direct-pay: paid immediately, no request step
          method,
          note,
          requested_at: new Date(),
          paid_at: new Date(),
          created_by_id: admin.session?.user?.id ?? null,
        },
      })

      // CRITICAL: only flip earnings that are STILL pending. A double-click or a
      // second concurrent admin would otherwise re-settle the same earnings and
      // leave a duplicate payout row (double-paid in the ledger). If we didn't
      // claim exactly the set we priced, throw to roll back the whole payout.
      const upd = await tx.affiliate_earnings.updateMany({
        where: { id: { in: pending.map((e) => e.id) }, status: "pending" },
        data: { status: "paid", paid_at: new Date(), payout_id: payout.id },
      })
      if (upd.count !== pending.length) {
        throw new Error("CONCURRENT_SETTLE")
      }

      return { ok: true as const, payout_id: payout.id, amount: roundedTotal, count: pending.length }
    })

    if (!result.ok) {
      return NextResponse.json({ error: "No pending earnings to pay out" }, { status: 400 })
    }
    return NextResponse.json(result)
  } catch (err: unknown) {
    // Concurrent settlement rolled back — nothing was double-paid; ask to retry.
    if ((err as Error)?.message === "CONCURRENT_SETTLE") {
      return NextResponse.json({ error: "Please try again", errorCode: "CONCURRENT_SETTLE" }, { status: 409 })
    }
    console.error("POST payout error:", err)
    return NextResponse.json({ error: "Failed to record payout" }, { status: 500 })
  }
}
