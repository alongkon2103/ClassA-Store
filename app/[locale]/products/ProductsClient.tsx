"use client"

import { useState } from "react"
import ContainerCard from "@/components/products/ContainerCard"
import ProductModal from "@/components/products/ProductModal"
import ShopHeads from "@/components/products/ShopHead"
import Navbar from "@/components/Navbar"
import { AnimatePresence } from "framer-motion"
import { useLocale } from "next-intl"

export default function ProductsClient({ initialProducts }: any) {
  const [search, setSearch] = useState("")
  const [selected, setSelected] = useState<any>(null)
  const locale = useLocale()

  const filtered = initialProducts.filter((p: any) => {
    const name = locale === "th" ? p.name_th : p.name_en
    return name?.toLowerCase().includes(search.toLowerCase())
  })

  return (
    <>
      <Navbar />
      <ShopHeads search={search} setSearch={setSearch} />

      <ContainerCard
        products={filtered}
        onSelect={(product: any) => setSelected(product)}
      />

      {/* POPUP */}
      <AnimatePresence>
        {selected && (
          <ProductModal
            product={selected}
            onClose={() => setSelected(null)}
          />
        )}
      </AnimatePresence>
    </>
  )
}