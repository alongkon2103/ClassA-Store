import { prisma } from "@/lib/prisma"
import OrdersClient from "./OrdersClient"

export default async function AdminOrdersPage() {
  const rawOrders = await prisma.orders.findMany({
    orderBy: { created_at: "desc" },
    include: {
      users: {
        select: {
          username: true,
          email: true,
        },
      },
      products: {
        select: {
          name_en: true,
          product_images: {
            orderBy: { sort_order: "asc" },
            take: 1,
          },
        },
      },
      product_variants: {
        select: {
          label_en: true,
        },
      },
      game_keys: {
        select: {
          key_value: true,
        },
      },
    },
  })

  // ✅ Convert Decimals and Dates to Plain Objects
  const orders = rawOrders.map((o) => ({
    ...o,
    amount: Number(o.amount),
    created_at: o.created_at?.toISOString() || null,
    paid_at: o.paid_at?.toISOString() || null,
    fulfilled_at: o.fulfilled_at?.toISOString() || null,
    game_keys: o.game_keys ? {
      ...o.game_keys
    } : null,
    products: {
      ...o.products
    }
  }))

  return <OrdersClient orders={orders} />
}
