// PayPal.me checkout — creates a "pay by hand" order whose ONLY identifier is a
// unique USD amount. Mirrors /api/checkout/paypal for the discount, premium and
// pending-order-reuse logic, but instead of calling the PayPal API it:
//   - converts the THB total to USD once (frozen — the live rate can drift later
//     without breaking the amount-based match)
//   - appends a unique random cent offset (pickUniqueExpectedAmount)
//   - stores expected_amount/expected_currency + a 30-min expiry
//   - returns { orderId } so the client can render the pay page
// Fulfillment happens later when the Gmail worker matches the incoming email.

import { NextResponse } from "next/server"
import type { discount_codes } from "@prisma/client"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { evaluateDiscount, countUserRedemptions, releaseOrderDiscount } from "@/lib/discountCodes"
import { getThbToUsdRate, convertThbToUsd } from "@/lib/paypal"
import { getPaymentConfig, computeFeeAmount } from "@/lib/paymentConfig"
import {
  PAYPAL_ME_EXPIRY_MS,
  getPayPalMeCurrency,
  isAmountInWindow,
  pickUniqueExpectedAmount,
} from "@/lib/paypalMe"

export const runtime = "nodejs"

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { productId, variantId, whitelistUsername, isPremium, discountCode } = await req.json()

    if (!whitelistUsername?.trim()) {
      return NextResponse.json({ error: "In-game username is required" }, { status: 400 })
    }

    const product = await prisma.products.findUnique({
      where: { id: productId },
      include: { product_variants: true },
    })
    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 })
    }

    const variant = product.product_variants.find((v) => v.id === variantId)
    let basePrice = variant ? Number(variant.price) : Number(product.price)

    let hasDiscount = false
    if (product.has_limited_discount && variant && Number(variant.discount_pct) > 0) {
      const discountLimit = Number(variant.discount_limit ?? 0)
      const usedCount = await prisma.orders.count({
        where: {
          variant_id: variant.id,
          OR: [{ status: "paid" }, { status: "pending", expires_at: { gt: new Date() } }],
        },
      })
      if (usedCount < discountLimit) hasDiscount = true
    }
    if (hasDiscount && variant) {
      const discountPct = Number(variant.discount_pct)
      basePrice = basePrice - basePrice * (discountPct / 100)
    }

    let premiumPrice = 0
    if (isPremium) {
      const premiumVar = product.product_variants.find((v) => v.variant_type === "premium")
      if (premiumVar) premiumPrice = Number(premiumVar.premium_addon_price || 0)
    }

    const preDiscountSubtotal = basePrice + premiumPrice

    let discountCodeRow: discount_codes | null = null
    let discountAmount = 0
    if (typeof discountCode === "string" && discountCode.trim()) {
      const codeUpper = discountCode.trim().toUpperCase()
      discountCodeRow = await prisma.discount_codes.findUnique({ where: { code: codeUpper } })
      const userUsed = discountCodeRow
        ? await countUserRedemptions(prisma, discountCodeRow.id, session.user.id)
        : 0
      const evalResult = evaluateDiscount(discountCodeRow, preDiscountSubtotal, product.id, userUsed)
      if (!evalResult.ok) {
        return NextResponse.json(
          { error: "Discount invalid", errorCode: evalResult.errorCode, params: evalResult.params },
          { status: 400 },
        )
      }
      discountAmount = evalResult.amountOff
    }

    const baseAfterDiscount = Math.max(0, preDiscountSubtotal - discountAmount)

    const paymentConfig = await getPaymentConfig()
    if (!paymentConfig.paypal_me.enabled) {
      return NextResponse.json(
        { error: "Payment method disabled", errorCode: "METHOD_DISABLED" },
        { status: 400 },
      )
    }
    const fee = computeFeeAmount(baseAfterDiscount, paymentConfig.paypal_me.fee_pct)
    const totalThb = baseAfterDiscount + fee

    // Freeze the charged amount NOW, in the admin-selected currency:
    //   USD → convert the THB total once (rate cached 6h, may drift later — the
    //         matcher only ever compares against this stored value).
    //   THB → the customer sends baht directly, so there is nothing to convert;
    //         the unique cent offset is added in satang instead.
    const currency = await getPayPalMeCurrency()
    const rate = currency === "USD" ? await getThbToUsdRate() : 1
    const baseAmount =
      currency === "USD" ? convertThbToUsd(totalThb, rate) : Math.round(totalThb * 100) / 100
    if (!Number.isFinite(baseAmount) || baseAmount <= 0) {
      return NextResponse.json({ error: "Invalid price calculation" }, { status: 400 })
    }

    const expiresAt = new Date(Date.now() + PAYPAL_ME_EXPIRY_MS)

    let order
    try {
      order = await prisma.$transaction(
        async (tx) => {
          const existing = await tx.orders.findFirst({
            where: {
              user_id: session.user.id,
              product_id: product.id,
              variant_id: variant?.id || null,
              status: "pending",
              payment_method: "paypal_me",
            },
          })

          if (existing?.discount_code_id) {
            await releaseOrderDiscount(tx, existing.id)
          }

          // Unlimited codes (max_uses=null) skip the cap check — a JS sentinel
          // like MAX_SAFE_INTEGER overflows Postgres int4 and kills the query.
          if (discountCodeRow && discountAmount > 0) {
            const reserved = await tx.discount_codes.updateMany({
              where: {
                id: discountCodeRow.id,
                is_active: true,
                ...(discountCodeRow.max_uses === null
                  ? {}
                  : { used_count: { lt: discountCodeRow.max_uses } }),
              },
              data: { used_count: { increment: 1 } },
            })
            if (reserved.count === 0) throw new Error("DISCOUNT_LIMIT_REACHED")
          }

          // Keep the existing pending order's frozen amount ONLY while it's still
          // valid for the current displayed price — same currency, same THB total
          // (fee/discount) AND the frozen amount is still within
          // [price .. next-whole-unit). If the admin switched currency, or the
          // rate/fee moved enough that the old figure is below the new price or
          // crossed a whole unit, mint a fresh amount in the new window.
          const existingAmt = existing?.expected_amount != null ? Number(existing.expected_amount) : null
          const sameCurrency = existing?.expected_currency === currency
          const sameBaseThb = existing != null && Math.abs(Number(existing.amount) - totalThb) < 0.01
          const canReuse =
            existingAmt != null && sameCurrency && sameBaseThb && isAmountInWindow(existingAmt, baseAmount)
          const expectedAmount = canReuse
            ? existingAmt
            : await pickUniqueExpectedAmount(tx, baseAmount, currency, existing?.id)

          const orderData = {
            amount: totalThb,
            payment_method: "paypal_me",
            whitelisted_username: whitelistUsername.trim(),
            is_premium_order: !!isPremium,
            expires_at: expiresAt,
            expected_amount: expectedAmount,
            expected_currency: currency,
            discount_code_id: discountCodeRow && discountAmount > 0 ? discountCodeRow.id : null,
            discount_amount: discountAmount > 0 ? discountAmount : null,
          }

          const saved = existing
            ? await tx.orders.update({ where: { id: existing.id }, data: orderData })
            : await tx.orders.create({
                data: {
                  ...orderData,
                  user_id: session.user.id,
                  product_id: product.id,
                  variant_id: variant?.id,
                  status: "pending",
                  whitelist_status: "pending",
                },
              })

          if (discountCodeRow && discountAmount > 0) {
            await tx.discount_redemptions.create({
              data: {
                discount_code_id: discountCodeRow.id,
                order_id: saved.id,
                user_id: session.user.id,
                amount_off: discountAmount,
              },
            })
          }

          return saved
        },
        { maxWait: 10_000, timeout: 15_000 },
      )
    } catch (err: unknown) {
      const message = (err as Error)?.message
      if (message === "DISCOUNT_LIMIT_REACHED") {
        return NextResponse.json({ error: "Discount invalid", errorCode: "LIMIT_REACHED" }, { status: 409 })
      }
      if (message === "PAYPAL_ME_NO_UNIQUE_AMOUNT") {
        return NextResponse.json(
          { error: "Please try again in a moment", errorCode: "NO_UNIQUE_AMOUNT" },
          { status: 503 },
        )
      }
      throw err
    }

    return NextResponse.json({ orderId: order.id })
  } catch (err: unknown) {
    const e = err as Error
    console.error("PayPal.me Checkout Error:", { message: e?.message, stack: e?.stack })
    return NextResponse.json({ error: "Checkout failed", details: e?.message }, { status: 500 })
  }
}
