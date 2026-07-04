import { prisma } from "@/lib/prisma"
import { NextRequest, NextResponse } from "next/server"

// Common shape shared by premium (user_function_gifts) and default rows.
type WhitelistFunctionRow = {
  product_functions: { name: string; label_th: string | null; label_en: string | null }
  gifts: { name: string; image_url: string | null; diamonds: number; trigger_type: string | null } | null
  gift_id: number | null
  trigger_threshold: number | null
}

export async function GET(req: NextRequest) {
    const apiKey = req.headers.get("x-api-key")
    if (!apiKey || apiKey !== process.env.WHITELIST_API_KEY) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const username = req.nextUrl.searchParams.get("username")
    const productId = req.nextUrl.searchParams.get("product_id")

    if (!username || !productId) {
        return NextResponse.json(
            { error: "username and product_id are required" },
            { status: 400 }
        )
    }

    const order = await prisma.orders.findFirst({
        where: {
            whitelisted_username: { equals: username, mode: "insensitive" },
            product_id: productId,
            whitelist_status: "whitelisted",
            status: {
                in: ["paid", "Admin Buy"],
            },
            OR: [
                { expires_at: null },
                { expires_at: { gt: new Date() } },
            ],
        },
        orderBy: [
            { is_premium_order: "desc" },
            { expires_at: "desc" },
        ],
        include: {
            user_function_gifts: {
                where: { is_enabled: true },
                include: {
                    product_functions: true,
                    gifts: true,
                },
            },
        },
    })

    if (!order) {
        return NextResponse.json({ whitelisted: false }, { status: 404 })
    }

    let functions: WhitelistFunctionRow[]

    if (order.is_premium_order) {
        functions = order.user_function_gifts
    } else {
        const defaultFunctions = await prisma.product_functions.findMany({
            where: {
                product_id: productId,
            },
            include: {
                default_gift: true,
            },
            orderBy: {
                sort_order: "asc",
            },
        })

        functions = defaultFunctions.map((fn) => ({
            product_functions: fn,
            gifts: fn.default_gift,
            gift_id: fn.default_gift?.id ?? null,
            trigger_threshold: fn.default_trigger_threshold,
        }))
    }

    return NextResponse.json({
        whitelisted: true,
        mode: order.is_premium_order ? "premium" : "default",
        whitelisted_username: order.whitelisted_username,
        tiktok_username: order.tiktok_username ?? null,

        functions: functions.map((ufg) => ({
            name: ufg.product_functions.name,
            label_th: ufg.product_functions.label_th,
            label_en: ufg.product_functions.label_en,
            gift_id: ufg.gift_id,
            gift_name: ufg.gifts?.name ?? null,
            gift_image_url: ufg.gifts?.image_url ?? null,
            gift_diamonds: ufg.gifts?.diamonds ?? 0,
            trigger_type: ufg.gifts?.trigger_type ?? null,
            trigger_threshold: ufg.trigger_threshold ?? null,
        })),
    })
}