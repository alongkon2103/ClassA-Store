import { prisma } from "@/lib/prisma"
import { reverseAffiliateEarning } from "@/lib/affiliateEarnings"
import { reversePointsForOrder } from "@/lib/points"

// Called only after gateway verification or an authenticated admin decision; never from a shopper's payload.
export async function recordTikkiesReversal(orderId: string, status: "refunded" | "revoked" | "disputed", actorId?: string) {
  return prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM orders WHERE id = ${orderId}::uuid FOR UPDATE`
    const order = await tx.orders.findUnique({ where: { id: orderId }, include: { products: { select: { type: true } } } })
    if (!order || order.products.type !== "roblox_whitelist") return false
    if (actorId) await tx.$executeRaw`SELECT set_config('app.actor_id', ${actorId}, true)`
    if (order.status !== "refunded" && order.status !== status) {
      await tx.orders.update({ where: { id: orderId }, data: {
        status, whitelist_status: "revoked", updated_at: new Date(),
        ...(actorId ? { manual_note: [order.manual_note, `${new Date().toISOString()} ${status} recorded by admin ${actorId}; gateway/offline refund verified by operator`].filter(Boolean).join("\n") } : {}),
      } })
    }
    await reverseAffiliateEarning(tx, orderId)
    await reversePointsForOrder(orderId, tx)
    // Shared IGN/game access also contains independent points/manual grants; only this owned order is reversed.
    return true
  }, { timeout: 10000 })
}
