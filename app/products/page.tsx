import ProductsClient from "./ProductsClient"
import { prisma } from "@/lib/prisma"
export const dynamic = "force-dynamic"
export default async function Page() {
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
            { is_featured: "desc" }, // อันนี้มาก่อน
            { created_at: "desc" },  // แล้วค่อยเรียงใหม่ตามเวลา
        ],
    })

    const safeProducts = products.map((p) => ({
        ...p,
        price: Number(p.price),
        product_variants: p.product_variants.map((v) => ({
            ...v,
            price: Number(v.price),
            stock: v._count.game_keys, // ✅ stock ต่อ variant
        })),
    }))

    return <ProductsClient initialProducts={safeProducts} />
}