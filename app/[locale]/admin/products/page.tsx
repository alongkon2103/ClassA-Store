import { prisma } from "@/lib/prisma"
import ProductsClient from "./ProductsClient"
import { setRequestLocale } from "next-intl/server"

export default async function AdminProductsPage({
  params
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const products = await prisma.products.findMany({
    orderBy: { created_at: "desc" },
    include: {
      product_images: { orderBy: { sort_order: "asc" }, take: 1 },
      product_variants: {
        where: { is_active: true },
        include: {
          _count: { select: { game_keys: { where: { status: "available" } } } },
        },
      },
      _count: { select: { orders: true } },
    },
  })

  const safe = products.map((p) => ({
    ...p,
    price: Number(p.price),
    commission_pct: Number(p.commission_pct ?? 0),
    product_variants: p.product_variants.map((v) => ({
      ...v,
      price: Number(v.price),
      premium_addon_price: Number(v.premium_addon_price ?? 0),
      stock: v._count.game_keys,
    })),
  }))

  return <ProductsClient products={safe} />
}