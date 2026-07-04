import { prisma } from "@/lib/prisma"
import PayPalReviewClient from "./PayPalReviewClient"
import { setRequestLocale } from "next-intl/server"

export const dynamic = "force-dynamic"

export default async function PayPalReviewPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)

  const [queue, resolved, pendingOrders] = await Promise.all([
    // Unresolved payments — the worker couldn't auto-approve these.
    prisma.paypal_payments.findMany({
      where: { processed_at: null },
      orderBy: { created_at: "desc" },
      include: {
        matched_order: {
          select: { id: true, whitelisted_username: true, products: { select: { name_en: true } } },
        },
      },
    }),
    // Recently resolved (for context/audit) — last 20.
    prisma.paypal_payments.findMany({
      where: { processed_at: { not: null } },
      orderBy: { processed_at: "desc" },
      take: 20,
    }),
    // Candidate orders an admin can approve a payment into: still-pending paypal_me
    // orders. Includes expired ones (late payments) so late-but-genuine pays can be
    // matched by hand.
    prisma.orders.findMany({
      where: { payment_method: "paypal_me", status: "pending" },
      orderBy: { created_at: "desc" },
      take: 100,
      include: {
        users: { select: { username: true, email: true } },
        products: { select: { name_en: true } },
        product_variants: { select: { label_en: true } },
      },
    }),
  ])

  return (
    <PayPalReviewClient
      queue={queue.map((p) => ({
        id: p.id,
        txn_id: p.txn_id,
        gross_amount: Number(p.gross_amount),
        currency: p.currency,
        sender_name: p.sender_name,
        payment_status: p.payment_status,
        match_status: p.match_status,
        review_reason: p.review_reason,
        created_at: p.created_at.toISOString(),
        matched_order_id: p.matched_order_id,
        matched_order_ign: p.matched_order?.whitelisted_username ?? null,
      }))}
      resolved={resolved.map((p) => ({
        id: p.id,
        txn_id: p.txn_id,
        gross_amount: Number(p.gross_amount),
        currency: p.currency,
        sender_name: p.sender_name,
        match_status: p.match_status,
        processed_at: p.processed_at ? p.processed_at.toISOString() : null,
      }))}
      orders={pendingOrders.map((o) => ({
        id: o.id,
        expected_amount: o.expected_amount === null ? null : Number(o.expected_amount),
        expected_currency: o.expected_currency,
        whitelisted_username: o.whitelisted_username,
        username: o.users?.username ?? null,
        email: o.users?.email ?? null,
        product: o.products?.name_en ?? null,
        variant: o.product_variants?.label_en ?? null,
        created_at: o.created_at?.toISOString() ?? null,
        expires_at: o.expires_at ? o.expires_at.toISOString() : null,
      }))}
    />
  )
}
