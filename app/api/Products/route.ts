import { prisma } from "@/lib/prisma"

// Public catalog endpoint — cached at the edge/CDN for 60s, browser keeps it
// fresh for 30s, and serves stale-while-revalidate for another minute. Lets
// us absorb traffic spikes without slamming the DB.
const CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=60, max-age=30, stale-while-revalidate=60",
}

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

  return Response.json(safeProducts, { headers: CACHE_HEADERS })
}
