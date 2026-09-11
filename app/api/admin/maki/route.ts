import { NextRequest, NextResponse } from "next/server"
import { validateAdmin } from "@/lib/adminAuth"
import { makiWhitelist, MakiError } from "@/lib/maki"
import { reconcileWithMaki, syncPendingMakiOrders } from "@/lib/makiOrders"

// แอดมิน: ดูสิทธิ์จริงของลูกค้าใน Maki (support) · กวาดสถานะออเดอร์ค้าง
export async function GET(req: NextRequest) {
  const admin = await validateAdmin(["admin"])
  if (!admin.isValid) return admin.response
  const provider = req.nextUrl.searchParams.get("provider") ?? ""
  const id = req.nextUrl.searchParams.get("id") ?? ""
  if (!["discord", "google"].includes(provider) || !/^\d{5,32}$/.test(id)) return NextResponse.json({ error: "bad_request" }, { status: 400 })
  try {
    return NextResponse.json(await makiWhitelist(provider, id))
  } catch (e) {
    return NextResponse.json({ error: e instanceof MakiError ? e.message : "maki_error" }, { status: 502 })
  }
}

export async function POST(req: NextRequest) {
  const admin = await validateAdmin(["admin"])
  if (!admin.isValid) return admin.response
  const body = await req.json().catch(() => ({}))
  try {
    if (body.action === "reconcile") return NextResponse.json(await reconcileWithMaki())
    return NextResponse.json(await syncPendingMakiOrders({ limit: 200 }))
  } catch (e) {
    return NextResponse.json({ error: e instanceof MakiError ? e.message : "maki_error" }, { status: 502 })
  }
}
