"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "@/i18n/routing"
import { motion, AnimatePresence } from "framer-motion"
import { useTranslations, useLocale } from "next-intl"
import { getImageUrl } from "@/lib/getImageUrl"

// --- ส่วน LoginModal ---
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
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
            strokeLinejoin="round" className="text-accent">
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

// --- ส่วน UsernameHelpModal ---
function UsernameHelpModal({ onClose, images }: { onClose: () => void; images: string[] }) {
  const [idx, setIdx] = useState(0)
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[300] flex items-center justify-center p-4"
      style={{ background: "var(--color-overlay)", backdropFilter: "blur(12px)" }}
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
        className="relative w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl bg-bg-card border border-white/10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <div>
            <p className="text-[16px] font-semibold text-text-base">How to find your username</p>
            <p className="text-[12px] text-text-muted mt-0.5">Follow the screenshots below</p>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-full bg-white/5 hover:bg-white/10 transition flex items-center justify-center">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>
        <div className="relative aspect-[16/10] md:aspect-video bg-bg-base overflow-hidden">
          <div className="flex h-full transition-transform duration-300 ease-out" style={{ transform: `translateX(-${idx * 100}%)` }}>
            {images.map((src, i) => (
              <div key={i} className="min-w-full h-full flex items-center justify-center bg-black/20">
                <img src={src} alt={`step-${i + 1}`} className="w-full h-full object-contain" />
              </div>
            ))}
          </div>
          {images.length > 1 && (
            <>
              <button onClick={() => setIdx((p) => Math.max(p - 1, 0))} disabled={idx === 0} className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/60 text-white disabled:opacity-30">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6" /></svg>
              </button>
              <button onClick={() => setIdx((p) => Math.min(p + 1, images.length - 1))} disabled={idx === images.length - 1} className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/60 text-white disabled:opacity-30">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6" /></svg>
              </button>
            </>
          )}
        </div>
        <div className="px-5 py-4 text-center text-[13px] text-text-muted">Step <span className="text-text-base font-semibold">{idx + 1}</span> of <span className="text-text-base font-semibold">{images.length}</span></div>
      </motion.div>
    </motion.div>
  )
}

// --- Main Component ---
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
  const [isPremiumSelected, setIsPremiumSelected] = useState(false)

  useEffect(() => {
    fetch("https://open.er-api.com/v6/latest/THB")
      .then(r => r.json()).then(data => { if (data?.rates?.USD) setUsdRate(data.rates.USD) }).catch(() => { })
  }, [])

  const sortedVariants = [...(product.product_variants ?? [])]
    .filter((v: any) => v.is_active === true && v.variant_type !== "premium")
    .sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0))

  const premiumVar = (product.product_variants ?? []).find((v: any) => v.variant_type === "premium")
  const premiumAddonPrice = Number(premiumVar?.premium_addon_price ?? 0)

  const [selectedVariant, setSelectedVariant] = useState<any>(sortedVariants[0] || null)

  const variantBasePrice = Number(selectedVariant?.price ?? 0)
  const currentSubtotal = variantBasePrice + (isPremiumSelected ? premiumAddonPrice : 0)
  const cardFee = paymentMethod === "card" ? currentSubtotal * 0.06 : 0
  const totalPrice = currentSubtotal + cardFee

  const toUSD = (thbPrice: number) => usdRate ? (Number(thbPrice) * usdRate).toFixed(2) : null
  const totalPriceUSD = toUSD(totalPrice)

  const images = product.product_images?.length > 0 ? product.product_images : [{ url: "/placeholder.png" }]
  const total = images.length
  const usernameHelpImages = ["/uploads/userHelp.png"]

  const prev = useCallback(() => setIndex((p) => Math.max(p - 1, 0)), [])
  const next = useCallback(() => setIndex((p) => Math.min(p + 1, total - 1)), [total])

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { if (showLoginModal || showUsernameHelp) { setShowLoginModal(false); setShowUsernameHelp(false) } else onClose() }
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
    if (!selectedVariant || !whitelistUsername.trim()) { alert("Please enter your in-game username"); return }
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
          isPremium: isPremiumSelected,
        }),
      })
      const data = await res.json()
      if (data.url) window.location.href = data.url
      else { alert(data.error); setLoading(false) }
    } catch (err) { setLoading(false) }
  }

  const productDesc = isTH ? (product.description_th || product.description_en) : product.description_en

  return (
    <div className="relative">
      <AnimatePresence>
        {showLoginModal && <LoginModal onClose={() => setShowLoginModal(false)} />}
        {showUsernameHelp && <UsernameHelpModal onClose={() => { setShowUsernameHelp(false); inputRef.current?.blur() }} images={usernameHelpImages} />}
      </AnimatePresence>

      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center sm:p-5"
        style={{ background: "var(--color-overlay)", backdropFilter: "blur(8px)" }}
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
          className="w-full bg-bg-card border border-accent/20 rounded-t-2xl sm:rounded-2xl max-h-[92vh] sm:max-w-2xl overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* IMAGE SLIDER */}
          <div className="relative aspect-video bg-bg-base overflow-hidden" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
            <div className="flex h-full transition-transform duration-300" style={{ transform: `translateX(-${index * 100}%)` }}>
              {images.map((img: any, i: number) => (
                <img key={i} src={getImageUrl(img.url)} alt="" className="min-w-full h-full object-cover" />
              ))}
            </div>
            <button onClick={onClose} className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center transition">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
            </button>
            {total > 1 && (
              <>
                <button onClick={prev} disabled={index === 0} className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 text-white disabled:opacity-30">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6" /></svg>
                </button>
                <button onClick={next} disabled={index === total - 1} className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 text-white disabled:opacity-30">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6" /></svg>
                </button>
              </>
            )}
          </div>

          {total > 1 && (
            <div className="flex gap-2 px-4 py-3 bg-bg-base border-b border-white/5 overflow-x-auto scrollbar-none">
              {images.map((img: any, i: number) => (
                <button key={i} onClick={() => setIndex(i)} className={`relative flex-shrink-0 w-14 h-14 rounded-lg overflow-hidden transition-all ${i === index ? "ring-2 ring-accent opacity-100" : "opacity-40"}`}>
                  <img src={getImageUrl(img.url)} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}

          <div className="p-5 space-y-4">
            <p className="text-sm text-text-muted leading-relaxed">{productDesc || t("no_description")}</p>

            {/* VARIANTS */}
            <div className="space-y-2">
              <p className="text-[11px] tracking-widest text-text-muted uppercase">{t("select_option")}</p>
              <div className="grid grid-cols-2 gap-2">
                {sortedVariants.map((v: any) => (
                  <button key={v.id} onClick={() => setSelectedVariant(v)}
                    className={`p-3 rounded-xl border text-left transition ${selectedVariant?.id === v.id ? "border-accent bg-accent/10" : "border-white/10 hover:border-accent/40"}`}>
                    <div className="flex justify-between items-start gap-1">
                      <p className="text-[13px] font-medium">{isTH ? v.label_th : v.label_en}</p>
                      <div className="text-right">
                        <p className="text-[13px] font-bold text-accent-light">
                          {isTH ? `฿${Number(v.price).toLocaleString()}` : `$${toUSD(v.price) || '0.00'}`}
                        </p>
                        {usdRate && (
                          <p className="text-[10px] text-text-muted mt-0.5 whitespace-nowrap">
                            {isTH ? `≈ $${toUSD(v.price)}` : `฿${Number(v.price).toLocaleString()}`}
                          </p>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* PREMIUM ADD-ON */}
            {premiumAddonPrice > 0 && (
              <div
                onClick={() => setIsPremiumSelected(!isPremiumSelected)}
                className={`cursor-pointer p-4 rounded-2xl border transition-all flex items-center justify-between ${isPremiumSelected ? "bg-yellow-500/10 border-yellow-500/50 shadow-lg" : "bg-white/5 border-white/10 hover:border-white/20"}`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition ${isPremiumSelected ? "bg-yellow-500 border-yellow-500" : "border-white/20"}`}>
                    {isPremiumSelected && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="4"><polyline points="20 6 9 17 4 12" /></svg>}
                  </div>
                  <div>
                    <p className={`text-[14px] font-bold ${isPremiumSelected ? "text-yellow-500" : "text-white"}`}>{t("upgrade_premium")}</p>
                    <p className="text-[11px] text-text-muted">{t("upgrade_unlock")}</p>
                  </div>
                </div>
                <div className="text-right">
                   <p className={`text-[13px] font-bold ${isPremiumSelected ? "text-yellow-500" : "text-text-muted"}`}>
                      {isTH ? `+฿${premiumAddonPrice.toLocaleString()}` : `+$${toUSD(premiumAddonPrice)}`}
                   </p>
                   {usdRate && (
                     <p className="text-[10px] text-text-muted mt-0.5">
                        {isTH ? `≈ $${toUSD(premiumAddonPrice)}` : `฿${premiumAddonPrice.toLocaleString()} THB`}
                     </p>
                   )}
                </div>
              </div>
            )}

            {/* IN-GAME USERNAME */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-[11px] tracking-widest text-text-muted uppercase">{t("ingame_username")}</p>
                <button onClick={() => setShowUsernameHelp(true)} className="text-[11px] text-accent-light hover:opacity-80 transition flex items-center gap-1">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                  {t("how_to_find")}
                </button>
              </div>
              <input ref={inputRef} value={whitelistUsername} onChange={(e) => setWhitelistUsername(e.target.value)}
                onFocus={() => { if (!hasShownUsernameHelp.current) { hasShownUsernameHelp.current = true; setShowUsernameHelp(true) } }}
                placeholder={t("ingame_username_placeholder")} className="w-full bg-bg-base border border-accent/15 rounded-xl px-4 py-3 text-[13px] outline-none focus:border-accent/40 transition" />
            </div>

            {/* PAYMENT METHOD */}
            <div className="space-y-2">
              <p className="text-[11px] tracking-widest text-text-muted uppercase">{t("payment_method")}</p>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setPaymentMethod("promptpay")} className={`p-3 rounded-xl border text-left transition ${paymentMethod === "promptpay" ? "border-accent bg-accent/10" : "border-white/10"}`}>
                  <p className="text-[13px] font-medium">{t("promptpay_label")}</p>
                  <p className="text-[10px] text-green-400">{t("promptpay_desc")}</p>
                </button>
                <button onClick={() => setPaymentMethod("card")} className={`p-3 rounded-xl border text-left transition ${paymentMethod === "card" ? "border-accent bg-accent/10" : "border-white/10"}`}>
                  <p className="text-[13px] font-medium">{t("stripe_label")}</p>
                  <p className="text-[10px] text-orange-400">{t("stripe_desc")}</p>
                </button>
              </div>
            </div>

            {/* TOTAL & BUY */}
            <div className="flex items-center gap-3 pt-4 border-t border-white/10">
              <div className="flex-1">
                <p className="text-[11px] text-text-muted mb-0.5">{t("total")}</p>
                <div className={`text-[26px] font-bold leading-none ${isPremiumSelected ? "text-yellow-500" : "text-accent-light"}`}>
                  {isTH ? `฿${totalPrice.toLocaleString()}` : `$${totalPriceUSD || '0.00'}`}
                </div>
                {usdRate && (
                   <p className="text-[11px] text-text-muted mt-1 font-medium">
                      {isTH ? `≈ $${totalPriceUSD} USD` : `฿${totalPrice.toLocaleString()} THB`}
                   </p>
                )}
              </div>
              <button disabled={loading} onClick={handleBuyClick}
                className={`flex-1 py-3.5 rounded-xl font-semibold text-[15px] transition flex items-center justify-center gap-2 ${loading ? "bg-white/5 opacity-50" : (isPremiumSelected ? "bg-yellow-500 text-black hover:opacity-90" : "bg-accent text-white hover:opacity-90 active:scale-95")}`}>
                {loading ? "Processing..." : "Checkout"}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </div>
  )
}