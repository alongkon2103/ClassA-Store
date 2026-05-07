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
    },
  })
  if (!product) notFound()

  const safe = {
    ...product,
    price: Number(product.price),
    commission_pct: Number(product.commission_pct ?? 0),
    product_variants: product.product_variants.map((v) => ({ ...v, price: Number(v.price) })),
  }

  return <ProductForm mode="edit" product={safe} />
}