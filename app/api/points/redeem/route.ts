// แลก AC Points: POST { reward_id, ign? } → หักแต้ม + ให้ของรางวัล (lib/pointsRedeem) · รายการ/ประวัติ render จากหน้า /account/redeem ฝั่ง server
import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { RedeemError, redeemReward } from "@/lib/pointsRedeem"

export const dynamic = "force-dynamic"

const STATUS: Record<string, number> = {
  disabled: 400, ign_required: 400, ign_invalid: 400, ign_not_found: 400,
  not_found: 404, product_unavailable: 404,
  insufficient: 409, limit_reached: 409, out_of_stock: 409, already_permanent: 409,
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  if (typeof body.reward_id !== "string") return NextResponse.json({ error: "not_found" }, { status: 404 })
  try {
    const r = await redeemReward({ userId: session.user.id, rewardId: body.reward_id, ign: typeof body.ign === "string" ? body.ign : null })
    return NextResponse.json({ ok: true, ...r })
  } catch (e) {
    if (e instanceof RedeemError) return NextResponse.json({ error: e.code }, { status: STATUS[e.code] ?? 400 })
    console.error("redeem failed:", e)
    return NextResponse.json({ error: "server_error" }, { status: 500 })
  }
}
