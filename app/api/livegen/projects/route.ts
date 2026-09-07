// โปรเจครูปไลฟ์ของผู้ใช้ — GET รายการ / POST สร้างใหม่
import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getFeatureFlags } from "@/lib/featureFlags"
import { parseProjectBody } from "@/lib/livegen/validate"

export const runtime = "nodejs"
const MAX_PROJECTS = 100

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const projects = await prisma.livegen_projects.findMany({
    where: { user_id: session.user.id },
    orderBy: { updated_at: "desc" },
    select: { id: true, name: true, orientation: true, thumbnail: true, product_id: true, updated_at: true },
  })
  return NextResponse.json({ projects })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  const flags = await getFeatureFlags()
  if (!flags.livegen_enabled) return NextResponse.json({ error: "disabled" }, { status: 404 })

  const parsed = parseProjectBody(await req.json().catch(() => null))
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 })

  const count = await prisma.livegen_projects.count({ where: { user_id: session.user.id } })
  if (count >= MAX_PROJECTS) return NextResponse.json({ error: "too_many_projects" }, { status: 429 })

  const row = await prisma.livegen_projects.create({
    data: { user_id: session.user.id, ...parsed.data },
    select: { id: true, updated_at: true },
  })
  return NextResponse.json({ ok: true, id: row.id, updated_at: row.updated_at })
}
