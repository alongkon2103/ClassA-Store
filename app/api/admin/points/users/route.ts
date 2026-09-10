import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { validateAdmin } from "@/lib/adminAuth"

// รายชื่อผู้ใช้พร้อมยอดแต้ม — ไม่ค้นหา = เรียงจาก ledger (คนที่มีแต้ม) · ค้นหา = จากตาราง users (รวมคนที่ยังไม่มีแต้ม)
const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)
const USER_SELECT = { id: true, username: true, email: true, avatar: true } as const

export async function GET(req: NextRequest) {
  const admin = await validateAdmin(["admin"])
  if (!admin.isValid) return admin.response
  const sp = req.nextUrl.searchParams
  const q = (sp.get("q") ?? "").trim()
  const page = Math.max(1, Number(sp.get("page")) || 1)
  const limit = Math.min(100, Math.max(1, Number(sp.get("limit")) || 25))
  const sort = sp.get("sort") === "recent" ? "recent" : "balance"
  const skip = (page - 1) * limit

  if (q) {
    const where = {
      OR: [
        { username: { contains: q, mode: "insensitive" as const } },
        { email: { contains: q, mode: "insensitive" as const } },
        ...(isUuid(q) ? [{ id: q }] : []),
      ],
    }
    const [users, total] = await Promise.all([
      prisma.users.findMany({ where, select: USER_SELECT, orderBy: { created_at: "desc" }, skip, take: limit }),
      prisma.users.count({ where }),
    ])
    const groups = await prisma.point_ledger.groupBy({
      by: ["user_id"], where: { user_id: { in: users.map((u) => u.id) } },
      _sum: { delta: true }, _count: { _all: true }, _max: { created_at: true },
    })
    const g = new Map(groups.map((x) => [x.user_id, x]))
    return NextResponse.json({
      users: users.map((u) => ({ ...u, balance: g.get(u.id)?._sum.delta ?? 0, entries: g.get(u.id)?._count._all ?? 0, last_at: g.get(u.id)?._max.created_at ?? null })),
      total, page, limit,
    })
  }

  const [groups, distinct] = await Promise.all([
    prisma.point_ledger.groupBy({
      by: ["user_id"],
      _sum: { delta: true }, _count: { _all: true }, _max: { created_at: true },
      orderBy: sort === "recent" ? { _max: { created_at: "desc" } } : { _sum: { delta: "desc" } },
      skip, take: limit,
    }),
    prisma.point_ledger.findMany({ distinct: ["user_id"], select: { user_id: true } }),
  ])
  const users = await prisma.users.findMany({ where: { id: { in: groups.map((x) => x.user_id) } }, select: USER_SELECT })
  const u = new Map(users.map((x) => [x.id, x]))
  return NextResponse.json({
    users: groups.map((x) => ({
      ...(u.get(x.user_id) ?? { id: x.user_id, username: "(deleted)", email: null, avatar: null }),
      balance: x._sum.delta ?? 0, entries: x._count._all, last_at: x._max.created_at,
    })),
    total: distinct.length, page, limit,
  })
}
