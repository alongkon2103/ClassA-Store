// app/api/whitelist/setting/route.ts
import { prisma } from "@/lib/prisma"
import { NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest) {
    // ── API Key Auth ─────────────────────────────────────────────
    const apiKey = req.headers.get("x-api-key")
    if (!apiKey || apiKey !== process.env.WHITELIST_API_KEY) {
        return NextResponse.json(
            { error: "Unauthorized" },
            { status: 401 }
        )
    }

    // ── Params ───────────────────────────────────────────────────
    const username = req.nextUrl.searchParams.get("username")
    const productId = req.nextUrl.searchParams.get("product_id")

    if (!username || !productId) {
        return NextResponse.json(
            { error: "username and product_id are required" },
            { status: 400 }
        )
    }

    // ── Query ────────────────────────────────────────────────────
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

    return NextResponse.json({
        whitelisted: true,
        whitelisted_username: order.whitelisted_username,
        tiktok_username: order.tiktok_username ?? null,
        functions: order.user_function_gifts.map((ufg) => ({
            name: ufg.product_functions.name,
            label_th: ufg.product_functions.label_th,
            label_en: ufg.product_functions.label_en,
            gift_id: ufg.gift_id,
            gift_name: ufg.gifts.name,
            gift_image_url: ufg.gifts.image_url,
            gift_diamonds: ufg.gifts.diamonds,
        })),
    })
}