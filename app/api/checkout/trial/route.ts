
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { startOfDay } from "date-fns"

export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions)
        
        const configs = await prisma.system_configs.findMany()
        const configMap = configs.reduce((acc, curr) => {
            acc[curr.key] = curr.value
            return acc
        }, {} as Record<string, string>)

        const trialDays = configMap["free_trial_duration"] ? parseInt(configMap["free_trial_duration"]) : 1
        const isTrialEnabled = configMap["free_trial_enabled"] !== "false"
        const isTrialPremium = configMap["free_trial_is_premium"] === "true"

        let hasUsedTrial = false
        if (session?.user?.id) {
            const todayStart = startOfDay(new Date())
            const trialOrder = await prisma.orders.findFirst({
                where: {
                    user_id: session.user.id,
                    order_type: "TRIAL",
                    created_at: { gte: todayStart }
                }
            })
            hasUsedTrial = !!trialOrder
        }

        return NextResponse.json({ 
            hasUsedTrial,
            trialDuration: trialDays,
            isTrialEnabled,
            isTrialPremium
        })
    } catch (err) {
        return NextResponse.json({ error: "Failed to check trial status" }, { status: 500 })
    }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // 0. Check configs
    const configs = await prisma.system_configs.findMany({
        where: {
            key: { in: ["free_trial_enabled", "free_trial_duration", "free_trial_is_premium"] }
        }
    })
    const configMap = configs.reduce((acc, curr) => {
        acc[curr.key] = curr.value
        return acc
    }, {} as Record<string, string>)

    if (configMap["free_trial_enabled"] === "false") {
        return NextResponse.json({ error: "Free trial system is currently disabled." }, { status: 403 })
    }

    const trialDays = configMap["free_trial_duration"] ? parseInt(configMap["free_trial_duration"]) : 1
    const isTrialPremium = configMap["free_trial_is_premium"] === "true"

    const { productId, whitelistUsername } = await req.json()

    if (!whitelistUsername?.trim()) {
      return NextResponse.json({ error: "In-game username is required" }, { status: 400 })
    }

    const product = await prisma.products.findUnique({
      where: { id: productId },
    })

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 })
    }

    // 1. Check Daily Quota
    const todayStart = startOfDay(new Date())
    const existingTrial = await prisma.orders.findFirst({
        where: {
            user_id: session.user.id,
            order_type: "TRIAL",
            created_at: { gte: todayStart }
        }
    })

    if (existingTrial) {
        return NextResponse.json({ error: "You have already used your free trial for today. Reset at midnight." }, { status: 400 })
    }

    // 2. Calculation
    const trialDurationMs = trialDays * 24 * 60 * 60 * 1000

    // 3. Create Trial Order
    const expiresAt = new Date(Date.now() + trialDurationMs)

    const order = await prisma.$transaction(async (tx) => {
        const newOrder = await tx.orders.create({
            data: {
                user_id: session.user.id,
                product_id: product.id,
                amount: 0,
                status: "paid",
                payment_method: "free_trial",
                whitelisted_username: whitelistUsername.trim(),
                whitelist_status: "whitelisted",
                order_type: "TRIAL",
                paid_at: new Date(),
                expires_at: expiresAt,
                is_premium_order: isTrialPremium,
            },
        })

        // 4. Update Whitelist Access
        await tx.user_whitelist_access.upsert({
            where: {
                ign_product_id: {
                    ign: whitelistUsername.trim(),
                    product_id: product.id,
                },
            },
            create: {
                ign: whitelistUsername.trim(),
                product_id: product.id,
                is_premium: isTrialPremium,
                expires_at: expiresAt,
            },
            update: {
                is_premium: isTrialPremium,
                expires_at: expiresAt,
                updated_at: new Date(),
            },
        })

        return newOrder
    })

    return NextResponse.json({ success: true, orderId: order.id })
  } catch (err) {
    console.error("Trial checkout error:", err)
    return NextResponse.json({ error: "Failed to activate trial" }, { status: 500 })
  }
}
