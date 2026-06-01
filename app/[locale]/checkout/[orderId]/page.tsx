import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"

import { notFound } from "next/navigation"
import CheckoutClient from "./CheckoutClient"
import { setRequestLocale } from "next-intl/server"

export default async function CheckoutPage({
  params,
}: {
  params: Promise<{ orderId: string, locale: string }>
}) {
  const { orderId, locale } = await params
  setRequestLocale(locale)

  const session = await getServerSession(authOptions)
  if (!session) redirect("/login")

  const [order, bankAccount] = await Promise.all([
    prisma.orders.findUnique({
      where: { id: orderId },
      include: {
        products: true,
        product_variants: true,
      },
    }),
    prisma.bank_accounts.findFirst({
      where: { is_active: true },
    }),
  ])

  if (!order) notFound()
  if (order.user_id !== session.user.id) redirect("/")
  if (order.status !== "pending") redirect(`/orders/${orderId}`)

  return (
    <CheckoutClient
      order={{
        ...order,
        amount: Number(order.amount),
        products: order.products ? {
          ...order.products,
          price: Number(order.products.price), 
        } : null,
        product_variants: order.product_variants ? {
          ...order.product_variants,
          price: Number(order.product_variants.price),
          premium_addon_price: Number(order.product_variants.premium_addon_price ?? 0),
          discount_pct: Number(order.product_variants.discount_pct ?? 0),
        } : null,
      }}
      bankAccount={bankAccount}
    />
  )
}
