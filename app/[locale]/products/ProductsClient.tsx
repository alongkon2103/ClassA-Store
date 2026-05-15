"use client"

import { useState, useEffect } from "react"
import ContainerCard from "@/components/products/ContainerCard"
import ProductModal from "@/components/products/ProductModal"
import ShopHeads from "@/components/products/ShopHead"
import Navbar from "@/components/Navbar"
import { AnimatePresence } from "framer-motion"
import { useLocale } from "next-intl"
import { useSearchParams } from "next/navigation"

export default function ProductsClient({ initialProducts }: any) {
  const [search, setSearch] = useState("")
  const [selected, setSelected] = useState<any>(null)
  const locale = useLocale()
  const searchParams = useSearchParams()

  useEffect(() => {
    const slug = searchParams?.get("slug")
    if (slug) {
      const product = initialProducts.find((p: any) => p.slug === slug)
      if (product) setSelected(product)
    }
  }, [searchParams, initialProducts])

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