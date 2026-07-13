// PayPal checkout — mirrors /api/checkout (Stripe) for the discount, premium,
// and pending-order-reuse paths. Differences:
//   - amount is converted from THB → USD using a 6h-cached rate
//   - no card surcharge (PayPal absorbs its own fee for sandbox testing)
//   - returns { url } pointing at the PayPal approval flow; on approve, PayPal
//     redirects to /api/checkout/paypal/capture which finalises the order
//
// Discount-code reservation is identical (same atomic updateMany + redemption row)
// so a code reserved here can't double-spend with a Stripe checkout.

import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { evaluateDiscount, countUserRedemptions, releaseOrderDiscount } from "@/lib/discountCodes"
import { resolveReferralCodeId } from "@/lib/affiliateEarnings"
import { createPayPalOrder, getThbToUsdRate, convertThbToUsd } from "@/lib/paypal"
import { getPaymentConfig, computeFeeAmount } from "@/lib/paymentConfig"
import type { discount_codes } from "@prisma/client"

export const runtime = "nodejs"

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { productId, variantId, locale = "en", whitelistUsername, isPremium, discountCode, refCode } = await req.json()

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
          OR: [
            { status: "paid" },
            { status: "pending", expires_at: { gt: new Date() } },
          ],
        },
      })
      if (usedCount < discountLimit) hasDiscount = true
    }

    if (hasDiscount && variant) {
      const discountPct = Number(variant.discount_pct)
      basePrice = basePrice - basePrice * (discountPct / 100)
    }

    let title = variant ? `${product.name_en} (${variant.label_en})` : (product.name_en || "Order")

    let premiumPrice = 0
    if (isPremium) {
      const premiumVar = product.product_variants.find((v) => v.variant_type === "premium")
      if (premiumVar) {
        premiumPrice = Number(premiumVar.premium_addon_price || 0)
        title += " + PREMIUM"
      }
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
    if (!paymentConfig.paypal.enabled) {
      return NextResponse.json(
        { error: "Payment method disabled", errorCode: "METHOD_DISABLED" },
        { status: 400 },
      )
    }
    const paypalFee = computeFeeAmount(baseAfterDiscount, paymentConfig.paypal.fee_pct)
    const totalThb = baseAfterDiscount + paypalFee

    // PayPal session expires after ~3 hours by default; we mirror that on our
    // own order so abandoned PayPal sessions don't hold a discount slot forever.
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000)

    // Affiliate referral (/r/<code>) — stored even without an applied discount.
    const referralCodeId = await resolveReferralCodeId(refCode, product.id)

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
              payment_method: "paypal",
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

          const orderData = {
            amount: totalThb,
            payment_method: "paypal",
            whitelisted_username: whitelistUsername.trim(),
            is_premium_order: !!isPremium,
            expires_at: expiresAt,
            discount_code_id: discountCodeRow && discountAmount > 0 ? discountCodeRow.id : null,
            discount_amount: discountAmount > 0 ? discountAmount : null,
            referral_code_id: referralCodeId,
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
      if ((err as Error)?.message === "DISCOUNT_LIMIT_REACHED") {
        return NextResponse.json(
          { error: "Discount invalid", errorCode: "LIMIT_REACHED" },
          { status: 409 },
        )
      }
      throw err
    }

    const protocol = req.headers.get("x-forwarded-proto") || "http"
    const host = req.headers.get("host")
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `${protocol}://${host}`

    const rate = await getThbToUsdRate()
    const usdAmount = convertThbToUsd(totalThb, rate)
    if (!Number.isFinite(usdAmount) || usdAmount <= 0) {
      return NextResponse.json({ error: "Invalid price calculation" }, { status: 400 })
    }

    const currency = process.env.PAYPAL_CURRENCY || "USD"
    const returnUrl = `${baseUrl}/api/checkout/paypal/capture?orderId=${order.id}&locale=${encodeURIComponent(locale)}`
    const cancelUrl = `${baseUrl}/${locale}/orders/${order.id}?paypal=cancelled`

    const paypal = await createPayPalOrder({
      amount: usdAmount,
      currency,
      description: title,
      customId: order.id,
      returnUrl,
      cancelUrl,
    })

    await prisma.orders.update({
      where: { id: order.id },
      data: { paypal_order_id: paypal.id },
    })

    return NextResponse.json({ url: paypal.approveUrl })
  } catch (err: unknown) {
    console.error("PayPal Checkout Error:", {
      message: (err as Error).message,
      stack: (err as Error).stack,
    })
    return NextResponse.json({ error: "Checkout failed", details: (err as Error).message }, { status: 500 })
  }
}
