"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "@/i18n/routing"
import { motion, AnimatePresence } from "framer-motion"
import { useTranslations, useLocale } from "next-intl"
import { getImageUrl } from "@/lib/getImageUrl"

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

function UsernameHelpModal({
  onClose,
  images,
}: {
  onClose: () => void
  images: string[]
}) {
  const [idx, setIdx] = useState(0)

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[300] flex items-center justify-center p-4"
      style={{
        background: "var(--color-overlay)",
        backdropFilter: "blur(12px)",
      }}
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl"
        style={{
          background: "var(--color-bg-card)",
          border: "1px solid var(--color-border-soft)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <div>
            <p className="text-[16px] font-semibold text-text-base">
              How to find your username
            </p>
            <p className="text-[12px] text-text-muted mt-0.5">
              Follow the screenshots below
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/5 hover:bg-white/10 transition flex items-center justify-center text-text-muted hover:text-text-base"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Slider */}
        <div className="relative aspect-[16/10] md:aspect-video bg-bg-base overflow-hidden">
          <div
            className="flex h-full transition-transform duration-300 ease-out"
            style={{ transform: `translateX(-${idx * 100}%)` }}
          >
            {images.map((src, i) => (
              <div key={i} className="min-w-full h-full flex items-center justify-center bg-black/20">
                <img src={src} alt={`step-${i + 1}`} className="w-full h-full object-contain" />
              </div>
            ))}
          </div>

          {images.length > 1 && (
            <>
              <button
                onClick={() => setIdx((p) => Math.max(p - 1, 0))}
                disabled={idx === 0}
                className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/60 hover:bg-black/80 transition flex items-center justify-center text-white disabled:opacity-30"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </button>
              <button
                onClick={() => setIdx((p) => Math.min(p + 1, images.length - 1))}
                disabled={idx === images.length - 1}
                className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/60 hover:bg-black/80 transition flex items-center justify-center text-white disabled:opacity-30"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4">
          <p className="text-[13px] text-text-muted text-center">
            Step{" "}
            <span className="text-text-base font-semibold">{idx + 1}</span>
            {" "}of{" "}
            <span className="text-text-base font-semibold">{images.length}</span>
            {" "}— Go to your profile and copy the username shown
          </p>
          {images.length > 1 && (
            <div className="flex justify-center gap-2 mt-4">
              {images.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setIdx(i)}
                  className={`h-2 rounded-full transition-all duration-300 ${i === idx ? "bg-accent w-6" : "bg-white/20 w-2 hover:bg-white/40"}`}
                />
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}

export default function ProductModal({ product, onClose }: any) {
  const { data: session } = useSession()
  const router = useRouter()
  const t = useTranslations("ProductModal")
  const locale = useLocale()
  const isTH = locale === "th"

  const [index, setIndex] = useState(0)
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [showUsernameHelp, setShowUsernameHelp] = useState(false)
  const hasShownUsernameHelp = useRef(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState<"card" | "promptpay">("promptpay")
  const [whitelistUsername, setWhitelistUsername] = useState("")
  const [usdRate, setUsdRate] = useState<number | null>(null)

  useEffect(() => {
    fetch("https://open.er-api.com/v6/latest/THB")
      .then(r => r.json())
      .then(data => { if (data?.rates?.USD) setUsdRate(data.rates.USD) })
      .catch(() => { })
  }, [])

  const sortedVariants = [...(product.product_variants ?? [])]
    .filter((v: any) => v.is_active === true)
    .sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0))

  const variants = sortedVariants
  const hasVariants = variants.length > 0

  const [selectedVariant, setSelectedVariant] = useState<any>(sortedVariants[0] || null)

  const variantPrice = Number(selectedVariant?.price ?? 0)
  const cardFee = paymentMethod === "card" ? variantPrice * 0.06 : 0
  const totalPrice = variantPrice + cardFee
  const totalPriceUSD = usdRate ? (totalPrice * usdRate).toFixed(2) : null

  // helper: แปลง variant price เป็น USD
  const toUSD = (thbPrice: number) =>
    usdRate ? (Number(thbPrice) * usdRate).toFixed(2) : null

  const images = product.product_images?.length > 0
    ? product.product_images
    : [{ url: "/placeholder.png" }]
  const total = images.length

  const usernameHelpImages = ["/uploads/userHelp.png"]

  const prev = useCallback(() => setIndex((p) => Math.max(p - 1, 0)), [])
  const next = useCallback(() => setIndex((p) => Math.min(p + 1, total - 1)), [total])

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (showLoginModal || showUsernameHelp) {
          setShowLoginModal(false)
          setShowUsernameHelp(false)
        } else onClose()
      }
      if (e.key === "ArrowLeft") prev()
      if (e.key === "ArrowRight") next()
    }
    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  }, [onClose, prev, next, showLoginModal, showUsernameHelp])

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

  const handleBuyClick = async () => {
    if (!session) { setShowLoginModal(true); return }
    if (!hasVariants || !selectedVariant) return
    if (!whitelistUsername.trim()) { alert("Please enter your in-game username"); return }

    setLoading(true)
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: product.id,
          variantId: selectedVariant.id,
          paymentMethod,
          locale,
          whitelistUsername: whitelistUsername.trim(),
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

  const productDesc = isTH
    ? (product.description_th || product.description_en)
    : product.description_en

  return (
    <div className="relative">
      <AnimatePresence>
        {showLoginModal && <LoginModal onClose={() => setShowLoginModal(false)} />}
        {showUsernameHelp && (
          <UsernameHelpModal
            onClose={() => {
              setShowUsernameHelp(false)
              // blur input เพื่อกัน onFocus trigger ซ้ำบน mobile
              inputRef.current?.blur()
            }}
            images={usernameHelpImages}
          />
        )}
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
          <div
            className="relative aspect-video bg-bg-base overflow-hidden"
            onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}
          >
            <div
              className="flex h-full transition-transform duration-300"
              style={{ transform: `translateX(-${index * 100}%)` }}
            >
              {images.map((img: any, i: number) => (
                <img key={i} src={getImageUrl(img.url)} alt="" className="min-w-full h-full object-cover" />
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
                  className={`relative flex-shrink-0 w-14 h-14 rounded-lg overflow-hidden transition-all ${i === index ? "ring-2 ring-accent opacity-100" : "opacity-40 hover:opacity-70"}`}>
                  <img src={getImageUrl(img.url)} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}

          {/* CONTENT */}
          <div className="p-5 space-y-4">
            <p className="text-sm text-text-muted leading-relaxed">
              {productDesc || t("no_description")}
            </p>

            {/* VARIANTS */}
            {hasVariants ? (
              <div className="space-y-2">
                <p className="text-[11px] tracking-widest text-text-muted uppercase">
                  {t("select_option")}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {sortedVariants.map((v: any) => {
                    const active = selectedVariant?.id === v.id
                    const variantLabel = isTH ? v.label_th : v.label_en
                    const thbPrice = Number(v.price)
                    const usdPrice = toUSD(thbPrice)

                    return (
                      <button key={v.id} onClick={() => setSelectedVariant(v)}
                        className={`p-3 rounded-xl border text-left transition ${active ? "border-accent bg-accent/10" : "border-white/10 hover:border-accent/40"}`}>
                        <div className="flex justify-between items-start gap-1">
                          <p className="text-[13px] font-medium">{variantLabel}</p>
                          {/* ราคาใน variant card */}
                          <div className="text-right">
                            {isTH ? (
                              <>
                                <p className="text-[13px] font-bold text-accent-light">
                                  ฿{thbPrice.toLocaleString()}
                                </p>
                                {usdPrice && (
                                  <p className="text-[10px] text-text-muted">≈ ${usdPrice}</p>
                                )}
                              </>
                            ) : (
                              <>
                                {usdPrice ? (
                                  <p className="text-[13px] font-bold text-accent-light">${usdPrice}</p>
                                ) : (
                                  <p className="text-[13px] font-bold text-accent-light">฿{thbPrice.toLocaleString()}</p>
                                )}
                                <p className="text-[10px] text-text-muted">฿{thbPrice.toLocaleString()}</p>
                              </>
                            )}
                          </div>
                        </div>
                        {active && <p className="text-[10px] text-accent-light mt-1">Selected</p>}
                      </button>
                    )
                  })}
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-xl border border-red-500/20 bg-red-500/5 text-center">
                <p className="text-[13px] text-red-400 font-medium">Out of Stock</p>
                <p className="text-[11px] text-text-muted mt-1">This product is currently unavailable</p>
              </div>
            )}

            {/* IN-GAME USERNAME */}
            {hasVariants && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] tracking-widest text-text-muted uppercase">
                    {t("ingame_username")}
                  </p>
                  <button
                    onClick={() => setShowUsernameHelp(true)}
                    className="flex items-center gap-1 text-[11px] text-accent-light hover:opacity-80 transition"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <circle cx="12" cy="12" r="10" />
                      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                      <line x1="12" y1="17" x2="12.01" y2="17" />
                    </svg>
                    {t("how_to_find")}
                  </button>
                </div>
                {/* click ที่ input เปิด modal ครั้งแรกอัตโนมัติ */}
                <input
                  ref={inputRef}
                  value={whitelistUsername}
                  onChange={(e) => setWhitelistUsername(e.target.value)}
                  onFocus={() => {
                    if (!hasShownUsernameHelp.current) {
                      hasShownUsernameHelp.current = true
                      setShowUsernameHelp(true)
                    }
                  }}
                  placeholder={t("ingame_username_placeholder")}
                  className="w-full bg-bg-base border border-accent/15 rounded-xl px-4 py-3 text-[13px] placeholder:text-text-muted outline-none focus:border-accent/40 transition"
                />
                <p className="text-[11px] text-text-muted">{t("ingame_username_hint")}</p>
              </div>
            )}

            {/* PAYMENT METHOD */}
            {hasVariants && (
              <div className="space-y-2">
                <p className="text-[11px] tracking-widest text-text-muted uppercase">{t("payment_method")}</p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setPaymentMethod("promptpay")}
                    className={`p-3 rounded-xl border text-left transition ${paymentMethod === "promptpay" ? "border-accent bg-accent/10" : "border-white/10 hover:border-accent/40"}`}>
                    <p className="text-[13px] font-medium">{t("promptpay_label")}</p>
                    <p className="text-[10px] text-green-400">{t("promptpay_desc")}</p>
                  </button>
                  <button
                    onClick={() => setPaymentMethod("card")}
                    className={`p-3 rounded-xl border text-left transition ${paymentMethod === "card" ? "border-accent bg-accent/10" : "border-white/10 hover:border-accent/40"}`}>
                    <p className="text-[13px] font-medium">{t("stripe_label")}</p>
                    <p className="text-[10px] text-orange-400">{t("stripe_desc")}</p>
                  </button>
                </div>
              </div>
            )}

            {/* PRICE + BUY */}
            <div className="flex items-center gap-3 pt-4 border-t border-white/10">
              <div className="flex-1">
                {hasVariants && selectedVariant ? (
                  <>
                    <p className="text-[11px] text-text-muted mb-0.5">{t("total")}</p>
                    {isTH ? (
                      <>
                        {/* TH: บาทหลัก */}
                        <div className="text-[26px] font-bold text-accent-light leading-none">
                          ฿{totalPrice.toLocaleString()}
                        </div>
                        {totalPriceUSD && (
                          <p className="text-[11px] text-text-muted mt-0.5">≈ ${totalPriceUSD} USD</p>
                        )}
                      </>
                    ) : (
                      <>
                        {/* EN: USD หลัก */}
                        <div className="text-[26px] font-bold text-accent-light leading-none">
                          {totalPriceUSD ? `$${totalPriceUSD}` : `฿${totalPrice.toLocaleString()}`}
                        </div>
                        <p className="text-[11px] text-text-muted mt-0.5">฿{totalPrice.toLocaleString()} THB</p>
                      </>
                    )}
                    {paymentMethod === "card" && (
                      <p className="text-[10px] text-text-muted mt-1">{t("card_fee_hint")}</p>
                    )}
                  </>
                ) : (
                  <div />
                )}
              </div>

              <button
                disabled={loading || !hasVariants}
                onClick={handleBuyClick}
                className={`flex-1 py-3.5 rounded-xl font-semibold text-[15px] transition flex items-center justify-center gap-2 ${loading || !hasVariants
                  ? "bg-white/5 text-text-muted cursor-not-allowed"
                  : "bg-accent text-white hover:opacity-90 active:scale-95"
                  }`}
              >
                {loading ? (
                  <>
                    <div className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />
                    <span>Processing...</span>
                  </>
                ) : !hasVariants ? "Out of Stock" : "Checkout"}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </div>
  )
}