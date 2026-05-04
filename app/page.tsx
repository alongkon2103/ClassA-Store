export const dynamic = "force-dynamic";

import Navbar from "@/components/Navbar"
import Footer from "@/components/home/Footer"
import Hero from "@/components/home/Hero"
import ProductCard from "@/components/home/ProductCard"
import JoinDc from "@/components/home/JoinDc"
import Driver from "@/components/home/Driver"
import BestSeller from "@/components/home/BestSeller"
import { prisma } from "@/lib/prisma"
import { transformProduct } from "@/lib/transformProduct"

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
  orderBy: { created_at: "desc" },
})

const products = rawProducts.map((p) => ({
  ...p,
  price: Number(p.price),
  product_variants: p.product_variants.map((v) => ({
    ...v,
    price: Number(v.price),
    stock: v._count.game_keys,  // ✅ stock ต่อ variant
  })),
}))

console.log(products)
export default function Home() {
  return (
    <div>
      <Navbar />

      <Hero />
      <Driver />
      <BestSeller products={products} />
      <Driver />

      <JoinDc />
      <Footer />
    </div>
  )
}