// app/admin/products/new/page.tsx
import ProductForm from "@/components/admin/products/ProductForm"
import { setRequestLocale } from "next-intl/server"

export default async function NewProductPage({
  params
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  return <ProductForm mode="create" />
}