"use client"

import HalloweenPage from "@/components/HalloweenPage"

import { useState } from "react"
import Navbar from "@/components/Navbar"
import Footer from "@/components/home/Footer"
import Hero from "@/components/home/Hero"
import HalloweenDrawPreview from "@/components/seasonal/HalloweenDrawPreview"
import JoinDc from "@/components/home/JoinDc"
import TrustBar from "@/components/home/TrustBar"
import PromoMarquee from "@/components/home/PromoMarquee"
import BestSeller, { type Product } from "@/components/home/BestSeller"
import ProductModal from "@/components/products/ProductModal"
import { AnimatePresence } from "framer-motion"

export default function HomeClient({ products, usdRate }: { products: Product[]; usdRate?: number | null }) {
  const [selected, setSelected] = useState<Product | null>(null)

  return (
    <HalloweenPage home className="relative min-h-screen flex flex-col">
      <Navbar halloween />

      <main className="flex-1 layer-base">
        <Hero products={products} onSelect={(p) => setSelected(p)} />
        <HalloweenDrawPreview embedded live />
        <TrustBar />
        <PromoMarquee />
        <div className="layer-content">
          <BestSeller products={products} onSelect={(p) => setSelected(p)} usdRate={usdRate} />
        </div>
        <JoinDc />
      </main>
      
      <Footer halloween />

      {/* MODAL LAYER */}
      <AnimatePresence>
        {selected && (
          <ProductModal
            product={selected}
            onClose={() => setSelected(null)}
          />
        )}
      </AnimatePresence>
    </HalloweenPage>
  )
}
