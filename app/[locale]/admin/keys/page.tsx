import { prisma } from "@/lib/prisma"
import KeysClient from "./KeysClient"
import { setRequestLocale } from "next-intl/server"

export default async function AdminKeysPage({
    params
}: {
    params: Promise<{ locale: string }>
}) {
    const { locale } = await params
    setRequestLocale(locale)
    // app/admin/keys/page.tsx
    const [keys, products] = await Promise.all([
        prisma.game_keys.findMany({
            orderBy: { created_at: "desc" },
            include: {
                products: { select: { name_en: true, slug: true } },
                product_variants: { select: { label_en: true, price: true } },
                orders: { select: { id: true, users: { select: { username: true } } } },
            },
        }),
        prisma.products.findMany({
            where: { is_active: true },
            include: {
                product_variants: {
                    where: { is_active: true },
                    select: { id: true, label_en: true, price: true },
                    orderBy: { sort_order: "asc" },
                },
            },
            orderBy: { created_at: "desc" },
        }),
    ])
    const safe = keys.map((k) => ({
        ...k,
        product_variants: k.product_variants
            ? { ...k.product_variants, price: Number(k.product_variants.price) }
            : null,
    }))

    // ✅ Also convert products
    const safeProducts = products.map((p) => ({
        ...p,
        price: Number(p.price),
        commission_pct: Number(p.commission_pct ?? 0),
        product_variants: p.product_variants.map((v) => ({
            ...v,
            price: Number(v.price),
        })),
    }))

    return <KeysClient keys={safe} products={safeProducts} />

}