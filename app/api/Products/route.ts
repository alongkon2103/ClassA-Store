import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

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

  return Response.json(products)
}