import { lookupTikkiesRoblox, resolveTikkiesBinding } from "@/lib/integrations/tikkiesRoblox"
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { validateAdmin } from "@/lib/adminAuth"
import { computeWhitelistExpiry } from "@/lib/formatExpiresAt"
import { BundleError, parseBundleSnapshot } from "@/lib/bundles"
import { BUNDLE_BLOCKED_WHITELIST } from "@/lib/bundleFulfillment"
import { retryAbortedTransaction } from "@/lib/transactionRetry"
import { grantManualBundle, retireManualBundles, MANUAL_BUNDLE_NOTE } from "@/lib/manualBundleGrant"
import { EMAIL_WHITELIST_NOTE, RETIRED_EMAIL_WHITELIST_NOTE, literalInsensitive } from "@/lib/manualWhitelistEmail"

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
        let newIgn = typeof ign === "string" && ign.trim() ? ign.trim() : existing.ign
        const newProductId = typeof productId === "string" && productId ? productId : existing.product_id
        const newPremium = typeof isPremium === "boolean" ? isPremium : existing.is_premium
        const changeExpiry = isPermanent === true || durationDays !== undefined
        const newExpiry = changeExpiry
            ? computeWhitelistExpiry(Number(durationDays), !!isPermanent)
            : existing.expires_at

        let robloxBinding = {}
        if (body.robloxUserId !== undefined) {
            if (typeof body.robloxUserId !== "string" || !/^[1-9][0-9]{0,31}$/.test(body.robloxUserId)) return NextResponse.json({ error: "Invalid Roblox User ID" }, { status: 400 })
            const identity = await lookupTikkiesRoblox(body.robloxUserId, true).catch(() => undefined)
            if (identity === undefined) return NextResponse.json({ error: "Roblox lookup unavailable; try again" }, { status: 503 })
            if (!identity) return NextResponse.json({ error: "Roblox account not found" }, { status: 400 })
            newIgn = identity.username
            robloxBinding = { roblox_user_id: identity.userId, roblox_username: identity.username, roblox_display_name: identity.displayName, roblox_resolved_for: newIgn.toLowerCase() }
        } else if (newIgn.toLowerCase() !== existing.ign.toLowerCase()) {
            robloxBinding = await resolveTikkiesBinding(newIgn)
        }
        const [oldProduct, newProduct] = await Promise.all([
            prisma.products.findUnique({ where: { id: existing.product_id }, select: { type: true } }),
            prisma.products.findUnique({ where: { id: newProductId }, select: { type: true } }),
        ])
        if (oldProduct?.type === 'bundle' || newProduct?.type === 'bundle') {
            if (newProductId !== existing.product_id) return NextResponse.json({ error: 'Create a separate membership grant to change product' }, { status: 400 })
            const result = await retryAbortedTransaction(() => prisma.$transaction(async tx => {
                await tx.$executeRaw`SELECT set_config('app.actor_id', ${adminCheck.session!.user.id}, true)`
                // Email claim and admin edit use the same recipient lock first.
                const candidate = await tx.orders.findFirst({ where: { product_id: existing.product_id, whitelisted_username: literalInsensitive(existing.ign), payment_method: 'admin_manual', order_type: 'BUNDLE', status: 'paid', manual_note: { in: [EMAIL_WHITELIST_NOTE, MANUAL_BUNDLE_NOTE] } }, orderBy: { created_at: 'desc' } })
                if (!candidate) throw new BundleError('No active manual membership. Create a new membership grant.', 409)
                if (candidate.buyer_label) await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${EMAIL_WHITELIST_NOTE + ':' + candidate.buyer_label}, 0))`
                for (const key of [...new Set([existing.ign.toLowerCase(), newIgn.toLowerCase()])].sort()) await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${existing.product_id + ':' + key}, 0))`
                const destination = await tx.user_whitelist_access.findFirst({ where: { product_id: existing.product_id, ign: literalInsensitive(newIgn), id: { not: existing.id } }, select: { id: true } })
                if (destination) throw new BundleError('A whitelist entry with this name already exists for that membership', 409)
                // Re-read after lock: a claim must never be replaced by stale ownership.
                const parent = await tx.orders.findUniqueOrThrow({ where: { id: candidate.id } })
                if (parent.status !== 'paid') throw new BundleError('Membership changed. Refresh and try again.', 409)
                const terms = parseBundleSnapshot(parent.bundle_snapshot)
                if (changeExpiry && (isPermanent !== undefined && typeof isPermanent !== 'boolean' || !isPermanent && (!Number.isSafeInteger(durationDays) || durationDays <= 0))) throw new BundleError('Invalid membership duration')
                const children = await tx.orders.findMany({ where: { bundle_parent_id: parent.id }, include: { products: { select: { type: true } } } })
                const excludedProductIds: string[] = []
                for (const child of children) {
                    let removed = child.status !== 'paid' || BUNDLE_BLOCKED_WHITELIST.includes(child.whitelist_status ?? '')
                    if (child.products.type === 'roblox_whitelist' && child.whitelisted_username) {
                        const access = await tx.user_whitelist_access.findUnique({ where: { ign_product_id: { ign: child.whitelisted_username, product_id: child.product_id } } })
                        removed ||= !access
                    } else if (child.products.type === 'desktop_program' && child.user_id) {
                        const access = await tx.user_program_access.findUnique({ where: { user_id_product_id: { user_id: child.user_id, product_id: child.product_id } } })
                        removed ||= !access || access.status === 'REVOKED'
                    }
                    if (removed) excludedProductIds.push(child.product_id)
                }
                await retireManualBundles(tx, existing.product_id, existing.ign)
                const granted = await grantManualBundle(tx, {
                    productId: existing.product_id, userId: parent.user_id, email: parent.buyer_label, ign: newIgn,
                    actorId: adminCheck.session!.user.id, isPermanent: changeExpiry ? isPermanent === true : terms.durationType === 'permanent',
                    durationDays: changeExpiry ? durationDays : terms.durationDays ?? 0,
                    now: changeExpiry ? undefined : parent.fulfilled_at!,
                    snapshot: { ...terms, ...(changeExpiry ? { durationType: isPermanent ? 'permanent' as const : 'days' as const, durationDays: isPermanent ? null : durationDays, renewalBaseExpiresAt: undefined } : {}) },
                    excludedProductIds,
                    robloxBinding: { roblox_user_id: parent.roblox_user_id, roblox_username: parent.roblox_username, roblox_display_name: parent.roblox_display_name, roblox_resolved_for: parent.roblox_resolved_for, ...robloxBinding },
                })
                if (newIgn !== existing.ign) await tx.user_whitelist_access.delete({ where: { id: existing.id } })
                return granted.whitelist
            }, { isolationLevel: 'ReadCommitted', maxWait: 10000, timeout: 60000 }))
            return NextResponse.json(result)
        }
        const result = await prisma.$transaction(async (tx) => {
            await tx.$executeRaw`SELECT set_config('app.actor_id', ${adminCheck.session!.user.id}, true)`
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
                    whitelisted_username: literalInsensitive(existing.ign),
                    product_id: existing.product_id,
                    OR: [{ manual_note: null }, { manual_note: { not: RETIRED_EMAIL_WHITELIST_NOTE } }],
                },
                data: {
                    ...robloxBinding,
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
        if (error instanceof BundleError) return NextResponse.json({ error: error.code }, { status: error.status })
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

        const existing = await prisma.user_whitelist_access.findUnique({ where: { id } })
        if (!existing) return NextResponse.json({ error: "Record not found" }, { status: 404 })
        await retryAbortedTransaction(() => prisma.$transaction(async tx => {
            await tx.$executeRaw`SELECT set_config('app.actor_id', ${adminCheck.session!.user.id}, true)`
            await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${existing.product_id + ':' + existing.ign.toLowerCase()}, 0))`
            await retireManualBundles(tx, existing.product_id, existing.ign)
            // Retiring the reservation marker is durable even if another
            // purchase or trial later recreates this player/game whitelist.
            await tx.orders.updateMany({
                where: { product_id: existing.product_id, whitelisted_username: literalInsensitive(existing.ign), manual_note: EMAIL_WHITELIST_NOTE, payment_method: "admin_manual", order_type: "TRIAL" },
                data: { whitelist_status: "revoked", manual_note: RETIRED_EMAIL_WHITELIST_NOTE },
            })
            await tx.user_whitelist_access.delete({ where: { id } })
        }, { maxWait: 10000, timeout: 60000 }))

        return NextResponse.json({ message: "Whitelist record deleted successfully" })
    } catch (error) {
        console.error("[WHITELIST_DELETE]", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
