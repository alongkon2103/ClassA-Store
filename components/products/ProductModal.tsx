"use client"

import { useEffect, useState, useCallback } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"

// ── Login Modal ──
function LoginModal({ onClose }: { onClose: () => void }) {
  const router = useRouter()

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-[300] flex items-center justify-center"
      style={{ background: "rgba(4,10,18,.7)", backdropFilter: "blur(8px)" }}
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="relative w-[90%] max-w-xs rounded-2xl p-7 flex flex-col items-center gap-5"
        style={{ background: "#0b1929", border: "1px solid rgba(66,122,181,.2)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-white text-[18px] font-bold">Login Required</h2>

        <p className="text-[13px] text-[#7a9bb8] text-center">
          You need to be logged in to purchase items.
        </p>

        <button
          onClick={() => router.push("/login")}
          className="w-full py-3 rounded-xl font-semibold text-white bg-accent hover:opacity-90 active:scale-95"
        >
          Login
        </button>

        <button
          onClick={onClose}
          className="w-full py-3 rounded-xl text-[#7a9bb8] bg-white/5 hover:opacity-80"
        >
          Cancel
        </button>
      </motion.div>
    </motion.div>
  )
}

// ── Main ──
export default function ProductModal({ product, onClose }: any) {
  const { data: session } = useSession()

  const [index, setIndex] = useState(0)
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [selectedVariant, setSelectedVariant] = useState<any>(
    product.product_variants?.[0] || null
  )

  const images =
    product.product_images?.length > 0
      ? product.product_images
      : [{ url: "/placeholder.png" }]

  const total = images.length

  const prev = useCallback(() => setIndex((p) => Math.max(p - 1, 0)), [])
  const next = useCallback(() => setIndex((p) => Math.min(p + 1, total - 1)), [total])

  // keyboard
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (showLoginModal) setShowLoginModal(false)
        else onClose()
      }
      if (e.key === "ArrowLeft") prev()
      if (e.key === "ArrowRight") next()
    }
    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  }, [onClose, prev, next, showLoginModal])

  // lock scroll
  useEffect(() => {
    document.body.style.overflow = "hidden"
    return () => { document.body.style.overflow = "" }
  }, [])

  // swipe
  let touchStartX = 0
  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX = e.touches[0].clientX
  }
  const onTouchEnd = (e: React.TouchEvent) => {
    const dx = e.changedTouches[0].clientX - touchStartX
    if (dx > 50) prev()
    if (dx < -50) next()
  }

  // stock
  const stockCount = product._count?.game_keys ?? 0
  const isLowStock = stockCount > 0 && stockCount <= 5
  const isOutOfStock = stockCount === 0

  // buy
  const handleBuyClick = () => {
    if (!session) {
      setShowLoginModal(true)
      return
    }

    if (!selectedVariant && product.product_variants?.length > 0) {
      alert("Please select an option")
      return
    }

    console.log("BUY:", {
      productId: product.id,
      variantId: selectedVariant?.id,
    })
  }

  return (
    <div className="relative">
      <AnimatePresence>
        {showLoginModal && <LoginModal onClose={() => setShowLoginModal(false)} />}
      </AnimatePresence>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center sm:p-5"
        style={{ background: "rgba(4,10,18,.85)", backdropFilter: "blur(6px)" }}
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="w-full bg-bg-card border border-accent/20 rounded-t-2xl sm:rounded-2xl max-h-[92vh] sm:max-w-2xl overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* IMAGE */}
          <div
            className="relative aspect-video bg-bg-base"
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
          >
            <div
              className="flex h-full transition-transform"
              style={{ transform: `translateX(-${index * 100}%)` }}
            >
              {images.map((img: any, i: number) => (
                <img key={i} src={img.url} className="w-full object-cover" />
              ))}
            </div>
          </div>

          {/* CONTENT */}
          <div className="p-4 space-y-4">
            <h2 className="text-[22px] font-bold">{product.name_en}</h2>

            <p className="text-sm text-muted">
              {product.description_en || "No description"}
            </p>

            {/* VARIANTS */}
            {product.product_variants?.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-muted">Select Option</p>

                <div className="grid grid-cols-2 gap-2">
                  {product.product_variants.map((v: any) => {
                    const active = selectedVariant?.id === v.id

                    return (
                      <button
                        key={v.id}
                        onClick={() => setSelectedVariant(v)}
                        className={`p-3 rounded-xl border text-left transition ${active
                          ? "border-accent bg-accent/10"
                          : "border-white/10 hover:border-accent/40"
                          }`}
                      >
                        <div className="flex justify-between">
                          <span>{v.label_en}</span>
                          <span className="font-semibold text-accent-light">
                            ฿{Number(v.price).toLocaleString()}
                          </span>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* PRICE + BUY */}
            <div className="flex items-center gap-3 pt-3 border-t border-white/10">
              <div className="flex-1">
                <div className="text-2xl font-bold text-accent-light">
                  ฿{Number(selectedVariant?.price ?? product.price).toLocaleString()}
                </div>

                {isLowStock && (
                  <p className="text-xs text-orange-400">
                    Only {stockCount} left!
                  </p>
                )}
              </div>

              <button
                disabled={isOutOfStock}
                onClick={handleBuyClick}
                className={`flex-1 py-3 rounded-xl font-medium ${isOutOfStock
                  ? "bg-white/5 text-muted"
                  : "bg-accent text-white active:scale-95"
                  }`}
              >
                {isOutOfStock ? "Out of Stock" : "Buy Now"}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </div>
  )
}