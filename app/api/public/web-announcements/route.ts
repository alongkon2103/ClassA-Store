import { NextResponse } from "next/server"
import { announcementStatus, nextAnnouncementChange } from "@/lib/webAnnouncements"
import { listWebAnnouncements } from "@/lib/webAnnouncementStore"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const items = await listWebAnnouncements()
    const now = Date.now()
    return NextResponse.json({
      announcements: items.filter((a) => announcementStatus(a, now) === "active"),
      nextChangeAt: nextAnnouncementChange(items, now),
    }, { headers: { "Cache-Control": "no-store" } })
  } catch {
    return NextResponse.json({ announcements: [], nextChangeAt: null }, { status: 503, headers: { "Cache-Control": "no-store" } })
  }
}
