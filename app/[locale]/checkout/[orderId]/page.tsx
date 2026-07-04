import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect, notFound } from "next/navigation"
import CheckoutClient from "./CheckoutClient"
import PayPalMeCheckout from "./PayPalMeCheckout"
import { getPayPalMeLink, buildPayPalMePayUrl } from "@/lib/paypalMe"
import { setRequestLocale } from "next-intl/server"

export default async function CheckoutPage({
  params,
}: {
  params: Promise<{ orderId: string; locale: string }>
}) {
  const { orderId, locale } = await params
  setRequestLocale(locale)

  const session = await getServerSession(authOptions)
  if (!session) redirect("/login")

  const order = await prisma.orders.findUnique({
    where: { id: orderId },
    include: {
      products: true,
      product_variants: true,
    },
  })

  if (!order) notFound()
  if (order.user_id !== session.user.id) redirect("/")
  if (order.status !== "pending") redirect(`/orders/${orderId}`)

  // paypal_me orders pay by hand against a unique amount — dedicated pay page.
  if (order.payment_method === "paypal_me") {
    const link = await getPayPalMeLink()
    const expectedAmount = Number(order.expected_amount ?? 0)
    const expectedCurrency = order.expected_currency ?? "USD"
    const payUrl = buildPayPalMePayUrl(link, expectedAmount, expectedCurrency)

    return (
      <PayPalMeCheckout
        order={{
          id: order.id,
          expected_amount: expectedAmount,
          expected_currency: expectedCurrency,
          amount: Number(order.amount),
          expires_at: order.expires_at ? order.expires_at.toISOString() : null,
          whitelisted_username: order.whitelisted_username,
          products: order.products
            ? { name_th: order.products.name_th, name_en: order.products.name_en }
            : null,
          product_variants: order.product_variants
            ? { label_th: order.product_variants.label_th, label_en: order.product_variants.label_en }
            : null,
        }}
        payUrl={payUrl}
        paypalMeLink={link}
      />
    )
  }

  // Default promptpay/slip flow.
  const bankAccount = await prisma.bank_accounts.findFirst({
    where: { is_active: true },
  })

  return (
    <CheckoutClient
      order={{
        ...order,
        amount: Number(order.amount),
        discount_amount: order.discount_amount === null ? null : Number(order.discount_amount),
        expected_amount: order.expected_amount === null ? null : Number(order.expected_amount),
        products: order.products
          ? {
              ...order.products,
              price: Number(order.products.price),
            }
          : null,
        product_variants: order.product_variants
          ? {
              ...order.product_variants,
              price: Number(order.product_variants.price),
              premium_addon_price: Number(order.product_variants.premium_addon_price ?? 0),
              discount_pct: Number(order.product_variants.discount_pct ?? 0),
            }
          : null,
      }}
      bankAccount={bankAccount}
    />
  )
}
