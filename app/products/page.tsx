import ProductsClient from "./ProductsClient"
import { prisma } from "@/lib/prisma"
import { transformProduct } from "@/lib/transformProduct"
export default async function Page() {
    const products = await prisma.products.findMany({
        where: { is_active: true },
        include: {
            product_images: true,
            _count: {
                select: {
                    game_keys: {
                        where: { status: "available" },
                    },
                },
            },
        },
        orderBy: { created_at: "desc" },
    })

    const safeProducts = products.map(transformProduct)

    return <ProductsClient initialProducts={safeProducts} />
}