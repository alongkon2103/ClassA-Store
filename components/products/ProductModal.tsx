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
  const [isPremiumSelected, setIsPremiumSelected] = useState(true)
  const [hasUsedTrial, setHasUsedTrial] = useState(false)
  const [loadingTrial, setLoadingTrial] = useState(false)
  const [trialDuration, setTrialDuration] = useState<number | null>(null)
  const [isTrialEnabled, setIsTrialEnabled] = useState(true)

  useEffect(() => {
    fetch("/api/checkout/trial")
      .then(res => res.json())
      .then(data => {
        if (data.hasUsedTrial) setHasUsedTrial(true)
        if (data.trialDuration) setTrialDuration(data.trialDuration)
        if (data.isTrialEnabled !== undefined) setIsTrialEnabled(data.isTrialEnabled)
      })
      .catch(() => { })
  }, [session])

  useEffect(() => {
    fetch("https://open.er-api.com/v6/latest/THB")
      .then(r => r.json()).then(data => { if (data?.rates?.USD) setUsdRate(data.rates.USD) }).catch(() => { })
  }, [])

  const sortedVariants = [...(product.product_variants ?? [])]
    .filter((v: any) => v.is_active === true && v.variant_type !== "premium")
    .sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0))

  const premiumVar = (product.product_variants ?? []).find((v: any) => v.variant_type === "premium")
  const premiumAddonPrice = Number(premiumVar?.premium_addon_price ?? 0)
  
  // TypeScript Fix: Strictly cast nullable DB field to boolean
  const isPremiumProduct: boolean = !!product.is_premium

  useEffect(() => {
    if (premiumAddonPrice <= 0) setIsPremiumSelected(false)
  }, [premiumAddonPrice])

  const [selectedVariant, setSelectedVariant] = useState<any>(sortedVariants[0] || null)

  const variantBasePrice = Number(selectedVariant?.price ?? 0)
  const currentSubtotal = variantBasePrice + (isPremiumSelected ? premiumAddonPrice : 0)
  const cardFee = paymentMethod === "card" ? currentSubtotal * 0.06 : 0
  const totalPrice = currentSubtotal + cardFee

  const toUSD = (thbPrice: number) => usdRate ? (Number(thbPrice) * usdRate).toFixed(2) : null
  const totalPriceUSD = toUSD(totalPrice)

  const getYoutubeEmbedUrl = (url: string) => {
    if (!url) return null
    let videoId = ""
    if (url.includes("youtube.com/watch?v=")) videoId = url.split("v=")[1].split("&")[0]
    else if (url.includes("youtu.be/")) videoId = url.split("youtu.be/")[1].split("?")[0]
    else if (url.includes("youtube.com/embed/")) videoId = url.split("embed/")[1].split("?")[0]
    return videoId ? `https://www.youtube.com/embed/${videoId}` : null
  }

  const youtubeEmbedUrl = getYoutubeEmbedUrl(product.youtube_url)
  const images = product.product_images?.length > 0 ? product.product_images : [{ url: "/placeholder.png" }]
  const total = images.length + (youtubeEmbedUrl ? 1 : 0)
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

  const handleTrialClick = async () => {
    if (!session) { setShowLoginModal(true); return }
    if (!whitelistUsername.trim()) { alert("Please enter your in-game username"); return }
    setLoadingTrial(true)
    try {
      const res = await fetch("/api/checkout/trial", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: product.id,
          whitelistUsername: whitelistUsername.trim(),
        }),
      })
      const data = await res.json()
      if (data.success) {
        router.push(`/orders/${data.orderId}/settings`)
      } else {
        alert(data.error)
        setLoadingTrial(false)
      }
    } catch (err) { setLoadingTrial(false) }
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
              {youtubeEmbedUrl && (
                <div className="min-w-full h-full bg-black flex items-center justify-center">
                  <iframe
                    width="100%"
                    height="100%"
                    src={`${youtubeEmbedUrl}?rel=0&modestbranding=1`}
                    title="YouTube video player"
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                  ></iframe>
                </div>
              )}
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

          {/* {total > 1 && (
            <div className="flex gap-2 px-4 py-3 bg-bg-base border-b border-white/5 overflow-x-auto scrollbar-none">
              {images.map((img: any, i: number) => (
                <button key={i} onClick={() => setIndex(i)} className={`relative flex-shrink-0 w-14 h-14 rounded-lg overflow-hidden transition-all ${i === index ? "ring-2 ring-accent opacity-100" : "opacity-40"}`}>
                  <img src={getImageUrl(img.url)} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
              {youtubeEmbedUrl && (
                <button 
                  onClick={() => setIndex(images.length)} 
                  className={`relative flex-shrink-0 w-14 h-14 rounded-lg overflow-hidden transition-all bg-black flex items-center justify-center ${index === images.length ? "ring-2 ring-accent opacity-100" : "opacity-40"}`}
                >
                   <svg width="24" height="24" viewBox="0 0 24 24" fill="red" stroke="red" strokeWidth="1"><path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2c.46-1.7.46-5.33.46-5.33a29 29 0 0 0-.46-5.33z"/><polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02" fill="white"/></svg>
                </button>
              )}
            </div>
          )} */}

          {total > 1 && (
            <div className="flex gap-2 px-4 py-3 bg-bg-base border-b border-white/5 overflow-x-auto scrollbar-none">
              {images.map((img: any, i: number) => (
                <button key={i} onClick={() => setIndex(i)} className={`relative flex-shrink-0 w-14 h-14 rounded-lg overflow-hidden transition-all ${i === index ? "ring-2 ring-accent opacity-100" : "opacity-40"}`}>
                  <img src={getImageUrl(img.url)} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
              {youtubeEmbedUrl && (() => {
                const videoId = youtubeEmbedUrl.split("/embed/")[1]?.split("?")[0]
                const thumbUrl = `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`
                return (
                  <button
                    onClick={() => setIndex(images.length)}
                    className={`relative flex-shrink-0 w-14 h-14 rounded-lg overflow-hidden transition-all ${index === images.length ? "ring-2 ring-accent opacity-100" : "opacity-40"}`}
                  >
                    <img src={thumbUrl} alt="YouTube thumbnail" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="red" stroke="none">
                        <path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2c.46-1.7.46-5.33.46-5.33a29 29 0 0 0-.46-5.33z" />
                        <polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02" fill="white" />
                      </svg>
                    </div>
                  </button>
                )
              })()}
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

            {/* IN-GAME USERNAME - Auth Guard: Hide if trial enabled but not logged in */}
            {(!isTrialEnabled || session) ? (
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
            ) : null}

            {/* FREE TRIAL OPTION */}
            {isTrialEnabled && (
              <div className="pt-2">
                <button
                  disabled={loadingTrial || !!(session && hasUsedTrial)}
                  onClick={handleTrialClick}
                  className={`w-full py-3.5 rounded-xl font-bold text-[14px] border transition-all flex items-center justify-center gap-2 ${(session && hasUsedTrial)
                      ? "border-white/5 bg-white/5 text-text-muted cursor-not-allowed opacity-50"
                      : "bg-violet-600/20 hover:bg-violet-600/30 border-violet-500/40 text-violet-400 active:scale-[0.98] shadow-lg shadow-violet-500/10"
                    }`}
                >
                  {loadingTrial ? (
                    <div className="w-4 h-4 border-2 border-violet-400 border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                    </svg>
                  )}
                  {!session 
                    ? t("login_to_trial")
                    : hasUsedTrial
                      ? t("trial_limit_reached")
                      : t("free_trial_btn", { duration: trialDuration ?? "..." })}
                </button>
                {(session && !hasUsedTrial) && (
                  <p className="text-[11px] text-gray-400 font-medium text-center mt-3">
                    {t("free_trial_limit")}
                  </p>
                )}
              </div>
            )}

            <hr className="border-white/5 my-4" />

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
