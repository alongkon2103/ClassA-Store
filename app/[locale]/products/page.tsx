import ProductsClient from "./ProductsClient"
import { prisma } from "@/lib/prisma"
import { setRequestLocale } from "next-intl/server";

export const dynamic = "force-dynamic"

export default async function Page({
    params
}: {
    params: Promise<{ locale: string }>;
}) {
    const { locale } = await params;
    setRequestLocale(locale);

    const products = await prisma.products.findMany({
        where: { is_active: true },
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
            { is_featured: "desc" }, // This comes first
            { created_at: "desc" },  // Then sort by time
        ],
    })

    const safeProducts = products.map((p) => ({
        ...p,
        price: Number(p.price),
        commission_pct: Number(p.commission_pct ?? 0),

        product_variants: p.product_variants.map((v) => ({
            ...v,
            price: Number(v.price),
            premium_addon_price: Number(v.premium_addon_price ?? 0),
            discount_pct: Number(v.discount_pct ?? 0),
            stock: v._count.game_keys, // stock per variant
        })),
    }))

    return <ProductsClient initialProducts={safeProducts} />
}