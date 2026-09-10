import { NextResponse } from "next/server"
import { getPointsConfig, pointsActive } from "@/lib/points"

// กติกาแต้มแบบสาธารณะ (ไม่มีข้อมูลผู้ใช้) ให้ modal ซื้อโชว์ "จะได้รับ x AC Points"
export async function GET() {
  const cfg = await getPointsConfig()
  return NextResponse.json(
    { enabled: pointsActive(cfg), per_baht: cfg.perBaht },
    { headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" } },
  )
}
