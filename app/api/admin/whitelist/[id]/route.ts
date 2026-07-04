import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { validateAdmin } from "@/lib/adminAuth"
import { computeWhitelistExpiry } from "@/lib/formatExpiresAt"

// Edit a whitelist row: in-game name (ign), game (product_id), premium flag, and
// duration/permanent. user_whitelist_access has no user_id, so there's no user to
// change here — this row is the source of truth the desktop *check* uses.
//
// It also SYNCS every matching order (found by the OLD ign + OLD product, since
// there's no order↔whitelist key) so the user-facing "My Orders", license
// activation, and admin orders don't go stale. is_premium/ign/product are always
// synced; expires_at only when the form actually changed duration/permanent.
export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const adminCheck = await validateAdmin(["admin"])
    if (!adminCheck.isValid) return adminCheck.response

    try {
        const { id } = await params
        const body = await req.json()
        const { ign, productId, isPremium, durationDays, isPermanent } = body

        const existing = await prisma.user_whitelist_access.findUnique({ where: { id } })
        if (!existing) {
            return NextResponse.json({ error: "Record not found" }, { status: 404 })
        }

        // Resolve final values (fall back to existing when a field wasn't sent).
        const newIgn = typeof ign === "string" && ign.trim() ? ign.trim() : existing.ign
        const newProductId = typeof productId === "string" && productId ? productId : existing.product_id
        const newPremium = typeof isPremium === "boolean" ? isPremium : existing.is_premium
        const changeExpiry = isPermanent === true || durationDays !== undefined
        const newExpiry = changeExpiry
            ? computeWhitelistExpiry(Number(durationDays), !!isPermanent)
            : existing.expires_at

        const result = await prisma.$transaction(async (tx) => {
            // 1. The whitelist row (source of truth for the desktop check).
            const updated = await tx.user_whitelist_access.update({
                where: { id },
                data: {
                    ign: newIgn,
                    product_id: newProductId,
                    is_premium: newPremium,
                    ...(changeExpiry ? { expires_at: newExpiry } : {}),
                    updated_at: new Date(),
                },
            })

            // 2. Every order that belonged to this entry (matched by OLD ign +
            //    OLD product, case-insensitive like the check route).
            const synced = await tx.orders.updateMany({
                where: {
                    whitelisted_username: { equals: existing.ign, mode: "insensitive" },
                    product_id: existing.product_id,
                },
                data: {
                    whitelisted_username: newIgn,
                    product_id: newProductId,
                    is_premium_order: newPremium,
                    whitelist_status: "whitelisted",
                    updated_at: new Date(),
                    ...(changeExpiry ? { expires_at: newExpiry } : {}),
                },
            })

            return { updated, syncedOrders: synced.count }
        })

        return NextResponse.json({ ...result.updated, syncedOrders: result.syncedOrders })
    } catch (error: unknown) {
        // Unique [ign, product_id] collision — renamed onto an existing row.
        if ((error as { code?: string })?.code === "P2002") {
            return NextResponse.json(
                { error: "A whitelist entry with this name already exists for that game" },
                { status: 409 }
            )
        }
        console.error("[WHITELIST_PATCH]", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}

export async function DELETE(
    req: NextRequest, // Updated to NextRequest
    { params }: { params: Promise<{ id: string }> } // Updated to Promise type
) {
    const adminCheck = await validateAdmin(["admin"])
    if (!adminCheck.isValid) return adminCheck.response

    try {
        // This is perfect, now TypeScript knows it's a Promise and can be awaited properly
        const { id } = await params

        await prisma.user_whitelist_access.delete({
            where: { id }
        })

        return NextResponse.json({ message: "Whitelist record deleted successfully" })
    } catch (error) {
        console.error("[WHITELIST_DELETE]", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}