import { prisma } from "@/lib/prisma"
import ProductsClient from "./ProductsClient"
import { setRequestLocale } from "next-intl/server"

export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)

  const products = await prisma.products.findMany({
    orderBy: { created_at: "desc" },
    include: {
      product_images: {
        orderBy: { sort_order: "asc" },
        take: 1,
      },
      product_variants: {
        where: {
          is_active: true,
        },
        include: {
          _count: {
            select: {
              game_keys: {
                where: {
                  status: "available",
                },
              },
            },
          },
        },
      },
      _count: {
        select: {
          orders: true,
        },
      },
    },
  })

  // ใช้ JSON stringify/parse เพื่อตัด Prisma Decimal ออกทั้งหมด
  const safeProducts = JSON.parse(
    JSON.stringify(
      products.map((p) => ({
        ...p,
        price: Number(p.price),
        commission_pct: Number(p.commission_pct ?? 0),

        product_variants: p.product_variants.map((v) => ({
          id: v.id,
          product_id: v.product_id,
          duration_type: v.duration_type,
          duration_days: v.duration_days,
          label_th: v.label_th,
          label_en: v.label_en,
          price: Number(v.price),
          is_active: v.is_active,
          sort_order: v.sort_order,
          created_at: v.created_at,
          updated_at: v.updated_at,
          variant_type: v.variant_type,
          premium_addon_price: Number(v.premium_addon_price ?? 0),
          stock: v._count.game_keys,
        })),
      }))
    )
  )

  return <ProductsClient products={safeProducts} />
}