import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { validateAdmin } from "@/lib/adminAuth"
import { adminAdjustPoints, getPointsBalance, reconcileAllPoints } from "@/lib/points"

// แอดมิน: ค้นหาลูกค้าดูยอด/ประวัติแต้ม, ปรับแต้มเอง, กวาดออเดอร์ที่ยังไม่ได้แต้มทั้งร้าน
export async function GET(req: NextRequest) {
  const admin = await validateAdmin(["admin"])
  if (!admin.isValid) return admin.response
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim()
  if (!q) return NextResponse.json({ error: "q required" }, { status: 400 })

  const user = await prisma.users.findFirst({
    where: { OR: [{ email: { equals: q, mode: "insensitive" } }, { username: { contains: q, mode: "insensitive" } }, ...(isUuid(q) ? [{ id: q }] : [])] },
    select: { id: true, username: true, email: true, avatar: true },
  })
  if (!user) return NextResponse.json({ error: "not_found" }, { status: 404 })

  const [balance, entries] = await Promise.all([
    getPointsBalance(user.id),
    prisma.point_ledger.findMany({
      where: { user_id: user.id },
      orderBy: { created_at: "desc" },
      take: 30,
      include: { order: { select: { id: true, products: { select: { name_th: true } } } } },
    }),
  ])
  return NextResponse.json({
    user,
    balance,
    entries: entries.map((e) => ({ id: e.id, delta: e.delta, type: e.type, note: e.note, created_at: e.created_at, order_id: e.order?.id ?? null, product: e.order?.products.name_th ?? null })),
  })
}

export async function POST(req: NextRequest) {
  const admin = await validateAdmin(["admin"])
  if (!admin.isValid) return admin.response
  const body = await req.json().catch(() => ({}))

  if (body.action === "reconcile") {
    const r = await reconcileAllPoints()
    return NextResponse.json(r)
  }

  if (body.action === "adjust") {
    const delta = Number(body.delta)
    const userId = String(body.user_id ?? "")
    if (!isUuid(userId)) return NextResponse.json({ error: "user_id invalid" }, { status: 400 })
    if (!Number.isInteger(delta) || delta === 0 || Math.abs(delta) > 1_000_000) return NextResponse.json({ error: "delta invalid" }, { status: 400 })
    const note = String(body.note ?? "").slice(0, 200)
    const adminId = admin.session?.user?.id
    if (!adminId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    await adminAdjustPoints({ userId, delta, note, adminId })
    return NextResponse.json({ ok: true, balance: await getPointsBalance(userId) })
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 })
}

const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)
