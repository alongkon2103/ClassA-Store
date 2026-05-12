import { prisma } from "@/lib/prisma"
import { NextRequest, NextResponse } from "next/server"

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
            status: "paid",
        },
        include: {
            user_function_gifts: {
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

    // ── 🔥 NEW: premium vs default ───────────────────────────────
    let functions

    if (order.is_premium_order) {
        // premium → ใช้ของ order
        functions = order.user_function_gifts
    } else {
        // default → ดึงจากระบบ default จริง
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

        // map ให้ structure เหมือน user_function_gifts
        functions = defaultFunctions.map((fn) => ({
            product_functions: fn,
            gifts: fn.default_gift,
            gift_id: fn.default_gift?.id ?? null,
        }))
    }

    return NextResponse.json({
        whitelisted: true,
        mode: order.is_premium_order ? "premium" : "default",
        whitelisted_username: order.whitelisted_username,
        tiktok_username: order.tiktok_username ?? null,

        functions: functions.map((ufg: any) => ({
            name: ufg.product_functions.name,
            label_th: ufg.product_functions.label_th,
            label_en: ufg.product_functions.label_en,
            gift_id: ufg.gift_id,
            gift_name: ufg.gifts?.name ?? null,
            gift_image_url: ufg.gifts?.image_url ?? null,
            gift_diamonds: ufg.gifts?.diamonds ?? 0,
        })),
    })
}