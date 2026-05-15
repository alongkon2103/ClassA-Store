
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { startOfDay } from "date-fns"

export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return NextResponse.json({ hasUsedTrial: false, unauthorized: true })
        }

        const todayStart = startOfDay(new Date())

        const trialOrder = await prisma.orders.findFirst({
            where: {
                user_id: session.user.id,
                order_type: "TRIAL",
                created_at: { gte: todayStart }
            }
        })

        const configs = await prisma.system_configs.findMany()
        const configMap = configs.reduce((acc, curr) => {
            acc[curr.key] = curr.value
            return acc
        }, {} as Record<string, string>)

        const trialMinutes = configMap["free_trial_duration"] ? parseInt(configMap["free_trial_duration"]) : 10
        const isTrialEnabled = configMap["free_trial_enabled"] !== "false" // Default to true if not found

        return NextResponse.json({ 
            hasUsedTrial: !!trialOrder,
            trialDuration: trialMinutes,
            isTrialEnabled
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

    // 0. Check if Trial is Enabled
    const trialEnabledConfig = await prisma.system_configs.findUnique({
        where: { key: "free_trial_enabled" }
    })
    if (trialEnabledConfig?.value === "false") {
        return NextResponse.json({ error: "Free trial system is currently disabled." }, { status: 403 })
    }

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

    // 2. Get Dynamic Duration
    const trialConfig = await prisma.system_configs.findUnique({
        where: { key: "free_trial_duration" }
    })
    const trialMinutes = trialConfig ? parseInt(trialConfig.value) : 10
    const trialDuration = trialMinutes * 60 * 1000 // duration in ms

    // 3. Create Trial Order
    const expiresAt = new Date(Date.now() + trialDuration)

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
                is_premium_order: false,
            },
        })

        // 4. Update Whitelist Access
        await tx.user_whitelist_access.upsert({
            where: {
                user_id_product_id: {
                    user_id: session.user.id,
                    product_id: product.id,
                },
            },
            create: {
                user_id: session.user.id,
                product_id: product.id,
                is_premium: false,
                expires_at: expiresAt,
            },
            update: {
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
