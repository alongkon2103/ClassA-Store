// GET /api/cron/partners — daily partner-catalog sync, called by the server's
// crontab. Auth via INTERNAL_API_KEY (already set in prod) so it can't be hit
// publicly. Example crontab (04:00 Bangkok):
//   0 4 * * *  curl -s -H "Authorization: Bearer $INTERNAL_API_KEY" https://aclassstore.com/api/cron/partners
import { NextRequest, NextResponse } from "next/server"
import { syncAllPartners } from "@/lib/partnerSync"

export const runtime = "nodejs"

function authorized(req: NextRequest): boolean {
  const expected = process.env.INTERNAL_API_KEY
  if (!expected) return false
  const auth = req.headers.get("authorization") || ""
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7) : null
  const headerKey = req.headers.get("x-api-key")
  return bearer === expected || headerKey === expected
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  const result = await syncAllPartners()
  const anyOk = Object.values(result).some((r) => r.ok)
  return NextResponse.json({ result }, { status: anyOk ? 200 : 502 })
}
