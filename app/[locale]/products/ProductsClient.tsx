"use client"

import { useState, useEffect } from "react"
import ContainerCard from "@/components/products/ContainerCard"
import ProductModal from "@/components/products/ProductModal"
import PartnerModal from "@/components/products/PartnerModal"
import ShopHeads from "@/components/products/ShopHead"
import Navbar from "@/components/Navbar"
import { AnimatePresence } from "framer-motion"
import { useLocale } from "next-intl"
import { useSearchParams } from "next/navigation"

type Product = {
  slug: string
  name_th: string
  name_en: string
  is_partner?: boolean
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  partner?: any
}

export default function ProductsClient({ initialProducts }: { initialProducts: Product[] }) {
  const [search, setSearch] = useState("")
  const [selected, setSelected] = useState<Product | null>(null)
  const locale = useLocale()
  const searchParams = useSearchParams()

  useEffect(() => {
    const slug = searchParams?.get("slug")
    if (slug) {
      const product = initialProducts.find((p: Product) => p.slug === slug)
      if (product) setSelected(product)
    }
  }, [searchParams, initialProducts])

  const filtered = initialProducts.filter((p: Product) => {
    const name = locale === "th" ? p.name_th : p.name_en
    return name?.toLowerCase().includes(search.toLowerCase())
  })

  return (
    <>
      <Navbar />
      <ShopHeads search={search} setSearch={setSearch} />

      <ContainerCard
        products={filtered}
        onSelect={(product: Product) => setSelected(product)}
      />

      {/* POPUP — partner games use their own (external buy) modal */}
      <AnimatePresence>
        {selected && (
          selected.is_partner ? (
            <PartnerModal
              product={selected}
              onClose={() => setSelected(null)}
            />
          ) : (
            <ProductModal
              product={selected}
              onClose={() => setSelected(null)}
            />
          )
        )}
      </AnimatePresence>
    </>
  )
}