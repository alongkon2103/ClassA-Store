// // app/api/checkout/route.ts

// import { NextResponse } from "next/server"
// import { getServerSession } from "next-auth"
// import { authOptions } from "@/lib/auth"
// import { prisma } from "@/lib/prisma"
// import Stripe from "stripe"

// const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

// export async function POST(req: Request) {
//   try {
//     const session = await getServerSession(authOptions)
//     if (!session?.user?.id) {
//       return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
//     }

//     // 1. รับค่า isPremium เพิ่มเข้ามา
//     const { productId, variantId, paymentMethod, locale = "en", whitelistUsername, isPremium } = await req.json()

//     if (!whitelistUsername?.trim()) {
//       return NextResponse.json({ error: "In-game username is required" }, { status: 400 })
//     }

//     const product = await prisma.products.findUnique({
//       where: { id: productId },
//       include: { product_variants: true },
//     })

//     if (!product) {
//       return NextResponse.json({ error: "Product not found" }, { status: 404 })
//     }

//     // 2. ค้นหา Variant หลักที่เลือก
//     const variant = product.product_variants.find(v => v.id === variantId)
//     let basePrice = variant ? Number(variant.price) : Number(product.price)
    
//     // --- Discount Logic (Robust Check) ---
//     let hasDiscount = false
//     if (product.has_limited_discount && variant && Number(variant.discount_pct) > 0) {
//       const discountLimit = Number(variant.discount_limit ?? 0)
      
//       // Count existing paid orders AND active pending orders
//       const usedCount = await prisma.orders.count({
//         where: {
//           variant_id: variant.id,
//           OR: [
//             { status: "paid" },
//             { 
//               status: "pending",
//               expires_at: { gt: new Date() } // Only count pending orders that haven't expired
//             }
//           ]
//         }
//       })

//       if (usedCount < discountLimit) {
//         hasDiscount = true
//       }
//     }

//     if (hasDiscount && variant) {
//       const discountPct = Number(variant.discount_pct)
//       basePrice = basePrice - (basePrice * (discountPct / 100))
//     }

//     let title = variant ? `${product.name_en} (${variant.label_en})` : product.name_en

//     // 3. จัดการเรื่อง Premium Add-on
//     let premiumPrice = 0
//     if (isPremium) {
//       const premiumVar = product.product_variants.find(v => v.variant_type === "premium")
//       if (premiumVar) {
//         premiumPrice = Number(premiumVar.premium_addon_price || 0)
//         title += " + PREMIUM"
//       }
//     }

//     const currentSubtotal = basePrice + premiumPrice

//     // 4. ✅ คำนวณราคารวมค่าธรรมเนียมก่อน เพื่อให้ order ในฐานข้อมูลได้ราคาที่ถูกต้อง
//     const cardFee = paymentMethod === "card" ? currentSubtotal * 0.06 : 0
//     const totalPrice = currentSubtotal + cardFee

//     const sessionExpiryMinutes = 10 // Shorten expiry to 10 minutes to free up locked discounts
//     const expiresAt = new Date(Date.now() + sessionExpiryMinutes * 60 * 1000)

//     // 5. เช็ค pending order เดิม
//     let order = await prisma.orders.findFirst({
//       where: {
//         user_id: session.user.id,
//         product_id: product.id,
//         variant_id: variant?.id || null,
//         status: "pending",
//         payment_method: paymentMethod,
//       },
//     })

//     if (!order) {
//       order = await prisma.orders.create({
//         data: {
//           user_id: session.user.id,
//           product_id: product.id,
//           variant_id: variant?.id,
//           amount: totalPrice, 
//           status: "pending",
//           payment_method: paymentMethod ?? "promptpay",
//           whitelisted_username: whitelistUsername.trim(),
//           whitelist_status: "pending",
//           is_premium_order: !!isPremium,
//           expires_at: expiresAt,
//         },
//       })
//     } else {
//       order = await prisma.orders.update({
//         where: { id: order.id },
//         data: {
//           whitelisted_username: whitelistUsername.trim(),
//           amount: totalPrice, 
//           payment_method: paymentMethod,
//           is_premium_order: !!isPremium,
//           expires_at: expiresAt,
//         },
//       })
//     }

//     const protocol = req.headers.get("x-forwarded-proto") || "http"
//     const host = req.headers.get("host")
//     const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `${protocol}://${host}`

//     const stripeSession = await stripe.checkout.sessions.create({
//       mode: "payment",
//       payment_method_types: paymentMethod === "card" ? ["card"] : ["promptpay"],
//       expires_at: Math.floor(expiresAt.getTime() / 1000),

//       line_items: [
//         {
//           price_data: {
//             currency: "thb",
//             product_data: {
//               name: title,
//               description: isPremium ? "Included Premium Add-on" : undefined
//             },
//             unit_amount: Math.round(totalPrice * 100),
//           },
//           quantity: 1,
//         },
//       ],

//       success_url: `${baseUrl}/${locale}/orders/${order.id}`,
//       cancel_url: `${baseUrl}/${locale}/products`,

//       metadata: {
//         orderId: order.id,
//         productId: product.id,
//         variantId: variant?.id || "",
//         whitelistUsername: whitelistUsername.trim(),
//         isPremium: isPremium ? "true" : "false",
//       },
//     })

//     await prisma.orders.update({
//       where: { id: order.id },
//       data: { stripe_session_id: stripeSession.id },
//     })

//     return NextResponse.json({ url: stripeSession.url })
//   } catch (err) {
//     console.error(err)
//     return NextResponse.json({ error: "Checkout failed" }, { status: 500 })
//   }
// }
// app/api/checkout/route.ts

import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { evaluateDiscount, countUserRedemptions, releaseOrderDiscount } from "@/lib/discountCodes"
import { getPaymentConfig, computeFeeAmount } from "@/lib/paymentConfig"
import type { discount_codes } from "@prisma/client"
import Stripe from "stripe"

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // 1. รับค่า isPremium เพิ่มเข้ามา
    const { productId, variantId, paymentMethod, locale = "en", whitelistUsername, isPremium, discountCode } = await req.json()

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

    // 2. ค้นหา Variant หลักที่เลือก
    const variant = product.product_variants.find(v => v.id === variantId)
    let basePrice = variant ? Number(variant.price) : Number(product.price)

    // --- Discount Logic (Robust Check) ---
    let hasDiscount = false
    if (product.has_limited_discount && variant && Number(variant.discount_pct) > 0) {
      const discountLimit = Number(variant.discount_limit ?? 0)

      // Count existing paid orders AND active pending orders
      const usedCount = await prisma.orders.count({
        where: {
          variant_id: variant.id,
          OR: [
            { status: "paid" },
            {
              status: "pending",
              expires_at: { gt: new Date() }, // Only count pending orders that haven't expired
            },
          ],
        },
      })

      if (usedCount < discountLimit) {
        hasDiscount = true
      }
    }

    if (hasDiscount && variant) {
      const discountPct = Number(variant.discount_pct)
      basePrice = basePrice - basePrice * (discountPct / 100)
    }

    let title = variant ? `${product.name_en} (${variant.label_en})` : product.name_en

    // 3. จัดการเรื่อง Premium Add-on
    let premiumPrice = 0
    if (isPremium) {
      const premiumVar = product.product_variants.find(v => v.variant_type === "premium")
      if (premiumVar) {
        premiumPrice = Number(premiumVar.premium_addon_price || 0)
        title += " + PREMIUM"
      }
    }

    const preDiscountSubtotal = basePrice + premiumPrice

    // 3.5 ตรวจ discount code (ถ้ามี) — เช็คอย่างเดียว ยังไม่ increment ใน DB
    // การ increment จะทำใน transaction ตอนสร้าง order เพื่อกัน race
    let discountCodeRow: discount_codes | null = null
    let discountAmount = 0
    if (typeof discountCode === "string" && discountCode.trim()) {
      const codeUpper = discountCode.trim().toUpperCase()
      discountCodeRow = await prisma.discount_codes.findUnique({ where: { code: codeUpper } })
      // นับ redemption ของ user ที่ยังไม่ expired/cancelled — abandoned order ที่ expire
      // จะไม่นับ ทำให้ user กลับมาใช้โค้ดใหม่ได้
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

    const currentSubtotal = Math.max(0, preDiscountSubtotal - discountAmount)

    // Pull per-method fee/enabled from system_configs (cached 30s). Admin can
    // change %, toggle methods on/off in /admin/settings without redeploy.
    const paymentConfig = await getPaymentConfig()
    const methodKey: "card" | "promptpay" = paymentMethod === "promptpay" ? "promptpay" : "card"
    if (!paymentConfig[methodKey].enabled) {
      return NextResponse.json(
        { error: "Payment method disabled", errorCode: "METHOD_DISABLED" },
        { status: 400 },
      )
    }
    const cardFee = computeFeeAmount(currentSubtotal, paymentConfig[methodKey].fee_pct)
    const totalPrice = currentSubtotal + cardFee

    // Pending window = 24h for both card and PromptPay. 1440 min is Stripe's
    // maximum Checkout Session lifetime (PromptPay sessions must be 10–1440 min),
    // so this is the longest runway Stripe allows. (The PromptPay QR itself may
    // still expire earlier on Stripe's side.)
    const sessionExpiryMinutes = 1440
    const expiresAt = new Date(Date.now() + sessionExpiryMinutes * 60 * 1000)

    // 5. เช็ค pending order เดิม + reserve discount slot ใน transaction
    // ใช้ atomic update กัน race condition: ถ้าคนกดพร้อมกัน 100 คน โค้ดที่ used_count
    // ถึง limit จะ updateMany คืน count = 0 และเรา throw → rollback ทั้ง txn
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
            payment_method: paymentMethod,
          },
        })

        // ถ้ามี order เก่าและเคยใช้ code ไว้ → คืน slot ก่อน (จะใส่ใหม่ทีหลัง)
        if (existing?.discount_code_id) {
          await releaseOrderDiscount(tx, existing.id)
        }

        // ถ้ามี code ใหม่ → reserve slot (atomic, กัน race)
        // โค้ดไม่จำกัดสิทธิ์ (max_uses=null) ข้ามเช็คเพดานไปเลย — ห้ามใช้ sentinel
        // อย่าง MAX_SAFE_INTEGER เพราะเกินช่วง Postgres int4 แล้ว query พังทันที
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
          if (reserved.count === 0) {
            throw new Error("DISCOUNT_LIMIT_REACHED")
          }
        }

        const orderData = {
          amount: totalPrice,
          payment_method: paymentMethod,
          whitelisted_username: whitelistUsername.trim(),
          is_premium_order: !!isPremium,
          expires_at: expiresAt,
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
              payment_method: paymentMethod ?? "promptpay",
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
        {
          // maxWait: รอ slot ใน connection pool ก่อนเริ่ม txn (default 2s — สั้นไป ถ้า pool ตึง)
          // timeout: max time ของตัว txn body
          maxWait: 10_000,
          timeout: 15_000,
        },
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

    // ✅ FIX: Validate totalPrice before sending to Stripe
    const unitAmount = Math.round(totalPrice * 100)
    if (!unitAmount || unitAmount <= 0 || isNaN(unitAmount)) {
      console.error("Invalid unit_amount:", unitAmount, "totalPrice:", totalPrice)
      return NextResponse.json({ error: "Invalid price calculation" }, { status: 400 })
    }

    const stripeExpiresAt = Math.floor(expiresAt.getTime() / 1000)

    const stripeSession = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: paymentMethod === "card" ? ["card"] : ["promptpay"],
      expires_at: stripeExpiresAt,

      line_items: [
        {
          price_data: {
            currency: "thb",
            product_data: {
              // ✅ FIX: Removed optional `description: undefined` — passing undefined
              // fields can cause Stripe 400 errors in some SDK versions
              name: title,
            },
            unit_amount: unitAmount,
          },
          quantity: 1,
        },
      ],

      success_url: `${baseUrl}/${locale}/orders/${order.id}`,
      cancel_url: `${baseUrl}/${locale}/products`,

      metadata: {
        orderId: order.id,
        productId: product.id,
        variantId: variant?.id || "",
        whitelistUsername: whitelistUsername.trim(),
        isPremium: isPremium ? "true" : "false",
      },
    })

    await prisma.orders.update({
      where: { id: order.id },
      data: { stripe_session_id: stripeSession.id },
    })

    return NextResponse.json({ url: stripeSession.url })
  } catch (err: unknown) {
    const e = err as { message?: string; type?: string; raw?: unknown; stack?: string }
    console.error("Checkout Error Detail:", {
      message: e.message,
      type: e.type,
      raw: e.raw,
      stack: e.stack,
    })
    return NextResponse.json({ error: "Checkout failed", details: e.message }, { status: 500 })
  }
}