"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { useSession } from "next-auth/react"
import { Link, useRouter } from "@/i18n/routing"
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

function PremiumWarningModal({ onConfirm, onCancel }: {
  onConfirm: () => void
  onCancel: () => void
}) {
  const t = useTranslations("ProductModal")
  const [isExpanded, setIsExpanded] = useState(false)

  const features = [
    t("premium_warning_feature_1"),
    t("premium_warning_feature_2"),
    t("premium_warning_feature_3"),
  ]

  return (
    <>
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[400] flex items-center justify-center p-4 md:p-10"
            style={{ background: "rgba(0,0,0,0.9)", backdropFilter: "blur(15px)" }}
            onClick={() => setIsExpanded(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative max-w-5xl w-full aspect-video rounded-2xl overflow-hidden border border-white/10 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <img src="/uploads/premiumWorning.png" alt="Full Preview" className="w-full h-full object-contain" />
              <button
                onClick={() => setIsExpanded(false)}
                className="absolute top-4 right-4 w-10 h-10 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-all"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-[300] flex items-center justify-center p-4"
        style={{ background: "var(--color-overlay)", backdropFilter: "blur(10px)" }}
        onClick={onCancel}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
          className="relative w-[95%] max-w-[460px] rounded-3xl p-7 flex flex-col items-center gap-5"
          style={{ background: "var(--color-bg-card)", border: "1px solid var(--color-border-soft)" }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="w-14 h-14 rounded-full bg-yellow-500/15 flex items-center justify-center">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-yellow-500">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>

          <div className="text-center space-y-2">
            <h2 className="text-[19px] font-bold text-white tracking-tight">{t("premium_warning_title")}</h2>
            <p className="text-[13px] text-text-muted leading-relaxed px-2">
              {t("premium_warning_desc_1")}
              <span className="text-yellow-400 font-bold">{t("premium_warning_desc_2")}</span>
              {t("premium_warning_desc_3")}
              <span className="text-red-400 font-bold">{t("premium_warning_desc_4")}</span>
              {t("premium_warning_desc_5")}
            </p>
          </div>

          {/* Premium Preview Image */}
          <div
            onClick={() => setIsExpanded(true)}
            className="w-full group relative aspect-video rounded-2xl overflow-hidden border border-yellow-500/20 bg-black/40 cursor-zoom-in"
          >
            <img
              src="/uploads/premiumWorning.png"
              alt="Premium Settings Preview"
              className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-125"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

            {/* Hover UI Overlay */}
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-500 translate-y-2 group-hover:translate-y-0">
              <div className="bg-yellow-500/90 text-black px-4 py-2 rounded-full text-[11px] font-bold flex items-center gap-2 shadow-2xl">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /><line x1="11" y1="8" x2="11" y2="14" /><line x1="8" y1="11" x2="14" y2="11" /></svg>
                CLICK TO PREVIEW
              </div>
            </div>

            <div className="absolute bottom-3 left-4 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
              <span className="text-[10px] font-bold text-yellow-500 uppercase tracking-widest drop-shadow-md">Interface Preview</span>
            </div>
          </div>

          <div className="w-full bg-white/[0.03] border border-white/5 rounded-2xl p-4 space-y-2.5">
            {features.map((item) => (
              <div key={item} className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full bg-red-500/10 flex items-center justify-center flex-shrink-0 border border-red-500/20">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="3.5">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </div>
                <p className="text-[12.5px] text-text-muted font-medium">{item}</p>
              </div>
            ))}
          </div>

          <div className="w-full flex flex-col gap-2.5 pt-2">
            <button
              onClick={onCancel}
              className="w-full py-3.5 rounded-xl font-bold text-[14px] text-black bg-yellow-500 hover:bg-yellow-400 active:scale-95 transition-all shadow-lg shadow-yellow-500/10"
            >
              {t("premium_warning_keep")}
            </button>
            <button
              onClick={onConfirm}
              className="w-full py-3 rounded-xl text-[13px] font-semibold text-text-muted hover:text-white hover:bg-white/5 transition-all"
            >
              {t("premium_warning_skip")}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </>
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
  const [paymentMethod, setPaymentMethod] = useState<"card" | "promptpay">("card")
  const [whitelistUsername, setWhitelistUsername] = useState("")
  const [robloxVerify, setRobloxVerify] = useState<"idle" | "loading" | "valid" | "invalid">("idle")
  const [robloxAvatarUrl, setRobloxAvatarUrl] = useState<string | null>(null)
  const [robloxDisplayName, setRobloxDisplayName] = useState<string | null>(null)
  const [usdRate, setUsdRate] = useState<number | null>(null)
  const [isPremiumSelected, setIsPremiumSelected] = useState(true)
  const [hasUsedTrial, setHasUsedTrial] = useState(false)
  const [loadingTrial, setLoadingTrial] = useState(false)
  const [trialDuration, setTrialDuration] = useState<number | null>(null)
  const [isTrialEnabled, setIsTrialEnabled] = useState(true)
  const [showPremiumWarning, setShowPremiumWarning] = useState(false)
  const [discountInput, setDiscountInput] = useState("")
  const [appliedDiscount, setAppliedDiscount] = useState<{ code: string; amountOff: number } | null>(null)
  const [discountChecking, setDiscountChecking] = useState(false)
  const [discountError, setDiscountError] = useState<string | null>(null)

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

  useEffect(() => {
    const name = whitelistUsername.trim()
    if (!name) {
      setRobloxVerify("idle")
      setRobloxAvatarUrl(null)
      setRobloxDisplayName(null)
      return
    }

    setRobloxVerify("loading")
    const ctrl = new AbortController()
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/roblox/verify?username=${encodeURIComponent(name)}`, {
          signal: ctrl.signal,
        })
        const data = await res.json()
        if (data?.ok && data.user) {
          setRobloxAvatarUrl(data.user.avatarUrl ?? null)
          setRobloxDisplayName(data.user.displayName ?? data.user.username ?? null)
          setRobloxVerify("valid")
        } else {
          setRobloxVerify("invalid")
          setRobloxAvatarUrl(null)
          setRobloxDisplayName(null)
        }
      } catch (err: any) {
        if (err?.name === "AbortError") return
        setRobloxVerify("invalid")
        setRobloxAvatarUrl(null)
        setRobloxDisplayName(null)
      }
    }, 500)

    return () => {
      ctrl.abort()
      clearTimeout(timer)
    }
  }, [whitelistUsername])

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

  // Clear applied discount when the order shape changes (different variant, premium toggle).
  // The user will have to re-apply since the new subtotal may not meet min_amount, etc.
  useEffect(() => {
    if (appliedDiscount) {
      setAppliedDiscount(null)
      setDiscountInput("")
      setDiscountError(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedVariant?.id, isPremiumSelected])

  const handleApplyDiscount = async () => {
    const codeRaw = discountInput.trim().toUpperCase()
    if (!codeRaw) return
    setDiscountChecking(true)
    setDiscountError(null)
    try {
      const res = await fetch("/api/discount-codes/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: codeRaw,
          productId: product.id,
          subtotal: currentSubtotal,
        }),
      })
      const data = await res.json()
      if (data.valid) {
        setAppliedDiscount({ code: data.code, amountOff: Number(data.amountOff) })
      } else {
        setDiscountError(translateDiscountError(data.errorCode, data.params))
        setAppliedDiscount(null)
      }
    } catch {
      setDiscountError(t("discount_error_NETWORK"))
    } finally {
      setDiscountChecking(false)
    }
  }

  // Translate a server-returned errorCode (+ optional params) into the
  // user's language. Falls back gracefully if a new code arrives that the
  // client doesn't have a translation for yet.
  const translateDiscountError = (errorCode: string | undefined, params?: Record<string, any>) => {
    if (!errorCode) return t("discount_error_INVALID_INPUT")
    const key = `discount_error_${errorCode}`
    try {
      if (errorCode === "BELOW_MIN_AMOUNT") {
        const minThb = Number(params?.minAmount ?? 0)
        // Show in user's currency (THB for Thai users, USD otherwise)
        const minDisplay = isTH
          ? `฿${minThb.toLocaleString()}`
          : `$${toUSD(minThb) ?? minThb.toFixed(2)}`
        return t("discount_error_BELOW_MIN_AMOUNT", { minAmount: minDisplay })
      }
      return t(key as any)
    } catch {
      return errorCode
    }
  }

  const handleRemoveDiscount = () => {
    setAppliedDiscount(null)
    setDiscountInput("")
    setDiscountError(null)
  }

  const variantBasePrice = Number(selectedVariant?.price ?? 0)

  // --- Discount Logic ---
  const hasDiscount = !!(
    product.has_limited_discount &&
    selectedVariant?.discount_pct > 0 &&
    (selectedVariant?.discount_used ?? 0) < (selectedVariant?.discount_limit ?? 0)
  )
  const discountPct = hasDiscount ? Number(selectedVariant.discount_pct) : 0
  const variantDiscountAmount = hasDiscount ? (variantBasePrice * (discountPct / 100)) : 0
  const currentBasePrice = variantBasePrice - variantDiscountAmount

  const currentSubtotal = currentBasePrice + (isPremiumSelected ? premiumAddonPrice : 0)
  const discountAmount = appliedDiscount?.amountOff ?? 0
  const subtotalAfterDiscount = Math.max(0, currentSubtotal - discountAmount)
  const cardFee = paymentMethod === "card" ? subtotalAfterDiscount * 0.06 : 0
  const totalPrice = subtotalAfterDiscount + cardFee

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
          discountCode: appliedDiscount?.code || undefined,
        }),
      })
      const data = await res.json()
      if (data.url) window.location.href = data.url
      else {
        // Translate discount-related errors that the server tagged with errorCode;
        // fall back to the raw error string for any other failure path.
        alert(data.errorCode ? translateDiscountError(data.errorCode, data.params) : data.error)
        setLoading(false)
      }
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
        {showPremiumWarning && (
          <PremiumWarningModal
            onConfirm={() => {
              setIsPremiumSelected(false)
              setShowPremiumWarning(false)
            }}
            onCancel={() => setShowPremiumWarning(false)}
          />
        )}
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
            {/* Description is Tiptap-generated HTML — render through prose so
                headings, lists, links, tables come out styled. Trusted source:
                only admins can author it. */}
            {productDesc ? (
              <div
                className="prose prose-sm max-w-none text-[14px]"
                dangerouslySetInnerHTML={{ __html: productDesc }}
              />
            ) : (
              <p className="text-sm text-text-muted leading-relaxed">{t("no_description")}</p>
            )}

            {/* TRY DEMO LINK */}
            {product.info_page_url && (
              <a
                href={
                  product.info_page_url.startsWith("http")
                    ? product.info_page_url
                    : `https://${product.info_page_url}`
                }
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center justify-between gap-3 p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/10 hover:border-emerald-500/50 transition-all active:scale-[0.98]"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-lg bg-emerald-500/15 flex items-center justify-center flex-shrink-0">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400">
                      <line x1="6" y1="11" x2="10" y2="11" />
                      <line x1="8" y1="9" x2="8" y2="13" />
                      <line x1="15" y1="12" x2="15.01" y2="12" />
                      <line x1="18" y1="10" x2="18.01" y2="10" />
                      <path d="M17.32 5H6.68a4 4 0 0 0-3.978 3.59c-.006.052-.01.101-.017.152C2.604 9.416 2 14.456 2 16a3 3 0 0 0 3 3c1 0 1.5-.5 2-1l1.414-1.414A2 2 0 0 1 9.828 16h4.344a2 2 0 0 1 1.414.586L17 18c.5.5 1 1 2 1a3 3 0 0 0 3-3c0-1.545-.604-6.584-.685-7.258-.007-.05-.011-.1-.017-.151A4 4 0 0 0 17.32 5z" />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[13px] font-bold text-emerald-400 truncate">{t("try_demo_btn")}</p>
                    <p className="text-[11px] text-text-muted truncate">{t("try_demo_desc")}</p>
                  </div>
                </div>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400 flex-shrink-0 group-hover:translate-x-0.5 transition-transform">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                  <polyline points="15 3 21 3 21 9" />
                  <line x1="10" y1="14" x2="21" y2="3" />
                </svg>
              </a>
            )}

            {/* VARIANTS */}
            <div className="space-y-2">
              <p className="text-[11px] tracking-widest text-text-muted uppercase">{t("select_option")}</p>
              <div className="grid grid-cols-2 gap-2">
                {sortedVariants.map((v: any) => {
                  const vHasDiscount = !!(
                    product.has_limited_discount &&
                    v.discount_pct > 0 &&
                    (v.discount_used ?? 0) < (v.discount_limit ?? 0)
                  )
                  const vDiscountPct = vHasDiscount ? Number(v.discount_pct) : 0
                  const vPrice = Number(v.price)
                  const vFinalPrice = vHasDiscount ? vPrice - (vPrice * (vDiscountPct / 100)) : vPrice

                  return (
                    <button key={v.id} onClick={() => setSelectedVariant(v)}
                      className={`p-3 rounded-xl border text-left transition ${selectedVariant?.id === v.id ? "border-accent bg-accent/10" : "border-white/10 hover:border-accent/40"}`}>
                      <div className="flex justify-between items-start gap-1">
                        <div className="min-w-0">
                          <p className="text-[13px] font-medium truncate">{isTH ? v.label_th : v.label_en}</p>
                          {vHasDiscount && (
                            <div className="mt-1 flex flex-wrap items-center gap-1.5">
                              <span className="bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-tighter">-{vDiscountPct}%</span>
                              <span className="text-[9px] text-text-muted line-through opacity-70">฿{vPrice.toLocaleString()}</span>
                            </div>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <p className={`text-[13px] font-bold ${vHasDiscount ? "text-green-400" : "text-accent-light"}`}>
                            {isTH ? `฿${vFinalPrice.toLocaleString()}` : `$${toUSD(vFinalPrice) || '0.00'}`}
                          </p>
                          {usdRate && (
                            <p className="text-[10px] text-text-muted mt-0.5 whitespace-nowrap">
                              {isTH ? `≈ $${toUSD(vFinalPrice)}` : `฿${vFinalPrice.toLocaleString()}`}
                            </p>
                          )}
                        </div>
                      </div>
                      {vHasDiscount && (
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <div className="flex-1 h-1 bg-white/5 rounded-full overflow-hidden">
                            <div className="h-full bg-green-400/40 rounded-full transition-all" style={{ width: `${Math.min(100, (v.discount_used / v.discount_limit) * 100)}%` }} />
                          </div>
                          <p className="text-[9px] font-bold text-text-muted/60 whitespace-nowrap uppercase tracking-widest">{t("left") || "Left"}: {v.discount_limit - v.discount_used}</p>
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* PREMIUM ADD-ON */}
            {premiumAddonPrice > 0 && (
              <div
                onClick={() => {
                  if (isPremiumSelected) {
                    setShowPremiumWarning(true)
                  } else {
                    setIsPremiumSelected(true)
                  }
                }}
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
                  placeholder={t("ingame_username_placeholder")}
                  className={`w-full bg-bg-base border rounded-xl px-4 py-3 text-[13px] outline-none transition ${robloxVerify === "valid" ? "border-green-500/50 focus:border-green-500/70" :
                      robloxVerify === "invalid" ? "border-red-500/50 focus:border-red-500/70" :
                        "border-accent/15 focus:border-accent/40"
                    }`} />

                {robloxVerify !== "idle" && (
                  <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-white/5 border border-white/5">
                    {robloxVerify === "loading" && (
                      <>
                        <div className="w-7 h-7 rounded-full bg-white/10 animate-pulse" />
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                          <span className="text-[12px] text-text-muted">{isTH ? "กำลังตรวจสอบ..." : "Verifying..."}</span>
                        </div>
                      </>
                    )}
                    {robloxVerify === "valid" && (
                      <>
                        {robloxAvatarUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={robloxAvatarUrl} alt={robloxDisplayName ?? "avatar"} className="w-7 h-7 rounded-full bg-white/10 object-cover" />
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-white/10" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] text-white font-medium truncate">{robloxDisplayName ?? whitelistUsername}</p>
                          <p className="text-[10px] text-green-400">{isTH ? "พบบัญชี Roblox" : "Roblox account found"}</p>
                        </div>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                      </>
                    )}
                    {robloxVerify === "invalid" && (
                      <>
                        <div className="w-7 h-7 rounded-full bg-red-500/10 flex items-center justify-center">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                        </div>
                        <span className="text-[12px] text-red-400">{isTH ? "ไม่พบ username นี้" : "Username not found"}</span>
                      </>
                    )}
                  </div>
                )}
              </div>
            ) : null}

            {/* FREE TRIAL OPTION */}
            {/*             
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
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
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
            )} */}



            <hr className="border-white/5 my-4" />

            {/* PAYMENT METHOD — single display card showing the active method
                plus a small icon-only swap button. Defaults to "card"; PromptPay
                also surfaces the "for Thai customers" note when active. */}
            <div className="space-y-2">
              <p className="text-[11px] tracking-widest text-text-muted uppercase">{t("payment_method")}</p>
              <div className="flex items-stretch gap-2">
                <div className="flex-1 px-4 py-3 bg-accent/10 border border-accent/30 rounded-xl">
                  <p className="text-[14px] font-semibold leading-tight">
                    {paymentMethod === "promptpay" ? t("promptpay_label") : t("stripe_label")}
                  </p>
                  <div className="flex items-center gap-1.5 mt-1 text-[11px]">
                    <span className={`font-medium ${paymentMethod === "promptpay" ? "text-green-400" : "text-orange-400"}`}>
                      {paymentMethod === "promptpay" ? t("promptpay_desc") : t("stripe_desc")}
                    </span>
                    {paymentMethod === "promptpay" && (
                      <span className="text-text-muted">· {t("promptpay_note")}</span>
                    )}
                  </div>
                </div>
                {(() => {
                  // Tooltip describes the method the user will switch TO, with
                  // its target audience — clarifies the trade-off at hover time.
                  // Custom tooltip instead of native `title` attribute: native
                  // tooltips have ~1s delay, OS-styled box, and can't be themed.
                  const swapTooltip =
                    paymentMethod === "card" ? t("swap_to_promptpay") : t("swap_to_card")
                  return (
                    <div className="relative group/swap shrink-0">
                      <button
                        type="button"
                        onClick={() => setPaymentMethod(paymentMethod === "card" ? "promptpay" : "card")}
                        aria-label={swapTooltip}
                        className="w-11 h-full min-h-[64px] flex items-center justify-center bg-bg-base/60 hover:bg-accent/10 border border-white/10 hover:border-accent/30 text-text-muted hover:text-accent-light rounded-xl transition-colors"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="17 1 21 5 17 9" />
                          <path d="M3 11V9a4 4 0 0 1 4-4h14" />
                          <polyline points="7 23 3 19 7 15" />
                          <path d="M21 13v2a4 4 0 0 1-4 4H3" />
                        </svg>
                      </button>
                      {/* Tooltip — anchored above the swap button, right-aligned
                          so it doesn't overflow the modal's right edge. The
                          rotated-square below the bubble forms the arrow. */}
                      <div
                        role="tooltip"
                        className="pointer-events-none absolute bottom-full right-0 mb-2 z-50 w-max max-w-[260px] px-3 py-2 rounded-lg bg-bg-card border border-accent/40 shadow-xl text-[12px] leading-snug text-text-base opacity-0 group-hover/swap:opacity-100 transition-opacity duration-150"
                      >
                        {swapTooltip}
                        <span
                          aria-hidden="true"
                          className="absolute top-full right-4 -mt-1 w-2 h-2 bg-bg-card border-r border-b border-accent/40 rotate-45"
                        />
                      </div>
                    </div>
                  )
                })()}
              </div>
            </div>

            {/* DISCOUNT CODE */}
            <div className="pt-4 border-t border-white/10">
              <label className="block text-[11px] text-text-muted mb-1.5 uppercase tracking-wider">
                {t("discount_label")}
              </label>
              {appliedDiscount ? (
                <div className="flex items-center justify-between bg-green-500/10 border border-green-500/30 rounded-xl px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-green-400 font-mono font-semibold text-[13px]">
                      {appliedDiscount.code}
                    </span>
                    <span className="text-[12px] text-text-muted">
                      {isTH
                        ? `−฿${appliedDiscount.amountOff.toLocaleString()}`
                        : `−$${toUSD(appliedDiscount.amountOff) ?? appliedDiscount.amountOff.toFixed(2)}`}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleRemoveDiscount}
                    className="text-[12px] text-text-muted hover:text-red-400 transition"
                  >
                    {t("discount_remove")}
                  </button>
                </div>
              ) : (
                <div>
                  <div className="flex gap-2">
                    <input
                      value={discountInput}
                      onChange={(e) => setDiscountInput(e.target.value.toUpperCase())}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault()
                          handleApplyDiscount()
                        }
                      }}
                      placeholder={t("discount_placeholder")}
                      className="flex-1 bg-bg-base border border-white/10 rounded-xl px-3 py-2.5 text-[14px] uppercase placeholder:text-text-muted/50 focus:border-accent/40 outline-none transition"
                    />
                    <button
                      type="button"
                      onClick={handleApplyDiscount}
                      disabled={discountChecking || !discountInput.trim()}
                      className="px-4 py-2.5 rounded-xl bg-accent/15 text-accent-light text-[13px] font-medium hover:bg-accent/25 disabled:opacity-40 transition"
                    >
                      {discountChecking ? "..." : t("discount_apply")}
                    </button>
                  </div>
                  {discountError && (
                    <p className="text-[12px] text-red-400 mt-1.5">{discountError}</p>
                  )}
                </div>
              )}
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

            <p className="text-[11px] text-text-muted text-center leading-relaxed">
              {t.rich("accept_rules", {
                link: (chunks) => (
                  <Link
                    href="/rules"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent-light hover:underline underline-offset-2"
                  >
                    {chunks}
                  </Link>
                ),
              })}
            </p>
          </div>
        </motion.div>
      </motion.div>
    </div>
  )
}
