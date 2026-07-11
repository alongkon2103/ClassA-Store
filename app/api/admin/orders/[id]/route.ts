import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { validateAdmin } from "@/lib/adminAuth"
import { releaseOrderDiscount } from "@/lib/discountCodes"
import { reverseAffiliateEarning } from "@/lib/affiliateEarnings"

const RELEASE_DISCOUNT_STATUSES = new Set(["expired", "cancelled"])

// Closed sets — everything downstream (revenue pages, whitelist checks,
// fulfillment) branches on exact string values, so a typo or ad-hoc status
// would silently fall through every report.
const ALLOWED_STATUSES = new Set(["pending", "paid", "expired", "cancelled", "Admin Buy"])
const ALLOWED_WHITELIST_STATUSES = new Set(["pending", "whitelisted", "expired"])

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await validateAdmin(["admin"])
  if (!admin.isValid) return admin.response

  const { id }  = await params
  const body    = await req.json()

  if (body.status && !ALLOWED_STATUSES.has(body.status)) {
    return NextResponse.json({ error: `Invalid status: ${body.status}` }, { status: 400 })
  }
  if (body.whitelist_status && !ALLOWED_WHITELIST_STATUSES.has(body.whitelist_status)) {
    return NextResponse.json({ error: `Invalid whitelist_status: ${body.whitelist_status}` }, { status: 400 })
  }

  // Fetch the order first to check for discounts
  const order = await prisma.orders.findUnique({
    where: { id },
    include: { products: true, product_variants: true }
  })
  
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 })

  const becomingPaid = body.status === "paid" && order.status !== "paid"
  const shouldIncrementDiscount = becomingPaid && !!(
    order.variant_id &&
    order.products.has_limited_discount &&
    order.product_variants &&
    Number(order.product_variants.discount_pct) > 0 &&
    (order.product_variants.discount_used ?? 0) < (order.product_variants.discount_limit ?? 0)
  )

  // ถ้า admin เปลี่ยน order เป็น expired/cancelled และ order ใช้ discount code อยู่
  // → คืน slot ของ code นั้น (เหมือนกรณี Stripe expired webhook)
  const shouldReleaseCode =
    body.status &&
    RELEASE_DISCOUNT_STATUSES.has(body.status) &&
    !RELEASE_DISCOUNT_STATUSES.has(order.status) &&
    !!order.discount_code_id

  // Cancelling/expiring an order undoes any affiliate commission it earned.
  // reverseAffiliateEarning no-ops when there's no earning, so this is safe on
  // every order; it flags clawback if the commission was already paid out.
  const shouldReverseEarning =
    body.status &&
    RELEASE_DISCOUNT_STATUSES.has(body.status) &&
    !RELEASE_DISCOUNT_STATUSES.has(order.status)

  const result = await prisma.$transaction(async (tx) => {
    if (shouldReleaseCode) {
      await releaseOrderDiscount(tx, id)
    }
    if (shouldReverseEarning) {
      await reverseAffiliateEarning(tx, id)
    }

    const updatedOrder = await tx.orders.update({
      where: { id },
      data: {
        ...(body.whitelist_status && { whitelist_status: body.whitelist_status }),
        ...(body.status           && { status: body.status }),
        // A paid order without paid_at appears in status-based totals but
        // vanishes from every time-series chart (they all filter/bucket on
        // paid_at) — stamp it when the admin flips an order to paid.
        ...(becomingPaid && !order.paid_at && { paid_at: new Date() }),
        ...(body.whitelist_status === "whitelisted" && { fulfilled_at: new Date() }),
        updated_at: new Date(),
      },
    })

    if (shouldIncrementDiscount) {
      await tx.product_variants.update({
        where: { id: order.variant_id! },
        data: { discount_used: { increment: 1 } }
      })
    }

    return updatedOrder
  })

  return NextResponse.json({ ...result, amount: Number(result.amount) })
}