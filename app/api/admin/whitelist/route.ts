import { resolveTikkiesBinding } from "@/lib/integrations/tikkiesRoblox"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { validateAdmin } from "@/lib/adminAuth"
import { computeWhitelistExpiry } from "@/lib/formatExpiresAt"
import { EMAIL_WHITELIST_NOTE, RETIRED_EMAIL_WHITELIST_NOTE, literalInsensitive, parseWhitelistGrant, resolveEmailWhitelistRecipient, WhitelistGrantInputError, withPendingWhitelistEmails } from "@/lib/manualWhitelistEmail"

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

        return NextResponse.json(await withPendingWhitelistEmails(prisma, whitelist))
    } catch (error) {
        console.error("[WHITELIST_GET]", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}

export async function POST(req: Request) {
    const adminCheck = await validateAdmin()
    if (!adminCheck.isValid) return adminCheck.response

    try {
        const { userId, email, ign, productId, isPremium, durationDays, isPermanent } = parseWhitelistGrant(await req.json().catch(() => null))

        // Permanent → year-9999 sentinel; otherwise now + durationDays.
        const expiresAt = computeWhitelistExpiry(durationDays, !!isPermanent)

        const robloxBinding = await resolveTikkiesBinding(ign)
        const result = await prisma.$transaction(async (tx) => {
            await tx.$executeRaw`SELECT set_config('app.actor_id', ${adminCheck.session!.user.id}, true)`
            const recipientId = userId ?? (email ? await resolveEmailWhitelistRecipient(tx, email) : null)
            // Serialize updates of the same player/game, including concurrent
            // email reservations, before retiring its previous unclaimed grant.
            await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${productId + ':' + ign.toLowerCase()}, 0))`
            await tx.orders.updateMany({
                where: { user_id: null, product_id: productId, whitelisted_username: literalInsensitive(ign), manual_note: EMAIL_WHITELIST_NOTE, payment_method: "admin_manual", order_type: "TRIAL" },
                data: { whitelist_status: "revoked", manual_note: RETIRED_EMAIL_WHITELIST_NOTE },
            })
            // 1. Create Order
            const order = await tx.orders.create({
                data: {
                    ...robloxBinding,
                    user_id: recipientId,
                    ...(email ? { buyer_label: email, manual_note: EMAIL_WHITELIST_NOTE } : {}),
                    recorded_by_id: adminCheck.session!.user.id,
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
        }, { isolationLevel: 'ReadCommitted' })

        return NextResponse.json({ ...result.whitelist, pendingEmail: result.order.user_id ? null : email })
    } catch (error) {
        if (error instanceof WhitelistGrantInputError) return NextResponse.json({ error: error.message }, { status: 400 })
        if ((error as { code?: string })?.code === "P2003") return NextResponse.json({ error: "Selected user or product does not exist" }, { status: 400 })
        console.error("[WHITELIST_POST]", { code: (error as { code?: string })?.code ?? "unknown" })
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
