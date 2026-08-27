// POST /api/admin/partners/sync — admin clicks "Sync now" to pull the partner
// catalog. Optional body { key } to sync one partner; otherwise all.
import { NextRequest, NextResponse } from "next/server"
import { validateAdmin } from "@/lib/adminAuth"
import { syncPartner, syncAllPartners } from "@/lib/partnerSync"

export const runtime = "nodejs"

export async function POST(req: NextRequest) {
  const admin = await validateAdmin()
  if (!admin.isValid) return admin.response

  const body = await req.json().catch(() => ({}))
  const key = typeof body?.key === "string" ? body.key : null

  const result = key ? { [key]: await syncPartner(key) } : await syncAllPartners()
  const anyOk = Object.values(result).some((r) => r.ok)
  return NextResponse.json({ result }, { status: anyOk ? 200 : 502 })
}
