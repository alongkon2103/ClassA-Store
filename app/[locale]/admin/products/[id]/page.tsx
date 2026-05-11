// app/admin/products/[id]/page.tsx
import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import ProductForm from "@/components/admin/products/ProductForm"
import { setRequestLocale } from "next-intl/server"

export default async function EditProductPage({
  params
}: {
  params: Promise<{ id: string, locale: string }>
}) {
  const { id, locale } = await params
  setRequestLocale(locale)

  const product = await prisma.products.findUnique({
    where: { id },
    include: {
      product_variants: { orderBy: { sort_order: "asc" } },
      product_images: { orderBy: { sort_order: "asc" } },
      product_gifts: { orderBy: { sort_order: "asc" } },
      product_presets: { orderBy: { sort_order: "asc" } },
      product_functions: { orderBy: { sort_order: "asc" } }, // ← เพิ่มตรงนี้
    },
  })
  if (!product) notFound()

  const gifts = await prisma.gifts.findMany({
    orderBy: { sort_order: "asc" }
  })

  const safe = {
    ...product,
    price: Number(product.price),
    commission_pct: Number(product.commission_pct ?? 0),
    product_variants: product.product_variants.map((v) => ({ 
      ...v, 
      price: Number(v.price),
      premium_addon_price: Number(v.premium_addon_price ?? 0)
    })),
  }

  return <ProductForm mode="edit" product={safe} allGifts={gifts} />
}