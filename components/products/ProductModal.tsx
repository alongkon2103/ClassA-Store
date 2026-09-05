"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { createPortal } from "react-dom"
import { useSession } from "next-auth/react"
import { Link, useRouter } from "@/i18n/routing"
import { motion, AnimatePresence } from "framer-motion"
import { useTranslations, useLocale } from "next-intl"
import { getImageUrl } from "@/lib/getImageUrl"
import { previewDiscountAmount, pickBestAutoCode, type AutoCodeCandidate } from "@/lib/discountCodes"

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
        <button onClick={() => {
            // Return to the exact page they were on after signing in.
            const cb = typeof window !== "undefined" ? window.location.pathname + window.location.search : "/"
            router.push(`/login?callbackUrl=${encodeURIComponent(cb)}`)
          }}
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
interface ProductVariant {
  id: string
  price: number
  label_en?: string
  label_th?: string
  variant_type?: string | null
  is_active?: boolean | null
  sort_order?: number | null
  discount_pct: number
  discount_used: number
  discount_limit: number
  premium_addon_price?: number | string | null
}

interface ProductImage {
  url: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
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
  const [paymentMethod, setPaymentMethod] = useState<"card" | "promptpay" | "paypal" | "paypal_me">("card")
  const [whitelistUsername, setWhitelistUsername] = useState("")
  const [robloxVerify, setRobloxVerify] = useState<"idle" | "loading" | "valid" | "invalid">("idle")
  const [robloxAvatarUrl, setRobloxAvatarUrl] = useState<string | null>(null)
  const [robloxDisplayName, setRobloxDisplayName] = useState<string | null>(null)
  const [usdRate, setUsdRate] = useState<number | null>(null)
  const [isPremiumSelected, setIsPremiumSelected] = useState(true)
  const [, setHasUsedTrial] = useState(false)
  const [, setLoadingTrial] = useState(false)
  const [, setTrialDuration] = useState<number | null>(null)
  const [isTrialEnabled, setIsTrialEnabled] = useState(true)
  const [showPremiumWarning, setShowPremiumWarning] = useState(false)
  const [discountInput, setDiscountInput] = useState("")
  // `source` tracks how the code got here so re-evaluation on variant/premium
  // change knows what to do: 'auto' = pre-applied best code, 'card' = tapped a
  // public card, 'typed' = manually entered (can't be re-evaluated client-side).
  type DiscountSource = "auto" | "card" | "typed"
  const [appliedDiscount, setAppliedDiscount] =
    useState<{ code: string; amountOff: number; source: DiscountSource } | null>(null)
  const [discountChecking, setDiscountChecking] = useState(false)
  const [discountError, setDiscountError] = useState<string | null>(null)
  // Once the shopper removes the auto-applied code we stop re-applying it for
  // the rest of this modal session (Shopee behaviour — respect the removal).
  const [autoDismissed, setAutoDismissed] = useState(false)

  // Public/featured codes (is_public) — shown as one-tap cards under the
  // discount input. Visible to everyone; applying still requires login.
  type PublicCode = {
    code: string
    type: string // "fixed" | "percent"
    value: number
    min_amount: number | null
    remaining: number | null // null = unlimited
    already_used: boolean
    is_auto_select: boolean
  }
  const [publicCodes, setPublicCodes] = useState<PublicCode[]>([])
  // Collapsed by default: show only the first 3 cards, "show more" expands.
  const [showAllCodes, setShowAllCodes] = useState(false)

  // Affiliate referral code remembered from a /r/<code> link (localStorage).
  // When it resolves and applies to this product it is auto-applied with
  // precedence over the global auto-select code (the affiliate wins).
  type RefInfo = { code: string; type: string; value: number; min_amount: number | null }
  const [refInfo, setRefInfo] = useState<RefInfo | null>(null)

  // Payment config (per-method enabled flag + fee_pct). Admin-controlled via
  // /admin/settings; defaults applied here in case the fetch fails so the user
  // can still check out with sensible values.
  type PMConfig = { enabled: boolean; fee_pct: number }
  type PMConfigMap = { card: PMConfig; promptpay: PMConfig; paypal: PMConfig; paypal_me: PMConfig }
  const [paymentConfig, setPaymentConfig] = useState<PMConfigMap>({
    card: { enabled: true, fee_pct: 6 },
    promptpay: { enabled: true, fee_pct: 0 },
    paypal: { enabled: true, fee_pct: 0 },
    paypal_me: { enabled: false, fee_pct: 0 },
  })

  useEffect(() => {
    let cancelled = false
    fetch("/api/public/payment-config")
      .then((r) => r.json())
      .then((data: PMConfigMap) => {
        if (cancelled || !data) return
        setPaymentConfig(data)
        // If the currently selected method got disabled, fall back to the first
        // enabled one so the user is never stuck on a disabled choice.
        const order: (keyof PMConfigMap)[] = ["card", "promptpay", "paypal", "paypal_me"]
        setPaymentMethod((current) => {
          if (data[current]?.enabled) return current
          const next = order.find((m) => data[m]?.enabled)
          return next ?? current
        })
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    fetch(`/api/discount-codes/public?productId=${encodeURIComponent(product.id)}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled && Array.isArray(data?.codes)) setPublicCodes(data.codes)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [product.id, session?.user?.id])

  // Resolve the remembered affiliate ref code (from /r/<code>) for this product.
  useEffect(() => {
    let cancelled = false
    let code: string | null = null
    try {
      code = sessionStorage.getItem("aff_ref")
    } catch { /* storage disabled */ }
    if (!code) {
      setRefInfo(null)
      return
    }
    fetch(`/api/discount-codes/resolve?code=${encodeURIComponent(code)}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return
        // Only keep it if it applies to THIS product (global or this product's).
        if (d?.found && (d.product_id === null || d.product_id === product.id)) {
          setRefInfo({ code: d.code, type: d.type, value: d.value, min_amount: d.min_amount })
        } else {
          setRefInfo(null)
        }
      })
      .catch(() => { if (!cancelled) setRefInfo(null) })
    return () => { cancelled = true }
  }, [product.id])

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
    // Use the SAME rate the checkout backend freezes onto the order (getThbToUsdRate,
    // cached 6h) instead of a fresh open.er-api call, so the displayed price matches
    // the amount charged — see /api/public/exchange-rate.
    fetch("/api/public/exchange-rate")
      .then(r => r.json()).then(data => { if (data?.rate) setUsdRate(data.rate) }).catch(() => { })
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
      } catch (err: unknown) {
        if ((err as Error)?.name === "AbortError") return
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
    .filter((v: ProductVariant) => v.is_active === true && v.variant_type !== "premium")
    .sort((a: ProductVariant, b: ProductVariant) => (a.sort_order ?? 0) - (b.sort_order ?? 0))

  const premiumVar = (product.product_variants ?? []).find((v: ProductVariant) => v.variant_type === "premium")
  const premiumAddonPrice = Number(premiumVar?.premium_addon_price ?? 0)

  useEffect(() => {
    if (premiumAddonPrice <= 0) setIsPremiumSelected(false)
  }, [premiumAddonPrice])

  const [selectedVariant, setSelectedVariant] = useState(sortedVariants[0] || null)

  const applyDiscountCode = async (codeRaw: string, source: DiscountSource = "typed") => {
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
        setAppliedDiscount({ code: data.code, amountOff: Number(data.amountOff), source })
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

  const handleApplyDiscount = () => applyDiscountCode(discountInput.trim().toUpperCase(), "typed")

  // One-tap apply from a public-code card. Anyone can see the cards, but
  // applying requires login (same rule as the validate endpoint).
  const handlePublicCodeClick = (c: { code: string }) => {
    if (discountChecking) return
    if (!session) {
      setShowLoginModal(true)
      return
    }
    setAutoDismissed(false)
    setDiscountInput(c.code)
    applyDiscountCode(c.code, "card")
  }

  // Translate a server-returned errorCode (+ optional params) into the
  // user's language. Falls back gracefully if a new code arrives that the
  // client doesn't have a translation for yet.
  const translateDiscountError = (errorCode: string | undefined, params?: Record<string, unknown>) => {
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
      return t(key as Parameters<typeof t>[0])
    } catch {
      return errorCode
    }
  }

  const handleRemoveDiscount = () => {
    setAppliedDiscount(null)
    setDiscountInput("")
    setDiscountError(null)
    // Respect the removal — don't silently re-apply the auto code afterwards.
    setAutoDismissed(true)
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
  const activeFeePct = paymentConfig[paymentMethod]?.fee_pct ?? 0
  const cardFee = subtotalAfterDiscount * (activeFeePct / 100)
  const totalPrice = subtotalAfterDiscount + cardFee

  // Auto-select / re-evaluate the discount whenever the order shape (variant,
  // premium) or the code list changes. amountOff computed here is PREVIEW only —
  // checkout re-validates and reserves authoritatively, so this can safely run
  // without login and without hitting the server.
  useEffect(() => {
    const autoCandidates: AutoCodeCandidate[] = publicCodes.map((c) => ({
      code: c.code,
      type: c.type,
      value: c.value,
      minAmount: c.min_amount,
      isAutoSelect: c.is_auto_select,
      soldOut: c.remaining === 0,
      alreadyUsed: c.already_used,
    }))

    setAppliedDiscount((prev) => {
      // 1) Keep the shopper's manual pick (tapped card / typed) if still valid.
      if (prev && prev.source !== "auto") {
        const pc = publicCodes.find((c) => c.code === prev.code)
        if (pc) {
          const off = previewDiscountAmount(
            { type: pc.type, value: pc.value, minAmount: pc.min_amount },
            currentSubtotal,
          )
          if (off > 0 && !pc.already_used && pc.remaining !== 0) {
            return { code: prev.code, amountOff: off, source: prev.source }
          }
        } else if (prev.source === "typed" && currentSubtotal > 0) {
          // Private code — can't re-evaluate client-side; keep it (checkout
          // re-validates). Its displayed amount may lag until re-applied.
          return prev
        }
        // Manual pick no longer valid → drop and consider the auto code below.
      }
      // 2) Auto-apply, unless the shopper removed it. The affiliate ref code
      //    (from their /r/<code> link) wins over the global auto-select code.
      if (autoDismissed) return null
      if (refInfo) {
        const off = previewDiscountAmount(
          { type: refInfo.type, value: refInfo.value, minAmount: refInfo.min_amount },
          currentSubtotal,
        )
        if (off > 0) return { code: refInfo.code, amountOff: off, source: "auto" }
      }
      const best = pickBestAutoCode(autoCandidates, currentSubtotal)
      return best ? { code: best.code, amountOff: best.amountOff, source: "auto" } : null
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSubtotal, publicCodes, autoDismissed, refInfo])

  const toUSD = (thbPrice: number) => usdRate ? (Number(thbPrice) * usdRate).toFixed(2) : null
  const totalPriceUSD = toUSD(totalPrice)

  // Money label in the viewer's currency (THB for th locale, USD otherwise) —
  // same convention as the total price display.
  const fmtMoney = (thb: number) =>
    isTH ? `฿${thb.toLocaleString()}` : `$${toUSD(thb) ?? thb.toFixed(2)}`

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

  // desktop_program products have no in-game username — access is per logged-in
  // account. We still send a non-empty value (the buyer's email) so the existing
  // checkout routes' "username required" guard passes; fulfillment ignores it and
  // grants by user_id. Roblox products are unchanged.
  const isDesktop = product?.type === "desktop_program"
  const effectiveUsername = () => (isDesktop ? (session?.user?.email || "desktop") : whitelistUsername.trim())

  const handleBuyClick = async () => {
    if (!session) { setShowLoginModal(true); return }
    if (!selectedVariant) { alert("Please choose an option"); return }
    if (!isDesktop && !whitelistUsername.trim()) { alert("Please enter your in-game username"); return }
    setLoading(true)
    try {
      // Each provider has its own endpoint. PayPal (API) converts THB→USD and
      // returns an approval URL; paypal_me creates a pay-by-amount order and
      // returns { orderId } for our own pay page; card/promptpay use /api/checkout.
      const endpoint =
        paymentMethod === "paypal"
          ? "/api/checkout/paypal"
          : paymentMethod === "paypal_me"
            ? "/api/checkout/paypal-me"
            : "/api/checkout"
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: product.id,
          variantId: selectedVariant.id,
          paymentMethod,
          locale,
          whitelistUsername: effectiveUsername(),
          isPremium: isPremiumSelected,
          discountCode: appliedDiscount?.code || undefined,
          // Affiliate referral from the /r/<code> link — sent even when the
          // discount isn't applied, so the affiliate can still earn on their
          // allowed game(s). Server validates the code + product scope.
          refCode: (() => { try { return sessionStorage.getItem("aff_ref") || undefined } catch { return undefined } })(),
        }),
      })
      const data = await res.json()
      if (paymentMethod === "paypal_me" && data.orderId) {
        router.push(`/checkout/${data.orderId}`)
      } else if (data.url) {
        window.location.href = data.url
      } else {
        // Translate discount-related errors that the server tagged with errorCode;
        // fall back to the raw error string for any other failure path.
        alert(data.errorCode ? translateDiscountError(data.errorCode, data.params) : data.error)
        setLoading(false)
      }
    } catch { setLoading(false) }
  }

  const handleTrialClick = async () => {
    if (!session) { setShowLoginModal(true); return }
    if (!isDesktop && !whitelistUsername.trim()) { alert("Please enter your in-game username"); return }
    setLoadingTrial(true)
    try {
      const res = await fetch("/api/checkout/trial", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: product.id,
          whitelistUsername: effectiveUsername(),
        }),
      })
      const data = await res.json()
      if (data.success) {
        router.push(`/orders/${data.orderId}/settings`)
      } else {
        alert(data.error)
        setLoadingTrial(false)
      }
    } catch { setLoadingTrial(false) }
  }

  const productDesc = isTH ? (product.description_th || product.description_en) : product.description_en

  // เรนเดอร์ผ่าน portal ไปที่ body — กัน ancestor ที่มี transform/filter
  // ทำให้ position:fixed กลายเป็นอ้างอิงกล่องนั้นแทน viewport (modal จะหลุดจอ)
  return createPortal(
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
          className="w-full bg-bg-card border border-border-soft rounded-t-2xl sm:rounded-[18px] max-h-[92vh] sm:max-w-[480px] overflow-y-auto custom-scrollbar"
          onClick={(e) => e.stopPropagation()}
        >
          {/* หัวเรื่อง + ปุ่มปิด (ตามดีไซน์ modal ยืนยันการสั่งซื้อ) */}
          <div className="flex items-center justify-between px-6 sm:px-7 pt-6">
            <h2 className="text-lg font-extrabold">{t("confirm_title")}</h2>
            <button
              onClick={onClose}
              aria-label="close"
              className="w-9 h-9 rounded-[10px] border border-border-soft text-text-muted flex items-center justify-center hover:bg-white/[0.05] hover:text-text-base transition"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* สรุปสินค้า: รูปเล็ก + ชื่อ + แพ็กเกจที่เลือก + ราคา */}
          <div className="px-6 sm:px-7 pt-6">
            <div className="flex items-center gap-3.5 p-4 bg-bg-surface rounded-xl">
              <img
                src={getImageUrl(images[0].url)}
                alt=""
                className="w-14 h-14 rounded-[10px] object-cover shrink-0"
              />
              <div className="min-w-0">
                <h3 className="text-[0.88rem] font-bold mb-0.5 truncate">
                  {isTH ? product.name_th : product.name_en}
                </h3>
                <p className="text-xs text-text-dim truncate">
                  {selectedVariant ? (isTH ? selectedVariant.label_th : selectedVariant.label_en) : "—"}
                </p>
              </div>
              <div className="ml-auto text-lg font-extrabold shrink-0">
                {isTH ? `฿${totalPrice.toLocaleString()}` : `$${totalPriceUSD || "0.00"}`}
              </div>
            </div>
          </div>

          <div className="px-6 sm:px-7 py-6 space-y-5">
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
                {sortedVariants.map((v: ProductVariant) => {
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

            {/* Desktop programs: no in-game name — sign in with the account.
                Otherwise the IN-GAME USERNAME field (hidden pre-login when trial on). */}
            {isDesktop ? (
              <div className="rounded-xl bg-bg-base/50 border border-accent/10 px-4 py-3">
                <p className="text-[12px] text-text-muted leading-relaxed">
                  {isTH
                    ? "โปรแกรมนี้เข้าใช้ด้วยบัญชีที่ล็อกอิน ไม่ต้องกรอกชื่อในเกม · ลิงก์ดาวน์โหลดตัวติดตั้งจะขึ้นหลังชำระเงินสำเร็จ"
                    : "This program signs in with your account — no in-game name needed. The installer download link appears after payment."}
                </p>
              </div>
            ) : (!isTrialEnabled || session) ? (
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

            {/* PAYMENT METHOD — card displays the active method, swap button
                cycles through enabled methods only (admin can disable any
                method in /admin/settings). Fee label is read from settings,
                not hardcoded, so a "+6%" Stripe badge becomes "+3%" the moment
                the admin changes the value. */}
            {/* ช่องทางชำระเงิน — การ์ดเลือกได้ตามดีไซน์
                แสดงเฉพาะช่องทางที่แอดมินเปิดไว้ และ % ค่าธรรมเนียมอ่านจาก settings
                ไม่ได้ hardcode ถ้าแอดมินแก้เป็น 3% ป้ายจะเปลี่ยนตามทันที */}
            <div>
              <label className="text-[0.88rem] font-bold mb-3 block">{t("payment_method")}</label>
              <div className="flex flex-col sm:flex-row gap-2.5">
                {(["card", "promptpay", "paypal", "paypal_me"] as const)
                  .filter((m) => paymentConfig[m]?.enabled)
                  .map((m) => {
                    const on = paymentMethod === m
                    const fee = paymentConfig[m]?.fee_pct ?? 0
                    const label =
                      m === "promptpay" ? t("promptpay_label")
                        : m === "paypal" ? t("paypal_label")
                          : m === "paypal_me" ? t("paypal_me_label")
                            : t("stripe_label")
                    const icon =
                      m === "promptpay" ? (<><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><polyline points="9 12 11 14 15 10" /></>)
                        : m === "card" ? (<><rect x="1" y="4" width="22" height="16" rx="2" /><line x1="1" y1="10" x2="23" y2="10" /></>)
                          : (<><circle cx="12" cy="12" r="10" /><path d="M8 12h8M12 8v8" /></>)
                    return (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setPaymentMethod(m)}
                        className={`flex-1 p-4 rounded-xl border-2 text-center relative transition ${
                          on
                            ? "border-accent bg-accent/[0.04] shadow-[0_0_0_1px_rgba(37,99,235,0.15)]"
                            : "border-border-soft bg-bg-base hover:border-border-light hover:bg-white/[0.02]"
                        }`}
                      >
                        {on && (
                          <span className="absolute top-2 right-2 w-5 h-5 rounded-full bg-accent flex items-center justify-center">
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          </span>
                        )}
                        <span
                          className="w-10 h-10 rounded-[10px] flex items-center justify-center mx-auto mb-2.5 text-accent-light border border-accent/[0.12]"
                          style={{ background: "linear-gradient(135deg,rgba(37,99,235,0.10),rgba(37,99,235,0.04))" }}
                        >
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            {icon}
                          </svg>
                        </span>
                        <div className="text-[0.78rem] font-bold mb-0.5">{label}</div>
                        <div className={`text-[0.68rem] ${fee > 0 ? "text-text-dim" : "text-success font-semibold"}`}>
                          {fee > 0 ? t("fee_plus", { pct: fee }) : t("fee_zero")}
                        </div>
                      </button>
                    )
                  })}
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

              {/* PUBLIC CODES — always shown so the shopper can switch codes even
                  while one is applied. Active code is highlighted; usable cards
                  sort first so the collapsed top-3 never hides a usable one. */}
              {publicCodes.length > 0 && (() => {
                const isDisabledCard = (c: PublicCode) =>
                  c.remaining === 0 || c.already_used || currentSubtotal < (c.min_amount ?? 0)
                const sorted = [...publicCodes].sort(
                  (a, b) => Number(isDisabledCard(a)) - Number(isDisabledCard(b)),
                )
                const visible = showAllCodes ? sorted : sorted.slice(0, 3)
                const hiddenCount = sorted.length - 3
                return (
                <div className="mt-2.5 space-y-2">
                  {visible.map((c) => {
                    const soldOut = c.remaining === 0
                    const belowMin = currentSubtotal < (c.min_amount ?? 0)
                    const disabled = soldOut || c.already_used || belowMin
                    const active = appliedDiscount?.code === c.code
                    const chipLabel = active
                      ? t("public_code_using")
                      : c.already_used
                        ? t("public_code_used")
                        : soldOut
                          ? t("public_code_sold_out")
                          : belowMin
                            ? t("public_code_below_min")
                            : t("public_code_use")
                    return (
                      <button
                        key={c.code}
                        type="button"
                        disabled={disabled || discountChecking}
                        onClick={() => handlePublicCodeClick(c)}
                        className={`w-full flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition ${
                          active
                            ? "border-green-500/50 bg-green-500/[0.10] ring-1 ring-green-500/30"
                            : disabled
                              ? "border-white/5 bg-white/[0.02] opacity-45 cursor-not-allowed"
                              : "border-amber-500/30 bg-amber-500/[0.06] hover:bg-amber-500/[0.12] active:scale-[0.99]"
                        }`}
                      >
                        <div className="shrink-0 min-w-[56px] text-center">
                          <p className={`text-[16px] font-bold leading-none ${active ? "text-green-400" : disabled ? "text-text-muted" : "text-amber-400"}`}>
                            {c.type === "fixed" ? fmtMoney(c.value) : `${c.value}%`}
                          </p>
                          <p className="text-[9px] uppercase tracking-widest text-text-muted mt-1">
                            {t("public_code_off")}
                          </p>
                        </div>
                        <div className="self-stretch border-l border-dashed border-white/15" />
                        <div className="flex-1 min-w-0">
                          <p className="font-mono font-semibold text-[13px] text-text-base truncate">
                            {c.code}
                          </p>
                          <p className="text-[11px] text-text-muted mt-0.5 truncate">
                            {[
                              c.min_amount ? t("public_code_min", { min: fmtMoney(c.min_amount) }) : null,
                              c.remaining !== null ? t("public_code_left", { n: c.remaining }) : null,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                        </div>
                        <span
                          className={`shrink-0 text-[11px] px-2.5 py-1 rounded-lg font-medium ${
                            active
                              ? "bg-green-500/20 text-green-400"
                              : disabled
                                ? "bg-white/5 text-text-muted"
                                : "bg-amber-500/15 text-amber-400"
                          }`}
                        >
                          {discountChecking ? "..." : chipLabel}
                        </span>
                      </button>
                    )
                  })}

                  {hiddenCount > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowAllCodes((v) => !v)}
                      className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-[12px] text-text-muted hover:text-text-base hover:bg-white/[0.04] transition"
                    >
                      {showAllCodes
                        ? t("public_code_show_less")
                        : t("public_code_show_more", { n: hiddenCount })}
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className={`transition-transform ${showAllCodes ? "rotate-180" : ""}`}
                      >
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </button>
                  )}
                </div>
                )
              })()}
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
                className={`w-full py-4 rounded-xl font-bold text-base transition-all flex items-center justify-center gap-2.5 shadow-[0_4px_24px_rgba(37,99,235,0.3)] hover:shadow-[0_8px_32px_rgba(37,99,235,0.45)] hover:-translate-y-0.5 ${loading ? "opacity-60 cursor-not-allowed bg-accent text-white" : (isPremiumSelected ? "bg-yellow-500 text-black" : "bg-gradient-to-r from-accent to-accent-light text-white")}`}>
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
    ,
    document.body,
  )
}
