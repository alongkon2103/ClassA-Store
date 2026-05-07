"use client"

import { useState } from "react"
import Navbar from "@/components/Navbar"
import Footer from "@/components/home/Footer"
import Hero from "@/components/home/Hero"
import JoinDc from "@/components/home/JoinDc"
import Driver from "@/components/home/Driver"
import BestSeller from "@/components/home/BestSeller"
import ProductModal from "@/components/products/ProductModal"
import { AnimatePresence } from "framer-motion"

export default function HomeClient({ products }: { products: any[] }) {
  const [selected, setSelected] = useState<any>(null)

  return (
    <div className="relative min-h-screen flex flex-col">
      <Navbar />

      <main className="flex-1 layer-base">
        <Hero />
        <Driver />
        <div className="layer-content">
          <BestSeller products={products} onSelect={(p) => setSelected(p)} />
        </div>
        <Driver />
        <JoinDc />
      </main>
      
      <Footer />

      {/* MODAL LAYER */}
      <AnimatePresence>
        {selected && (
          <ProductModal
            product={selected}
            onClose={() => setSelected(null)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
