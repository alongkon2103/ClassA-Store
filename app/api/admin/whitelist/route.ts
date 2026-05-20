import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { validateAdmin } from "@/lib/adminAuth"
import { addDays } from "date-fns"

export async function GET() {
    const adminCheck = await validateAdmin()
    if (!adminCheck.isValid) return adminCheck.response

    try {
        const whitelist = await prisma.user_whitelist_access.findMany({
            include: {
                products: {
                    select: {
                        id: true,
                        name_th: true,
                        name_en: true,
                        slug: true
                    }
                }
            },
            orderBy: {
                updated_at: 'desc'
            }
        })

        return NextResponse.json(whitelist)
    } catch (error) {
        console.error("[WHITELIST_GET]", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}

export async function POST(req: Request) {
    const adminCheck = await validateAdmin()
    if (!adminCheck.isValid) return adminCheck.response

    try {
        const body = await req.json()
        const { userId, ign, productId, isPremium, durationDays } = body

        if (!userId || !ign || !productId || durationDays === undefined) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
        }

        // Calculate expiration date
        const expiresAt = addDays(new Date(), durationDays)

        const result = await prisma.$transaction(async (tx) => {
            // 1. Create Order
            const order = await tx.orders.create({
                data: {
                    user_id: userId,
                    product_id: productId,
                    amount: 0,
                    status: "paid",
                    payment_method: "admin_manual",
                    order_type: "TRIAL",
                    whitelisted_username: ign,
                    is_premium_order: isPremium,
                    paid_at: new Date(),
                    expires_at: expiresAt,
                    whitelist_status: "whitelisted"
                }
            })

            // 2. Upsert Whitelist Access
            const whitelist = await tx.user_whitelist_access.upsert({
                where: {
                    ign_product_id: {
                        ign: ign,
                        product_id: productId
                    }
                },
                update: {
                    is_premium: isPremium,
                    expires_at: expiresAt,
                    updated_at: new Date()
                },
                create: {
                    ign: ign,
                    product_id: productId,
                    is_premium: isPremium,
                    expires_at: expiresAt
                }
            })

            return { order, whitelist }
        })

        return NextResponse.json(result.whitelist)
    } catch (error) {
        console.error("[WHITELIST_POST]", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
