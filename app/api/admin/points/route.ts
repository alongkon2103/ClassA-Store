import { NextRequest, NextResponse } from "next/server"
import { validateAdmin } from "@/lib/adminAuth"
import { adminAdjustPoints, adminSetPoints, adminVoidEntry, getPointsBalance, reconcileAllPoints } from "@/lib/points"

// แอดมินจัดการแต้ม: adjust (+/−) · set (ตั้งยอด) · void (ยกเลิกรายการที่ปรับผิด) · reconcile (กวาดออเดอร์ที่ยังไม่ได้แต้ม)
const isUuid = (s: unknown): s is string => typeof s === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)
const KNOWN: Record<string, number> = { invalid_delta: 400, invalid_balance: 400, not_found: 404, void_not_allowed: 400, already_voided: 409 }

export async function POST(req: NextRequest) {
  const admin = await validateAdmin(["admin"])
  if (!admin.isValid) return admin.response
  const adminId = admin.session?.user?.id
  if (!adminId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const note = String(body.note ?? "").trim().slice(0, 200)

  try {
    switch (body.action) {
      case "reconcile":
        return NextResponse.json(await reconcileAllPoints())

      case "adjust": {
        const delta = Number(body.delta)
        if (!isUuid(body.user_id)) return NextResponse.json({ error: "user_id invalid" }, { status: 400 })
        if (!Number.isInteger(delta) || delta === 0 || Math.abs(delta) > 1_000_000) return NextResponse.json({ error: "invalid_delta" }, { status: 400 })
        if (!note) return NextResponse.json({ error: "note_required" }, { status: 400 })
        await adminAdjustPoints({ userId: body.user_id, delta, note, adminId })
        return NextResponse.json({ ok: true, delta, balance: await getPointsBalance(body.user_id) })
      }

      case "set": {
        const balance = Number(body.balance)
        if (!isUuid(body.user_id)) return NextResponse.json({ error: "user_id invalid" }, { status: 400 })
        if (!Number.isInteger(balance) || balance < 0 || balance > 10_000_000) return NextResponse.json({ error: "invalid_balance" }, { status: 400 })
        if (!note) return NextResponse.json({ error: "note_required" }, { status: 400 })
        const delta = await adminSetPoints({ userId: body.user_id, balance, note, adminId })
        return NextResponse.json({ ok: true, delta, balance: await getPointsBalance(body.user_id) })
      }

      case "void": {
        if (!isUuid(body.entry_id)) return NextResponse.json({ error: "entry_id invalid" }, { status: 400 })
        const r = await adminVoidEntry({ entryId: body.entry_id, adminId, note: note || undefined })
        return NextResponse.json({ ok: true, delta: r.delta, balance: await getPointsBalance(r.userId) })
      }

      default:
        return NextResponse.json({ error: "unknown action" }, { status: 400 })
    }
  } catch (e) {
    const code = e instanceof Error ? e.message : "error"
    if (KNOWN[code]) return NextResponse.json({ error: code }, { status: KNOWN[code] })
    console.error("admin points action failed:", e)
    return NextResponse.json({ error: "server_error" }, { status: 500 })
  }
}
