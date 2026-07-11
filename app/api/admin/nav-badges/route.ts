// app/api/admin/nav-badges/route.ts
//
// GET → small counts for badges in the admin sidebar. Derived live from the DB
// (no notifications table on the admin side — these are work queues that clear
// themselves when the work is done). Extend with more counts as needed.

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { validateAdmin } from "@/lib/adminAuth"

export const dynamic = "force-dynamic"

export async function GET() {
  const admin = await validateAdmin(["admin", "partnership"])
  if (!admin.isValid) return admin.response

  const affiliate_requests = await prisma.affiliate_payouts.count({ where: { status: "requested" } })

  return NextResponse.json({ affiliate_requests })
}
