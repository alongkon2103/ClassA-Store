import { NextRequest, NextResponse } from "next/server"
import { getPayPalAccessToken } from "@/lib/paypal"
import { readTikkiesBody } from "@/lib/integrations/tikkiesSecurity"
import { TikkiesError } from "@/lib/integrations/tikkies"
import { recordTikkiesReversal } from "@/lib/integrations/tikkiesReversal"
import { prisma } from "@/lib/prisma"
export const runtime = "nodejs"
export async function POST(req: NextRequest) {
  const headers = { "Cache-Control": "no-store" }
  if (!process.env.PAYPAL_WEBHOOK_ID) return NextResponse.json({ error: "webhook_unavailable" }, { status: 503, headers })
  const names = ["paypal-auth-algo", "paypal-cert-url", "paypal-transmission-id", "paypal-transmission-sig", "paypal-transmission-time"]
  if (names.some(name => !req.headers.get(name))) return NextResponse.json({ error: "unauthorized" }, { status: 401, headers })
  try {
    const event = await readTikkiesBody(req, 65536) as { event_type?: string; resource?: { id?: string; status?: string; supplementary_data?: { related_ids?: { capture_id?: string; order_id?: string } }; links?: { rel?: string; href?: string }[] } }
    const base = process.env.PAYPAL_BASE_URL || "https://api-m.sandbox.paypal.com"
    const verification = await fetch(`${base}/v1/notifications/verify-webhook-signature`, { method: "POST", headers: { Authorization: `Bearer ${await getPayPalAccessToken()}`, "Content-Type": "application/json" }, body: JSON.stringify({ auth_algo: req.headers.get(names[0]), cert_url: req.headers.get(names[1]), transmission_id: req.headers.get(names[2]), transmission_sig: req.headers.get(names[3]), transmission_time: req.headers.get(names[4]), webhook_id: process.env.PAYPAL_WEBHOOK_ID, webhook_event: event }), signal: AbortSignal.timeout(8000), cache: "no-store" })
    if (!verification.ok) throw new Error("verification_unavailable")
    if ((await verification.json()).verification_status !== "SUCCESS") return NextResponse.json({ error: "unauthorized" }, { status: 401, headers })
    if (["PAYMENT.CAPTURE.REFUNDED", "PAYMENT.CAPTURE.REVERSED"].includes(event.event_type ?? "")) {
      const resource = event.resource
      let captureId = resource?.supplementary_data?.related_ids?.capture_id
      if (!captureId && event.event_type === "PAYMENT.CAPTURE.REVERSED") captureId = resource?.id
      if (!captureId) for (const link of resource?.links ?? []) {
        if (link.rel !== "up" || !link.href) continue
        const url = new URL(link.href)
        if (url.origin === new URL(base).origin) captureId = /^\/v2\/payments\/captures\/([A-Za-z0-9]+)$/.exec(url.pathname)?.[1]
      }
      const orderId = resource?.supplementary_data?.related_ids?.order_id
      if (!captureId && !orderId) return NextResponse.json({ error: "capture_reference_missing" }, { status: 503, headers })
      const order = await prisma.orders.findFirst({ where: { OR: [...(captureId ? [{ paypal_capture_id: captureId }] : []), ...(orderId ? [{ paypal_order_id: orderId }] : [])] }, select: { id: true } })
      if (!order) return NextResponse.json({ error: "order_association_pending" }, { status: 503, headers })
      await recordTikkiesReversal(order.id, event.event_type === "PAYMENT.CAPTURE.REFUNDED" ? "refunded" : "revoked")
    }
    return NextResponse.json({ ok: true }, { headers })
  } catch (error) { return NextResponse.json({ error: "webhook_unavailable" }, { status: error instanceof TikkiesError ? error.status : 503, headers }) }
}
