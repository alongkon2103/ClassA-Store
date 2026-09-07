// โปรเจครูปไลฟ์ 1 โปรเจค — GET เต็ม / PUT บันทึกทับ / DELETE (ของตัวเองเท่านั้น)
import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { parseProjectBody } from "@/lib/livegen/validate"

export const runtime = "nodejs"
type Ctx = { params: Promise<{ id: string }> }

async function own(id: string) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return { error: NextResponse.json({ error: "unauthorized" }, { status: 401 }) }
  const row = await prisma.livegen_projects.findUnique({ where: { id }, select: { user_id: true } })
  if (!row || row.user_id !== session.user.id) return { error: NextResponse.json({ error: "not_found" }, { status: 404 }) }
  return { userId: session.user.id }
}

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { id } = await params
  const o = await own(id)
  if ("error" in o) return o.error
  const project = await prisma.livegen_projects.findUnique({
    where: { id },
    select: { id: true, name: true, orientation: true, canvas_json: true, thumbnail: true, product_id: true, updated_at: true },
  })
  return NextResponse.json({ project })
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  const { id } = await params
  const o = await own(id)
  if ("error" in o) return o.error
  const parsed = parseProjectBody(await req.json().catch(() => null))
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 })
  const row = await prisma.livegen_projects.update({
    where: { id },
    data: { ...parsed.data, updated_at: new Date() },
    select: { updated_at: true },
  })
  return NextResponse.json({ ok: true, updated_at: row.updated_at })
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { id } = await params
  const o = await own(id)
  if ("error" in o) return o.error
  await prisma.livegen_projects.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
