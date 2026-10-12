import { NextResponse } from "next/server"
import { validateAdmin } from "@/lib/adminAuth"
import { parseWebAnnouncement } from "@/lib/webAnnouncementValidation"
import { deleteWebAnnouncement, saveWebAnnouncement, validAnnouncementId } from "@/lib/webAnnouncementStore"

type Context = { params: Promise<{ id: string }> }

export async function PATCH(req: Request, { params }: Context) {
  const admin = await validateAdmin(["admin"])
  if (!admin.isValid) return admin.response
  const { id } = await params
  if (!validAnnouncementId(id)) return NextResponse.json({ error: "not_found" }, { status: 404 })
  const parsed = parseWebAnnouncement(await req.json().catch(() => null))
  if ("error" in parsed) return NextResponse.json(parsed, { status: 400 })
  try {
    const item = await saveWebAnnouncement(parsed.data, id)
    return item ? NextResponse.json(item) : NextResponse.json({ error: "not_found" }, { status: 404 })
  } catch { return NextResponse.json({ error: "save_failed" }, { status: 500 }) }
}

export async function DELETE(_req: Request, { params }: Context) {
  const admin = await validateAdmin(["admin"])
  if (!admin.isValid) return admin.response
  const { id } = await params
  if (!validAnnouncementId(id)) return NextResponse.json({ error: "not_found" }, { status: 404 })
  try {
    const deleted = await deleteWebAnnouncement(id)
    return NextResponse.json(deleted ? { ok: true } : { error: "not_found" }, { status: deleted ? 200 : 404 })
  } catch { return NextResponse.json({ error: "delete_failed" }, { status: 500 }) }
}
