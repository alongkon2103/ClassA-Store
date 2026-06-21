import { NextResponse } from "next/server"
import { validateAdmin } from "@/lib/adminAuth"
import { prisma } from "@/lib/prisma"

// Create a manual sale recorded by an admin (Discord/cash/transfer/other
// channels that don't flow through Stripe). The created order has:
//   user_id        = null            (buyer has no site account)
//   recorded_by_id = admin.id        (audit trail)
//   payment_method = body.payment_method
//   status         = "paid"
//   paid_at        = body.paid_at ?? now
//
// Does NOT touch game_keys, whitelist, or stock — admin already fulfilled
// the order outside the system. Whitelist can be set later via the existing
// PATCH endpoint if needed.
export async function POST(req: Request) {
  const auth = await validateAdmin(["admin"])
  if (!auth.isValid || !auth.session) return auth.response

  const body = await req.json().catch(() => null) as {
    product_id?: string
    variant_id?: string | null
    amount?: number
    payment_method?: string
    buyer_label?: string
    in_game_name?: string | null
    already_fulfilled?: boolean
    manual_note?: string | null
    paid_at?: string | null
  } | null

  if (!body) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const {
    product_id, variant_id, amount, payment_method, buyer_label,
    in_game_name, already_fulfilled, manual_note, paid_at,
  } = body

  if (!product_id || typeof product_id !== "string") {
    return NextResponse.json({ error: "product_id required" }, { status: 400 })
  }
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "amount must be a positive number" }, { status: 400 })
  }
  if (!payment_method || typeof payment_method !== "string") {
    return NextResponse.json({ error: "payment_method required" }, { status: 400 })
  }
  if (!buyer_label || typeof buyer_label !== "string" || !buyer_label.trim()) {
    return NextResponse.json({ error: "buyer_label required" }, { status: 400 })
  }

  // Validate product (and variant if provided) exist + active
  const product = await prisma.products.findUnique({
    where: { id: product_id },
    select: { id: true, is_active: true },
  })
  if (!product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 })
  }

  if (variant_id) {
    const variant = await prisma.product_variants.findFirst({
      where: { id: variant_id, product_id },
      select: { id: true },
    })
    if (!variant) {
      return NextResponse.json({ error: "Variant does not belong to product" }, { status: 400 })
    }
  }

  let paidAtDate: Date
  if (paid_at) {
    const d = new Date(paid_at)
    if (Number.isNaN(d.getTime())) {
      return NextResponse.json({ error: "Invalid paid_at" }, { status: 400 })
    }
    paidAtDate = d
  } else {
    paidAtDate = new Date()
  }

  // Default to 'whitelisted' — admin recording a manual sale has already
  // handed off / whitelisted the buyer outside the system. Override to
  // 'pending' only if admin unchecks "already fulfilled" (e.g. needs to
  // come back and process whitelist later).
  const whitelistStatus = already_fulfilled === false ? "pending" : "whitelisted"

  const order = await prisma.orders.create({
    data: {
      product_id,
      variant_id: variant_id ?? null,
      amount,
      status: "paid",
      paid_at: paidAtDate,
      payment_method,
      buyer_label: buyer_label.trim(),
      whitelisted_username: in_game_name?.trim() || null,
      whitelist_status: whitelistStatus,
      fulfilled_at: already_fulfilled === false ? null : paidAtDate,
      manual_note: manual_note?.trim() || null,
      recorded_by_id: auth.session.user.id,
      order_type: "NEW",
      user_id: null,
    },
    include: {
      products: { select: { name_en: true, name_th: true } },
      product_variants: { select: { label_en: true, label_th: true } },
      recorded_by: { select: { id: true, username: true, avatar: true } },
    },
  })

  return NextResponse.json({
    ok: true,
    order: {
      ...order,
      amount: Number(order.amount),
      discount_amount: order.discount_amount === null ? null : Number(order.discount_amount),
      created_at: order.created_at?.toISOString() ?? null,
      paid_at: order.paid_at?.toISOString() ?? null,
    },
  })
}
