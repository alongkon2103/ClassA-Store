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
                    include: { gifts: true },
                },
            },
        })

        if (!order || order.user_id !== session.user.id) {
            return NextResponse.json({ error: "Not found" }, { status: 404 })
        }

        // Return the raw rows so clients can do active/standby and multi-gift
        // per function, matching the Electron InteractiveMapping flow.
        const mappings = order.user_function_gifts.map((row) => ({
            id: row.id,
            function_id: row.function_id,
            gift_id: row.gift_id,
            is_enabled: row.is_enabled,
            trigger_threshold: row.trigger_threshold,
            gifts: row.gifts,
        }))

        return NextResponse.json({
            mappings,
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
        // New array shape: [{functionId, giftId, isEnabled, triggerThreshold}, ...]
        // Multiple rows per function are allowed (active/standby pool).
        type IncomingMapping = {
            functionId: string
            giftId: number | string
            isEnabled?: boolean
            triggerThreshold?: number | string | null
        }
        const mappings: IncomingMapping[] = Array.isArray(body.mappings) ? body.mappings : []
        const isPremium = !!order.is_premium_order

        await prisma.orders.update({
            where: { id },
            data: { tiktok_username: body.tiktok_username ?? null },
        })

        if (isPremium) {
            // Replace the whole pool for this order in one transaction.
            // deleteMany + createMany matches the Electron API's updateMapping
            // pattern and avoids the composite-unique constraint that no longer
            // exists on user_function_gifts.
            const rowsToInsert = mappings
                .filter((m) => m.functionId && m.giftId !== undefined && m.giftId !== null)
                .map((m) => ({
                    user_id: userId,
                    order_id: id,
                    function_id: m.functionId,
                    gift_id: Number(m.giftId),
                    is_enabled: m.isEnabled !== false,
                    trigger_threshold: m.triggerThreshold ? Number(m.triggerThreshold) : null,
                }))

            await prisma.$transaction([
                prisma.user_function_gifts.deleteMany({
                    where: { user_id: userId, order_id: id },
                }),
                ...(rowsToInsert.length > 0
                    ? [prisma.user_function_gifts.createMany({ data: rowsToInsert })]
                    : []),
            ])
        }

        return NextResponse.json({ ok: true })
    } catch (error) {
        console.error("POST settings error:", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}