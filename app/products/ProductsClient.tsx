"use client"

import { useState } from "react"
import ContainerCard from "@/components/products/ContainerCard"
import ProductModal from "@/components/products/ProductModal"
import ShopHeads from "@/components/products/ShopHead"
import Navbar from "@/components/Navbar"
export default function ProductsClient({ initialProducts }: any) {
  const [search, setSearch] = useState("")
  const [selected, setSelected] = useState<any>(null)

  const filtered = initialProducts.filter((p: any) =>
    p.name_en.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <>
        <Navbar/>
      <ShopHeads search={search} setSearch={setSearch} />

      <ContainerCard
        products={filtered}
        onSelect={(product: any) => setSelected(product)}
      />

      {/* POPUP */}
      {selected && (
        <ProductModal
          product={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  )
}