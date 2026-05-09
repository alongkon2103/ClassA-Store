import { prisma } from "@/lib/prisma"
import { NextRequest, NextResponse } from "next/server"

function checkApiKey(req: NextRequest) {
    if (process.env.NODE_ENV === "development") {
        return true
    }

    const apiKey = req.headers.get("x-api-key")

    return apiKey === process.env.API_CHCK_WHILIST_KEY
}

export async function POST(req: NextRequest) {
    try {
        if (!checkApiKey(req)) {
            return NextResponse.json(
                { error: "invalid api key" },
                { status: 403 }
            )
        }

        const body = await req.json()

        const { usernames, product_id } = body

        if (!Array.isArray(usernames) || usernames.length === 0) {
            return NextResponse.json(
                { error: "no usernames" },
                { status: 400 }
            )
        }

        if (!product_id) {
            return NextResponse.json(
                { error: "no product_id" },
                { status: 400 }
            )
        }

        const orders = await prisma.orders.findMany({
            where: {
                product_id,
                status: "paid",
                whitelist_status: "whitelisted",

                OR: usernames.map((username: string) => ({
                    whitelisted_username: {
                        equals: username,
                        mode: "insensitive",
                    },
                })),
            },

            include: {
                product_variants: true,
            },
        })

        const now = new Date()

        const mapped = orders.map((order) => {
            const variant = order.product_variants

            const isPermanent =
                !variant?.duration_type ||
                variant.duration_type === "permanent"

            if (isPermanent) {
                return {
                    username: order.whitelisted_username,
                    allowed: true,
                    variant: variant?.label_en,
                    expires_at: null,
                }
            }

            const paidAt = new Date(order.paid_at!)
            const expiresAt = new Date(paidAt)

            expiresAt.setDate(
                expiresAt.getDate() + (variant?.duration_days ?? 0)
            )

            const isExpired = now > expiresAt

            return {
                username: order.whitelisted_username,
                allowed: !isExpired,
                reason: isExpired ? "expired" : undefined,
                variant: variant?.label_en,
                expires_at: expiresAt.toISOString(),
                days_left: isExpired
                    ? 0
                    : Math.ceil(
                        (expiresAt.getTime() - now.getTime()) /
                        (1000 * 60 * 60 * 24)
                    ),
            }
        })

        const found = new Set(
            mapped.map((m) =>
                m.username?.toLowerCase()
            )
        )

        const notFound = usernames
            .filter(
                (u: string) =>
                    !found.has(u.toLowerCase())
            )
            .map((u: string) => ({
                username: u,
                allowed: false,
                reason: "not_whitelisted",
            }))

        return NextResponse.json({
            results: [...mapped, ...notFound],
        })

    } catch (err) {
        console.error(err)

        return NextResponse.json(
            {
                error: "internal server error",
            },
            { status: 500 }
        )
    }
}