import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import type { product_functions } from "@prisma/client"

interface TikTokGift {
    giftId: number
    [key: string]: unknown
}

const TIKTOK_SERVICE_URL = process.env.NEXT_PUBLIC_TIKTOK_API_URL || "http://localhost:4000"
const TIKTOK_SERVICE_KEY = process.env.NEXT_PUBLIC_TIKTOK_API_KEY || "test"
const ROBLOX_API_KEY = process.env.API_CHCK_WHILIST_KEY || ""

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url)
        const username = searchParams.get("username")
        const key = searchParams.get("key")

        if (!username) return NextResponse.json({ error: "Username required" }, { status: 400 })
        
        // Simple security check
        if (ROBLOX_API_KEY && key !== ROBLOX_API_KEY) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        // 1. Fetch raw gifts from tiktok-service
        const serviceRes = await fetch(`${TIKTOK_SERVICE_URL}/fetch-gifts/${username}`, {
            headers: { "x-api-key": TIKTOK_SERVICE_KEY },
            cache: 'no-store'
        })

        if (!serviceRes.ok) {
            return NextResponse.json({ error: "Failed to fetch gifts from service" }, { status: serviceRes.status })
        }

        const { gifts } = await serviceRes.json()
        if (!gifts || gifts.length === 0) {
            return NextResponse.json({ gifts: [] })
        }

        // 2. Get mapping for this tiktok username
        const order = await prisma.orders.findFirst({
            where: { 
                tiktok_username: { equals: username, mode: 'insensitive' },
                status: 'paid',
                OR: [
                    { expires_at: null },
                    { expires_at: { gte: new Date() } }
                ]
            },
            include: {
                products: {
                    include: {
                        product_functions: true
                    }
                },
                user_function_gifts: {
                    include: {
                        product_functions: true
                    }
                }
            },
            orderBy: { created_at: 'desc' }
        })

        if (!order) {
            return NextResponse.json({ gifts: [], warning: "No active order found for this TikTok username" })
        }

        const isPremium = !!order.is_premium_order

        // 3. Map gifts to functions based on premium status
        const results = gifts.map((gift: TikTokGift) => {
            let mapping: { product_functions: product_functions | null } | null | undefined = null
            
            if (isPremium) {
                // Premium: Use user's custom mapping
                mapping = order.user_function_gifts.find(m => m.gift_id === Number(gift.giftId))
            } else {
                // Normal: Use product's default mapping
                const defaultFn = order.products.product_functions.find(f => f.default_gift_id === Number(gift.giftId))
                if (defaultFn) {
                    mapping = { product_functions: defaultFn }
                }
            }

            return {
                ...gift,
                functionName: mapping?.product_functions?.name || null,
                functionId: mapping?.product_functions?.id || null,
                isDefault: !isPremium
            }
        })

        return NextResponse.json({ gifts: results, isPremium })

    } catch (error) {
        console.error("Fetch gifts error:", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
