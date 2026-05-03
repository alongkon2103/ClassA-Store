import ProductsClient from "./ProductsClient"
import { prisma } from "@/lib/prisma"
import { transformProduct } from "@/lib/transformProduct"
export default async function Page() {
    const products = await prisma.products.findMany({
        where: { is_active: true, is_featured: true },
        include: {
            product_variants: true,
            product_images: true,
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
        orderBy: { created_at: "desc" },
    })

    const safeProducts = products.map((p) => ({
        ...p,
        price: Number(p.price), 

        product_variants: p.product_variants.map((v) => ({
            ...v,
            price: Number(v.price), 
        })),
    }))
    return <ProductsClient initialProducts={safeProducts} />
}