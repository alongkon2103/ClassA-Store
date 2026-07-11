// app/api/notifications/route.ts
//
// GET  → the logged-in user's own notifications (recent list + unread count).
// POST → mark notifications read. Body { id } marks one, {} marks all.
//
// Scoped strictly to the caller's own user_id.

import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const userId = session.user.id

  const [items, unread] = await Promise.all([
    prisma.notifications.findMany({
      where: { user_id: userId },
      orderBy: { created_at: "desc" },
      take: 30,
      select: { id: true, type: true, data: true, link: true, read_at: true, created_at: true },
    }),
    prisma.notifications.count({ where: { user_id: userId, read_at: null } }),
  ])

  return NextResponse.json({
    unread,
    items: items.map((n) => ({
      id: n.id,
      type: n.type,
      data: n.data ?? {},
      link: n.link,
      read: n.read_at != null,
      created_at: n.created_at.toISOString(),
    })),
  })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const userId = session.user.id

  const body = await req.json().catch(() => ({}))
  const id: string | undefined = typeof body.id === "string" ? body.id : undefined

  // Always constrain by user_id so a user can only mark their OWN as read.
  await prisma.notifications.updateMany({
    where: { user_id: userId, read_at: null, ...(id ? { id } : {}) },
    data: { read_at: new Date() },
  })

  const unread = await prisma.notifications.count({ where: { user_id: userId, read_at: null } })
  return NextResponse.json({ ok: true, unread })
}
