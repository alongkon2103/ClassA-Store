import { prisma } from "@/lib/prisma"
import AdminOrdersClient from "./AdminOrdersClient"

export const dynamic = "force-dynamic"

export default async function AdminOrdersPage() {
  const orders = await prisma.orders.findMany({
    where: {
      NOT: { order_type: "TRIAL" },
      status: "paid",
    },
    orderBy: { created_at: "desc" },
    include: {
      users:            { select: { username: true, avatar: true, email: true } },
      products:         { select: { name_en: true, name_th: true } },
      product_variants: { select: { label_en: true, label_th: true } },
      recorded_by:      { select: { username: true, avatar: true } },
    },
  })

  return (
    <AdminOrdersClient
      orders={orders.map((o) => ({
        ...o,
        amount:          Number(o.amount),
        discount_amount: o.discount_amount === null ? null : Number(o.discount_amount),
        expected_amount: o.expected_amount === null ? null : Number(o.expected_amount),
        created_at:      o.created_at?.toISOString() ?? null,
        paid_at:         o.paid_at?.toISOString()    ?? null,
      }))}
    />
  )
}