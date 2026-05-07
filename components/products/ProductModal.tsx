"use client"

import { useEffect, useState, useCallback } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "@/i18n/routing"
import { motion, AnimatePresence } from "framer-motion"
import { useTranslations, useLocale } from "next-intl"

function LoginModal({ onClose }: { onClose: () => void }) {
  const router = useRouter()
  const t = useTranslations("ProductModal")

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[300] flex items-center justify-center"
      style={{ background: "var(--color-overlay)", backdropFilter: "blur(10px)" }}
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
        className="relative w-[90%] max-w-xs rounded-2xl p-7 flex flex-col items-center gap-4"
        style={{ background: "var(--color-bg-card)", border: "1px solid var(--color-border-soft)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-accent">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>
        <h2 className="text-text-base text-[18px] font-bold">{t("login_required")}</h2>
        <p className="text-[13px] text-text-muted text-center">{t("login_required_desc")}</p>
        <button onClick={() => router.push("/login")}
          className="w-full py-3 rounded-xl font-semibold text-white bg-accent hover:opacity-90 active:scale-95 transition">
          {t("login_button")}
        </button>
        <button onClick={onClose}
          className="w-full py-2.5 rounded-xl text-text-muted bg-white/5 hover:bg-white/10 transition text-sm">
          {t("cancel")}
        </button>
      </motion.div>
    </motion.div>
  )
}

export default function ProductModal({ product, onClose }: any) {
  const { data: session } = useSession()
  const router = useRouter()
  const t = useTranslations("ProductModal")
  const locale = useLocale()
  const [index, setIndex] = useState(0)
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [loading, setLoading] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState<"card" | "promptpay">("promptpay")
  const [whitelistUsername, setWhitelistUsername] = useState("")  // ✅ เพิ่ม
  const [selectedVariant, setSelectedVariant] = useState<any>(
    product.product_variants?.[0] || null
  )

  const basePrice  = Number(selectedVariant?.price ?? product.price)
  const cardFee    = paymentMethod === "card" ? basePrice * 0.06 : 0
  const totalPrice = basePrice + cardFee

  const images = product.product_images?.length > 0
    ? product.product_images
    : [{ url: "/placeholder.png" }]
  const total = images.length

  const prev = useCallback(() => setIndex((p) => Math.max(p - 1, 0)), [])
  const next = useCallback(() => setIndex((p) => Math.min(p + 1, total - 1)), [total])

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { if (showLoginModal) setShowLoginModal(false); else onClose() }
      if (e.key === "ArrowLeft") prev()
      if (e.key === "ArrowRight") next()
    }
    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  }, [onClose, prev, next, showLoginModal])

  useEffect(() => {
    document.body.style.overflow = "hidden"
    return () => { document.body.style.overflow = "" }
  }, [])

  let touchStartX = 0
  const onTouchStart = (e: React.TouchEvent) => { touchStartX = e.touches[0].clientX }
  const onTouchEnd = (e: React.TouchEvent) => {
    const dx = e.changedTouches[0].clientX - touchStartX
    if (dx > 50) prev()
    if (dx < -50) next()
  }

  const totalStock = product.product_variants?.reduce(
    (sum: number, v: any) => sum + (v.stock ?? 0), 0
  ) ?? 0
  const selectedStock = selectedVariant?.stock ?? 0
  const isOutOfStock  = selectedStock === 0
  const isLowStock    = selectedStock > 0 && selectedStock <= 5

  const handleBuyClick = async () => {
    if (!session) { setShowLoginModal(true); return }
    if (!selectedVariant && product.product_variants?.length > 0) {
      alert("Please select an option"); return
    }
    // ✅ validate username
    if (!whitelistUsername.trim()) {
      alert("Please enter your in-game username"); return
    }

    setLoading(true)
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId:         product.id,
          variantId:         selectedVariant?.id,
          paymentMethod,
          locale,
          whitelistUsername: whitelistUsername.trim(),  // ✅ ส่งไปด้วย
        }),
      })
      const data = await res.json()
      if (!res.ok) { alert(data.error); setLoading(false); return }
      if (data.url) window.location.href = data.url
    } catch (err) {
      console.error(err)
      alert("An error occurred")
      setLoading(false)
    }
  }

  const productName = locale === "th" ? product.name_th : product.name_en
  const productDesc = locale === "th" ? (product.description_th || product.description_en) : product.description_en

  return (
    <div className="relative">
      <AnimatePresence>
        {showLoginModal && <LoginModal onClose={() => setShowLoginModal(false)} />}
      </AnimatePresence>

      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
        className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center sm:p-5"
        style={{ background: "var(--color-overlay)", backdropFilter: "blur(8px)" }}
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 30 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="w-full bg-bg-card border border-accent/20 rounded-t-2xl sm:rounded-2xl max-h-[92vh] sm:max-w-2xl overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* IMAGE SLIDER */}
          <div className="relative aspect-video bg-bg-base overflow-hidden"
            onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
            <div className="flex h-full transition-transform duration-300"
              style={{ transform: `translateX(-${index * 100}%)` }}>
              {images.map((img: any, i: number) => (
                <img key={i} src={img.url} alt="" className="min-w-full h-full object-cover" />
              ))}
            </div>

            <button onClick={onClose}
              className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center text-white transition">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>

            {total > 1 && (
              <>
                <button onClick={prev} disabled={index === 0}
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center text-white disabled:opacity-30 transition">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <polyline points="15 18 9 12 15 6" />
                  </svg>
                </button>
                <button onClick={next} disabled={index === total - 1}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center text-white disabled:opacity-30 transition">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </button>
              </>
            )}
          </div>

          {/* THUMBNAIL STRIP */}
          {total > 1 && (
            <div className="flex gap-2 px-4 py-3 bg-bg-base border-b border-white/5 overflow-x-auto scrollbar-none">
              {images.map((img: any, i: number) => (
                <button key={i} onClick={() => setIndex(i)}
                  className={`relative flex-shrink-0 w-14 h-14 rounded-lg overflow-hidden transition-all ${
                    i === index ? "ring-2 ring-accent opacity-100" : "opacity-40 hover:opacity-70"
                  }`}>
                  <img src={img.url} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}

          {/* CONTENT */}
          <div className="p-5 space-y-4">
            {/* Title + stock */}
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-[20px] font-bold leading-tight">{productName}</h2>
              <span className={`text-[11px] px-2 py-1 rounded-full font-medium whitespace-nowrap ${
                totalStock === 0 ? "bg-red-500/15 text-red-400"
                : totalStock <= 5 ? "bg-orange-500/15 text-orange-400"
                : "bg-green-500/15 text-green-400"
              }`}>
                {totalStock === 0 ? t("out_of_stock") : `${totalStock} ${t("left")}`}
              </span>
            </div>

            <p className="text-sm text-text-muted leading-relaxed">
              {productDesc || t("no_description")}
            </p>

            {/* VARIANTS */}
            {product.product_variants?.length > 0 && (
              <div className="space-y-2">
                <p className="text-[11px] tracking-widest text-text-muted uppercase">{t("select_option")}</p>
                <div className="grid grid-cols-2 gap-2">
                  {product.product_variants.map((v: any) => {
                    const active      = selectedVariant?.id === v.id
                    const outOfStock  = (v.stock ?? 0) === 0
                    const variantLabel = locale === "th" ? v.label_th : v.label_en
                    return (
                      <button key={v.id} onClick={() => !outOfStock && setSelectedVariant(v)}
                        disabled={outOfStock}
                        className={`p-3 rounded-xl border text-left transition ${
                          outOfStock ? "opacity-40 cursor-not-allowed border-white/5"
                          : active   ? "border-accent bg-accent/10"
                          : "border-white/10 hover:border-accent/40"
                        }`}>
                        <div className="flex justify-between items-start">
                          {/* <div>
                            <p className="text-[13px] font-medium">{variantLabel}</p>
                            <p className={`text-[10px] mt-0.5 ${
                              outOfStock ? "text-red-400"
                              : (v.stock ?? 0) <= 5 ? "text-orange-400"
                              : "text-green-400"
                            }`}>
                              {outOfStock ? t("sold_out") : `${v.stock} ${t("available")}`}
                            </p>
                          </div> */}
                          <span className="text-[13px] font-bold text-accent-light">
                            ฿{Number(v.price).toLocaleString()}
                          </span>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* ✅ IN-GAME USERNAME */}
            <div className="space-y-2">
              <p className="text-[11px] tracking-widest text-text-muted uppercase">In-Game Username</p>
              <input
                value={whitelistUsername}
                onChange={(e) => setWhitelistUsername(e.target.value)}
                placeholder="Enter your in-game username"
                className="w-full bg-bg-base border border-accent/15 rounded-xl px-4 py-3 text-[13px] placeholder:text-text-muted outline-none focus:border-accent/40 transition"
              />
              <p className="text-[11px] text-text-muted">
                Double-check your username — it cannot be changed after purchase.
              </p>
            </div>

            {/* PAYMENT METHOD */}
            <div className="space-y-2">
              <p className="text-[11px] tracking-widest text-text-muted uppercase">Payment Method</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setPaymentMethod("promptpay")}
                  className={`p-3 rounded-xl border text-left transition ${
                    paymentMethod === "promptpay" ? "border-accent bg-accent/10" : "border-white/10 hover:border-accent/40"
                  }`}>
                  <p className="text-[13px] font-medium">PromptPay</p>
                  <p className="text-[10px] text-green-400">0% Fee</p>
                </button>
                <button
                  onClick={() => setPaymentMethod("card")}
                  className={`p-3 rounded-xl border text-left transition ${
                    paymentMethod === "card" ? "border-accent bg-accent/10" : "border-white/10 hover:border-accent/40"
                  }`}>
                  <p className="text-[13px] font-medium">Credit / Debit Card</p>
                  <p className="text-[10px] text-orange-400">+6% Fee</p>
                </button>
              </div>
            </div>

            {/* PRICE + BUY */}
            <div className="flex items-center gap-3 pt-4 border-t border-white/10">
              <div className="flex-1">
                <p className="text-[11px] text-text-muted mb-0.5">Total Amount</p>
                <div className="text-[26px] font-bold text-accent-light leading-none">
                  ฿{totalPrice.toLocaleString()}
                </div>
                {paymentMethod === "card" && (
                  <p className="text-[10px] text-text-muted mt-1">Includes 6% service fee</p>
                )}
                {/* {isLowStock && (
                  <p className="text-[11px] text-orange-400 mt-1">
                    {t("only_left_warning", { count: selectedStock })}
                  </p>
                )} */}
              </div>

              <button
                disabled={isOutOfStock || loading}
                onClick={handleBuyClick}
                className={`flex-1 py-3.5 rounded-xl font-semibold text-[15px] transition flex items-center justify-center gap-2 ${
                  isOutOfStock || loading
                    ? "bg-white/5 text-text-muted cursor-not-allowed"
                    : "bg-accent text-white hover:opacity-90 active:scale-95"
                }`}>
                {loading ? (
                  <>
                    <div className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />
                    <span>Processing...</span>
                  </>
                ) : isOutOfStock ? t("out_of_stock") : "Checkout"}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </div>
  )
}