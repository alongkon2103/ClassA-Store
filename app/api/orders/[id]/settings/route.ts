// app/api/orders/[id]/settings/route.ts
import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

type RouteContext = {
    params: Promise<{ id: string }>
}

export async function GET(_req: Request, { params }: RouteContext) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

        const { id } = await params

        const order = await prisma.orders.findUnique({
            where: { id },
            include: { 
                user_function_gifts: {
                    include: { gifts: true }
                } 
            },
        })

        if (!order || order.user_id !== session.user.id) {
            return NextResponse.json({ error: "Not found" }, { status: 404 })
        }

        const mapping: Record<string, number> = {}
        const thresholds: Record<string, number> = {}
        for (const row of order.user_function_gifts) {
            mapping[row.function_id] = row.gift_id
            if (row.trigger_threshold) {
                thresholds[row.function_id] = row.trigger_threshold
            }
        }

        return NextResponse.json({
            mapping,
            thresholds,
            tiktok_username: order.tiktok_username ?? null,
        })
    } catch (error) {
        console.error("GET settings error:", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
export async function POST(req: Request, { params }: RouteContext) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

        const userId = session.user.id // ← assert ให้ชัดก่อน

        const { id } = await params

        const order = await prisma.orders.findUnique({ where: { id } })

        if (!order || order.user_id !== userId) {
            return NextResponse.json({ error: "Order not found" }, { status: 404 })
        }

        // ← แยก check status ออกมา เพื่อ debug ได้ง่ายขึ้น
        if (order.status !== "paid" && order.status !== "Admin Buy") {
            return NextResponse.json(
                {
                    error: `Order status is '${order.status}', expected 'paid' or 'Admin Buy'`,
                },
                { status: 403 }
            )
        }

        // Check expiration
        if (order.expires_at && new Date() > new Date(order.expires_at)) {
            return NextResponse.json({ error: "Order has expired" }, { status: 403 })
        }

        const body = await req.json()
        const mapping: Record<string, number> = body.mapping || {}
        const thresholds: Record<string, number> = body.thresholds || {}
        const isPremium = !!order.is_premium_order

        await prisma.orders.update({
            where: { id },
            data: { tiktok_username: body.tiktok_username ?? null },
        })

        if (isPremium && Object.keys(mapping).length > 0) {
            // Get gifts to validate trigger types
            const giftIds = Object.values(mapping).map(id => Number(id))
            const gifts = await prisma.gifts.findMany({
                where: { id: { in: giftIds } }
            })

            await prisma.$transaction(
                Object.entries(mapping).map(([functionId, giftId]) => {
                    const gift = gifts.find(g => g.id === Number(giftId))
                    const threshold = gift?.trigger_type === 'Like' ? thresholds[functionId] : null
                    
                    return prisma.user_function_gifts.upsert({
                        where: {
                            user_id_order_id_function_id: {
                                user_id: userId, // ← ใช้ userId ที่ assert แล้ว
                                order_id: id,
                                function_id: functionId,
                            },
                        },
                        create: {
                            user_id: userId,
                            order_id: id,
                            function_id: functionId,
                            gift_id: Number(giftId),
                            trigger_threshold: threshold ? Number(threshold) : null,
                        },
                        update: {
                            gift_id: Number(giftId),
                            trigger_threshold: threshold ? Number(threshold) : null,
                        },
                    })
                })
            )

            await prisma.user_function_gifts.deleteMany({
                where: {
                    user_id: userId,
                    order_id: id,
                    function_id: { notIn: Object.keys(mapping) },
                },
            })
        }

        return NextResponse.json({ ok: true })
    } catch (error) {
        console.error("POST settings error:", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}