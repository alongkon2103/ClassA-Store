import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { claimDailyPoints, getDailyStatus, getPointsBalance } from "@/lib/points"

// แต้มรายวัน: GET = สถานะวันนี้ (ไม่ล็อกอินก็ตอบได้ แค่ claimedToday=false) · POST = กดรับ (วันละครั้ง รีเซ็ตเที่ยงคืนเวลาไทย)
export const dynamic = "force-dynamic"

export async function GET() {
  const session = await getServerSession(authOptions)
  const status = await getDailyStatus(session?.user?.id ?? null)
  return NextResponse.json({ ...status, signedIn: !!session?.user?.id }, { headers: { "Cache-Control": "no-store" } })
}

export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  const r = await claimDailyPoints(session.user.id)
  if (!r.ok) {
    const status = await getDailyStatus(session.user.id)
    return NextResponse.json({ error: r.error, ...status }, { status: r.error === "disabled" ? 400 : 409 })
  }
  const [status, balance] = await Promise.all([getDailyStatus(session.user.id), getPointsBalance(session.user.id)])
  return NextResponse.json({ ...status, ok: true, points: r.points, balance })
}
