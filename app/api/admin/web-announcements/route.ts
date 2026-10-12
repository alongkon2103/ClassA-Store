import { NextResponse } from "next/server"
import { validateAdmin } from "@/lib/adminAuth"
import { parseWebAnnouncement } from "@/lib/webAnnouncementValidation"
import { listWebAnnouncements, saveWebAnnouncement } from "@/lib/webAnnouncementStore"

export async function GET() {
  const admin = await validateAdmin(["admin"])
  if (!admin.isValid) return admin.response
  try { return NextResponse.json(await listWebAnnouncements(), { headers: { "Cache-Control": "no-store" } }) }
  catch { return NextResponse.json({ error: "load_failed" }, { status: 500 }) }
}

export async function POST(req: Request) {
  const admin = await validateAdmin(["admin"])
  if (!admin.isValid) return admin.response
  const parsed = parseWebAnnouncement(await req.json().catch(() => null))
  if ("error" in parsed) return NextResponse.json(parsed, { status: 400 })
  try { return NextResponse.json(await saveWebAnnouncement(parsed.data), { status: 201 }) }
  catch { return NextResponse.json({ error: "save_failed" }, { status: 500 }) }
}
