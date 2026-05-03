import Navbar from "@/components/Navbar"
import Footer from "@/components/home/Footer"
import Hero from "@/components/home/Hero"
import ProductCard from "@/components/home/ProductCard"
import JoinDc from "@/components/home/JoinDc"
import Driver from "@/components/home/Driver"
import BestSeller from "@/components/home/BestSeller"
import { prisma } from "@/lib/prisma"

const products = await prisma.products.findMany({
  where: { is_active: true, is_featured: true },
  include: {
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