// app/api/admin/affiliates/requests/route.ts
//
// GET → every OPEN withdrawal request across all affiliates, with the payout
// info (where to send) so admin can transfer and then mark it paid.

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { validateAdmin } from "@/lib/adminAuth"

export const dynamic = "force-dynamic"

export async function GET() {
  const admin = await validateAdmin(["admin"])
  if (!admin.isValid) return admin.response

  const requests = await prisma.affiliate_payouts.findMany({
    where: { status: "requested" },
    orderBy: { requested_at: "asc" },
    select: {
      id: true, affiliate_user_id: true, amount: true, method: true, detail: true, requested_at: true,
      affiliate: { select: { username: true, email: true } },
    },
  })

  return NextResponse.json(
    requests.map((r) => ({
      id: r.id,
      affiliate_user_id: r.affiliate_user_id,
      username: r.affiliate.username,
      email: r.affiliate.email,
      amount: Number(r.amount),
      method: r.method,
      detail: r.detail,
      requested_at: r.requested_at?.toISOString() ?? null,
    })),
  )
}
