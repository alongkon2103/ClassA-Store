import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { createMakiCheckout, MakiCheckoutError } from "@/lib/makiOrders"

// ลูกค้ากด "ซื้อเลย" บนหน้าเกม Maki → สร้างออเดอร์ + ขอลิงก์จ่ายจาก Maki → client redirect ไป payment_url
const STATUS: Record<string, number> = { not_found: 404, unavailable: 400, no_identity: 400, onboarding: 503, below_min: 409, maki_error: 502, discount: 400 }

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const productId = String(body.product_id ?? "")
  const planKey = String(body.plan_key ?? "")
  if (!/^[0-9a-f-]{36}$/i.test(productId) || !/^[a-z0-9_]{3,60}$/i.test(planKey)) return NextResponse.json({ error: "bad_request" }, { status: 400 })
  try {
    const discountCode = typeof body.discount_code === "string" ? body.discount_code.trim().slice(0, 40) : null
    const r = await createMakiCheckout({ userId: session.user.id, provider: session.user.provider, partnerProductId: productId, planKey, locale: String(body.locale ?? "th"), discountCode })
    return NextResponse.json({ order_id: r.id, payment_url: r.payment_url, reused: r.reused })
  } catch (e) {
    if (e instanceof MakiCheckoutError) {
      if (e.code === "maki_error" || e.code === "onboarding") console.error("maki checkout:", e.code, e.message)
      return NextResponse.json({ error: e.code, ...(e.code === "discount" ? { errorCode: e.message } : {}) }, { status: STATUS[e.code] ?? 500 })
    }
    console.error("maki checkout failed:", e)
    return NextResponse.json({ error: "server_error" }, { status: 500 })
  }
}
