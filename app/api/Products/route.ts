import { prisma } from "@/lib/prisma"

export async function GET() {
  const products = await prisma.products.findMany({
    where: {
      is_active: true,
    },
    include: {
      product_images: true,
    },
    orderBy: {
      created_at: "desc",
    },
  })

  const safeProducts = products.map(p => ({
    ...p,
    price: Number(p.price)
  }))

  return Response.json(safeProducts)
}
