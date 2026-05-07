export const dynamic = "force-dynamic";

import HomeClient from "./HomeClient"
import { prisma } from "@/lib/prisma"
import { setRequestLocale } from "next-intl/server";

export default async function Home({
  params
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const rawProducts = await prisma.products.findMany({
    where: { is_active: true, is_featured: true },
    include: {
      product_images: true,
      product_variants: {
        where: { is_active: true },
        orderBy: { sort_order: "asc" },
        include: {
          _count: {
            select: {
              game_keys: { where: { status: "available" } },
            },
          },
        },
      },
    },
    orderBy: [
      { is_featured: "desc" },
      { created_at: "desc" },
    ],
  })

  const products = rawProducts.map((p) => ({
    ...p,
    price: Number(p.price),
    product_variants: p.product_variants.map((v) => ({
      ...v,
      price: Number(v.price),
      stock: v._count.game_keys,  // ✅ stock per variant
    })),
  }))

  return <HomeClient products={products} />
}
