"use client"

import { useState, useMemo, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Image from "next/image"
import { useTranslations, useLocale } from "next-intl"
import { getImageUrl } from "@/lib/getImageUrl"
import { motion, AnimatePresence } from "framer-motion"

// ── Types ────────────────────────────────────────────────────────
type Gift = {
    id: number
    name: string
    image_url: string | null
    diamonds: number
}

type ProductFunction = {
    id: string
    name: string
    label_th: string | null
    label_en: string | null
    sort_order: number
    default_gift_id?: number | null
    image_url?: string | null
}

type Props = {
    orderId: string
    productName: string
    whitelistedUsername: string | null
    functions: ProductFunction[]
    gifts: Gift[]
    savedMapping: Record<string, number>
    savedTiktokUsername?: string | null
    locale: string
    isPremium: boolean
    premiumAddonPrice: number
}

export default function GameSettingsClient({
    orderId,
    productName,
    whitelistedUsername,
    functions,
    gifts,
    savedMapping,
    savedTiktokUsername,
    locale,
    isPremium,
    premiumAddonPrice,
}: Props) {
    const router = useRouter()
    const searchParams = useSearchParams()
    const t = useTranslations("Setting")
    const tModal = useTranslations("ProductModal")

    useEffect(() => {
        if (searchParams?.get("upgrade") === "success") {
            alert(t("upgradeSuccess") || "Upgrade Successful! You are now a Premium user.")
            window.history.replaceState({}, '', window.location.pathname)
        }
    }, [searchParams, t])

    const [showUpgradeModal, setShowUpgradeModal] = useState(false)
    const [paymentMethod, setPaymentMethod] = useState<"card" | "promptpay">("promptpay")
    const [upgrading, setUpgrading] = useState(false)


    // Use default mapping if not premium OR if premium but has no saved settings
    const effectiveMapping = useMemo(() => {
        // If not premium, always use defaults
        if (!isPremium) {
            const dm: Record<string, number> = {}
            functions.forEach(fn => {
                if (fn.default_gift_id) dm[fn.id] = fn.default_gift_id
            })
            return dm
        }

        // If premium but HAS saved mapping, use it
        if (Object.keys(savedMapping).length > 0) {
            return savedMapping
        }

        // If premium but NO saved mapping, fallback to defaults for preview
        const dm: Record<string, number> = {}
        functions.forEach(fn => {
            if (fn.default_gift_id) dm[fn.id] = fn.default_gift_id
        })
        return dm
    }, [isPremium, savedMapping, functions])

    const [mapping, setMapping] = useState<Record<string, number>>(effectiveMapping)
    const [tiktokUsername, setTiktokUsername] = useState(savedTiktokUsername ?? "")
    const [tiktokCookie, setTiktokCookie] = useState("") // New state for manual cookie
    const [saving, setSaving] = useState(false)
    const [trackingStatus, setTrackingStatus] = useState<string>("stopped")
    const [isToggling, setIsToggling] = useState(false)
    const [openPicker, setOpenPicker] = useState<string | null>(null)
    const [searchQuery, setSearchQuery] = useState("")

    // Update internal mapping state if effectiveMapping changes (e.g. after upgrade)
    useEffect(() => {
        setMapping(effectiveMapping)
    }, [effectiveMapping])

    // ... (Status Polling remains same)

    const handleToggleTracking = async () => {
        // ... (existing logic)
    }

    const selectGift = (functionId: string, giftId: number) => {
        if (!isPremium) return // Locked for non-premium
        setMapping((prev) => ({ ...prev, [functionId]: giftId }))
        setOpenPicker(null)
        setSearchQuery("")
    }

    const togglePicker = (functionId: string) => {
        if (!isPremium) return // Locked for non-premium
        if (openPicker === functionId) {
            setOpenPicker(null)
            setSearchQuery("")
        } else {
            setOpenPicker(functionId)
            setSearchQuery("")
        }
    }


    const clearGift = (functionId: string) => {
        if (!isPremium) return // Locked for non-premium
        setMapping((prev) => {
            const next = { ...prev }
            delete next[functionId]
            return next
        })
    }

    // ... (handleSave remains same)


    const handleUpgrade = async () => {
        try {
            setUpgrading(true)
            const res = await fetch(`/api/orders/${orderId}/upgrade`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ paymentMethod, locale })
            })
            const data = await res.json()
            if (data.url) window.location.href = data.url
            else alert(data.error || "Upgrade failed")
        } catch (error) {
            alert("Connection error")
        } finally {
            setUpgrading(false)
        }
    }

    const handleSave = async () => {
        try {
            setSaving(true)
            const res = await fetch(`/api/orders/${orderId}/settings`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    mapping,
                    tiktok_username: tiktokUsername.trim() || null,
                }),
            })
            if (!res.ok) throw new Error()
            router.refresh()
            alert(t("saveSuccess") || "Saved successfully")
        } catch (error) {
            alert(t("saveFailed"))
        } finally {
            setSaving(false)
        }
    }


    const getGift = (giftId: number) => gifts.find((g) => g.id === giftId)

    const filteredGifts = useMemo(() => {
        const query = searchQuery.toLowerCase().trim()
        if (!query) return gifts
        return gifts.filter((gift) =>
            gift.name.toLowerCase().includes(query) ||
            String(gift.id).includes(query)
        )
    }, [gifts, searchQuery])

    return (
        <div className="min-h-screen bg-bg-base">
            <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">

                {/* Back & Title */}
                <div>
                    <button
                        onClick={() => router.back()}
                        className="text-[12px] text-text-muted hover:text-text-base mb-3 flex items-center gap-1 transition"
                    >
                        ← {t("back")}
                    </button>
                    <h1 className="text-[22px] font-bold">{t("title")}</h1>
                    <p className="text-[13px] text-text-muted mt-1">{t("subtitle")}</p>
                </div>

                {/* Game Info Card */}
                <div className="bg-bg-card border border-accent/15 rounded-2xl p-5 flex flex-col gap-4">
                    <div className="flex items-center gap-4">
                        <div className="flex-1">
                            <p className="text-[11px] text-text-muted uppercase tracking-widest mb-1">{t("game")}</p>
                            <p className="text-[16px] font-bold text-text-base">{productName}</p>
                        </div>
                        <div className="w-px h-10 bg-accent/10" />
                        <div className="flex-1">
                            <p className="text-[11px] text-text-muted uppercase tracking-widest mb-1">{t("whitelist_label") || "Whitelist"}</p>
                            <p className="font-mono text-[16px] font-bold text-accent-light">
                                {whitelistedUsername ?? "—"}
                            </p>
                        </div>
                    </div>

                    {!isPremium && (
                        <div className="bg-accent/10 border border-accent/20 rounded-xl p-3 flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2.5 text-accent-light">
                                {/* <span className="text-[18px]">⭐</span> */}
                                <div>
                                    <p className="text-[13px] font-bold leading-tight">{t("upgradePremium")}</p>
                                    <p className="text-[11px] opacity-80">{t("upgradeUnlock")}</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowUpgradeModal(true)}
                                className="bg-accent text-white text-[11px] font-bold px-3 py-1.5 rounded-lg hover:opacity-90 transition"
                            >
                                {t("buyPremium")}
                            </button>
                        </div>
                    )}
                </div>

                {/* TikTok Username */}
                <div className="bg-bg-card border border-accent/10 rounded-2xl p-5 space-y-3">


                    <div className="flex items-center gap-2">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="text-accent-light flex-shrink-0">
                            <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.78 1.52V6.76a4.85 4.85 0 0 1-1.01-.07z" />
                        </svg>
                        <p className="text-[13px] font-semibold">{t("tiktok_username_label")}</p>
                    </div>
                    <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-[13px]">@</span>
                        <input
                            value={tiktokUsername}
                            onChange={(e) => setTiktokUsername(e.target.value.replace("@", ""))}
                            placeholder={t("tiktok_username_placeholder")}
                            className="w-full bg-bg-base border border-accent/15 rounded-xl pl-7 pr-4 py-2.5 text-[13px] placeholder:text-text-muted outline-none focus:border-accent/40 transition"
                        />
                    </div>

                    {/* Advanced Settings Disclosure */}
                    {/* <div className="border-t border-accent/5 pt-4">
                        <details className="group">
                            <summary className="flex items-center gap-2 text-[12px] font-medium text-text-muted cursor-pointer hover:text-text-base transition-colors list-none">
                                <ChevronIcon size={14} className="group-open:rotate-180" />
                                <span>{t("advancedSettings")}</span>
                            </summary>
                            <div className="mt-3 space-y-3 pl-5 border-l-2 border-accent/10">
                                <div className="space-y-1.5">
                                    <p className="text-[11px] font-semibold text-text-base flex items-center gap-2">
                                        <span>Connection Token (ttwid)</span>
                                    </p>
                                    <p className="text-[10px] text-text-muted leading-relaxed">
                                        {t("ttwid_help_desc")}
                                    </p>
                                    <input
                                        value={tiktokCookie}
                                        onChange={(e) => setTiktokCookie(e.target.value)}
                                        placeholder={t("ttwid_placeholder")}
                                        className="w-full bg-bg-base border border-accent/10 rounded-xl px-4 py-2.5 text-[12px] placeholder:text-text-muted outline-none focus:border-accent/30 transition"
                                    />
                                    <a 
                                        href="#" 
                                        className="text-[10px] text-accent-light hover:underline inline-block"
                                        onClick={(e) => {
                                            e.preventDefault();
                                            alert(t("how_to_get_ttwid_steps"));
                                        }}
                                    >
                                        {t("howToGetToken")}
                                    </a>
                                </div>
                            </div>
                        </details>
                    </div> */}

                    {/* Tracking Controls */}
                    {/* <div className="flex items-center justify-between gap-3 pt-2">
                        <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full animate-pulse ${
                                trackingStatus === "running" ? "bg-green-500" : 
                                trackingStatus === "connecting" ? "bg-yellow-500" : "bg-red-500"
                            }`} />
                            <span className="text-[12px] font-medium capitalize text-text-muted">
                                {trackingStatus}
                            </span>
                        </div>
                        <button
                            onClick={handleToggleTracking}
                            disabled={isToggling}
                            className={`px-6 py-2 rounded-xl text-[13px] font-bold transition flex items-center gap-2 ${
                                trackingStatus === "stopped" || trackingStatus === "error"
                                ? "bg-accent text-white hover:opacity-90"
                                : "bg-red-500/10 text-red-500 hover:bg-red-500/20"
                            }`}
                        >
                            {isToggling ? (
                                <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                            ) : (
                                trackingStatus === "stopped" || trackingStatus === "error" ? "Start Tracking" : "Stop Tracking"
                            )}
                        </button>
                    </div> */}

                    <p className="text-[11px] text-text-muted">{t("tiktok_username_hint")}</p>
                    <br />
                    <div className="space-y-3">

                        {/* Label (style เดียวกับ TikTok header) */}
                        <div className="flex items-center gap-2">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-accent-light flex-shrink-0">
                                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                            </svg>
                            <p className="text-[13px] font-semibold">{t("program_key") || "Program Key"}</p>
                        </div>

                        {/* Input style = TikTok username style */}
                        <div className="flex items-center gap-2">
                            <div className="relative w-full">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-[13px]">
                                    #
                                </span>

                                <input
                                    value={orderId}
                                    readOnly
                                    className="w-full bg-bg-base border border-accent/15 rounded-xl pl-7 pr-4 py-2.5 text-[13px] text-accent-light outline-none focus:border-accent/40 transition"
                                />
                            </div>

                            <button
                                onClick={() => {
                                    navigator.clipboard.writeText(orderId)
                                    alert(t("copied") || "Copied")
                                }}
                                className="px-3 py-2 rounded-xl bg-accent/10 hover:bg-accent/20 text-[11px] text-accent-light transition"
                            >
                                {t("copy") || "Copy"}
                            </button>
                        </div>

                        {/* Hint (เหมือน TikTok hint style) */}
                        <p className="text-[11px] text-text-muted">
                            {t("key_label")}
                        </p>
                    </div>
                </div>




                {/* Function List */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between px-1">
                        <p className="text-[11px] text-text-muted uppercase tracking-widest font-medium">
                            {t("selectGiftForFunction")}
                        </p>
                        {isPremium && Object.keys(mapping).length > 0 && (
                            <button 
                                onClick={() => {
                                    if(confirm(t("confirm_clear_all") || "Clear all selected gifts?")) {
                                        setMapping({})
                                    }
                                }}
                                className="text-[11px] text-red-400 hover:text-red-500 font-medium transition"
                            >
                                {t("clear_all") || "Clear All"}
                            </button>
                        )}
                    </div>

                    {functions.length === 0 ? (
                        <div className="text-center py-12 bg-bg-card border border-accent/10 rounded-2xl text-text-muted text-[13px]">
                            {t("noFunctions")}
                        </div>
                    ) : (
                        functions.map((fn) => {
                            const selectedGiftId = mapping[fn.id]
                            const selectedGift = selectedGiftId ? getGift(selectedGiftId) : null
                            const isOpen = openPicker === fn.id

                            return (
                                <div key={fn.id} className="bg-bg-card border border-accent/10 rounded-2xl overflow-hidden transition-all">
                                    {/* Main Row */}
                                    <div className="flex items-center gap-3 p-4">
                                        <div className="flex-1 flex flex-wrap items-center gap-3">
                                            {fn.image_url && (
                                                <div className="w-8 h-8 rounded-lg overflow-hidden border border-white/5 bg-bg-base flex-shrink-0">
                                                    <Image
                                                        src={getImageUrl(fn.image_url)}
                                                        alt=""
                                                        width={32}
                                                        height={32}
                                                        className="w-full h-full object-cover"
                                                        unoptimized
                                                    />
                                                </div>
                                            )}
                                            <div className="flex flex-col gap-0.5">
                                                <span className="text-[13px] font-bold text-text-base">
                                                    {locale === "th" ? fn.label_th : fn.label_en}
                                                </span>
                                                <span className="font-mono text-[10px] text-accent-light/70 tracking-wider uppercase">
                                                    {fn.name}
                                                </span>
                                            </div>
                                        </div>

                                        <button
                                            onClick={() => togglePicker(fn.id)}
                                            disabled={!isPremium}
                                            className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition min-w-[150px] justify-between ${selectedGift
                                                ? "border-accent/40 bg-accent/5 text-accent-light"
                                                : "border-white/10 bg-bg-base text-text-muted"
                                                } ${!isPremium ? "cursor-default opacity-80" : ""}`}
                                        >
                                            <div className="flex items-center gap-2 overflow-hidden">
                                                {!isPremium && !selectedGift && (
                                                    <span className="text-[11px] font-bold bg-white/5 px-1.5 py-0.5 rounded text-text-muted">LOCKED</span>
                                                )}
                                                {selectedGift ? (
                                                    <>
                                                        {selectedGift.image_url ? (
                                                            <Image
                                                                src={getImageUrl(selectedGift.image_url)}
                                                                alt=""
                                                                width={18}
                                                                height={18}
                                                                className="rounded object-cover"
                                                                unoptimized
                                                            />
                                                        ) : (
                                                            <span>🎁</span>
                                                        )}
                                                        <span className="text-[13px] font-medium truncate">
                                                            {selectedGift.name}
                                                        </span>
                                                        {(!isPremium || (Object.keys(savedMapping).length === 0 && selectedGiftId === fn.default_gift_id)) && (
                                                            <span className="text-[10px] bg-accent/10 px-1 rounded">DEFAULT</span>
                                                        )}
                                                        </>

                                                ) : (
                                                    <span className="text-[13px]">{t("selectGift")}</span>
                                                )}
                                            </div>
                                            {isPremium && <ChevronIcon size={14} className={isOpen ? "rotate-180" : ""} />}
                                        </button>

                                        {selectedGift && isPremium && (
                                            <button
                                                onClick={() => clearGift(fn.id)}
                                                className="text-text-muted hover:text-red-400 p-1 transition"
                                            >
                                                <CloseIcon size={18} />
                                            </button>
                                        )}
                                    </div>

                                    {/* Dropdown Picker */}
                                    {isOpen && (
                                        <div className="border-t border-accent/10 bg-bg-base/40 p-3 space-y-3">
                                            {/* Search Box */}
                                            <div className="relative">
                                                <input
                                                    autoFocus
                                                    type="text"
                                                    value={searchQuery}
                                                    onChange={(e) => setSearchQuery(e.target.value)}
                                                    placeholder={t("searchPlaceholder")}
                                                    className="w-full bg-bg-card border border-accent/20 rounded-xl pl-9 pr-4 py-2 text-[13px] outline-none focus:border-accent/50 transition"
                                                />
                                                <SearchIcon className="absolute left-3 top-2.5 text-text-muted" size={16} />
                                            </div>

                                            {/* Gifts Grid */}
                                            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-[260px] overflow-y-auto pr-1">
                                                {filteredGifts.map((gift) => (
                                                    <button
                                                        key={gift.id}
                                                        onClick={() => selectGift(fn.id, gift.id)}
                                                        className={`flex flex-col items-center gap-1.5 p-2 rounded-xl border transition ${selectedGiftId === gift.id
                                                            ? "border-accent bg-accent/10"
                                                            : "border-white/5 bg-bg-card hover:border-accent/30"
                                                            }`}
                                                    >
                                                        <div className="w-8 h-8 flex items-center justify-center">
                                                            {gift.image_url ? (
                                                                <Image
                                                                    src={getImageUrl(gift.image_url)}
                                                                    alt=""
                                                                    width={32}
                                                                    height={32}
                                                                    className="rounded object-cover"
                                                                    unoptimized
                                                                />
                                                            ) : (
                                                                <span className="text-[20px]">🎁</span>
                                                            )}
                                                        </div>
                                                        <div className="text-center">
                                                            <p className="text-[11px] font-medium leading-tight line-clamp-1">
                                                                {gift.name}
                                                            </p>
                                                            <p className="text-[10px] text-text-muted">
                                                                💎 {gift.diamonds}
                                                            </p>
                                                        </div>
                                                    </button>
                                                ))}
                                                {filteredGifts.length === 0 && (
                                                    <div className="col-span-full py-8 text-center text-text-muted text-[12px]">
                                                        {t("noResults")}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )
                        })
                    )}
                </div>

                {/* Save Button */}
                {functions.length > 0 && (
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="w-full py-3.5 rounded-2xl font-bold text-[15px] bg-accent hover:opacity-90 text-white transition flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        {saving && (
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        )}
                        {saving ? t("saving") : t("save")}
                    </button>
                )}
            </div>

            {/* Upgrade Modal */}
            <AnimatePresence>
                {showUpgradeModal && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            onClick={() => setShowUpgradeModal(false)}
                            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            className="relative w-full max-w-md bg-bg-card border border-accent/20 rounded-3xl overflow-hidden shadow-2xl"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="p-6 space-y-6">
                                <div className="flex items-center justify-between">
                                    <h2 className="text-[18px] font-bold text-text-base">{t("upgradePremium")}</h2>
                                    <button onClick={() => setShowUpgradeModal(false)} className="text-text-muted hover:text-text-base transition">
                                        <CloseIcon size={20} />
                                    </button>
                                </div>

                                <div className="bg-accent/5 border border-accent/10 rounded-2xl p-4 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        {/* <div className="w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center text-yellow-500">
                                            <span className="text-[20px]">⭐</span>
                                        </div> */}
                                        <div>
                                            <p className="text-[14px] font-bold">{t("premiumLifetime")}</p>
                                            <p className="text-[11px] text-text-muted">{t("premiumLifetimeDesc")}</p>
                                        </div>
                                    </div>
                                    <p className="text-[18px] font-bold text-accent-light">฿{premiumAddonPrice.toLocaleString()}</p>
                                </div>

                                {/* Payment Methods */}
                                <div className="space-y-2">
                                    <p className="text-[11px] tracking-widest text-text-muted uppercase font-medium">{tModal("payment_method")}</p>
                                    <div className="grid grid-cols-2 gap-2">
                                        <button onClick={() => setPaymentMethod("promptpay")} className={`p-3 rounded-xl border text-left transition ${paymentMethod === "promptpay" ? "border-accent bg-accent/10 text-accent-light" : "border-white/10"}`}>
                                            <p className="text-[13px] font-medium">{tModal("promptpay_label")}</p>
                                            <p className="text-[10px] text-green-400 opacity-80">{tModal("promptpay_desc")}</p>
                                        </button>
                                        <button onClick={() => setPaymentMethod("card")} className={`p-3 rounded-xl border text-left transition ${paymentMethod === "card" ? "border-accent bg-accent/10 text-accent-light" : "border-white/10"}`}>
                                            <p className="text-[13px] font-medium">{tModal("stripe_label")}</p>
                                            <p className="text-[10px] text-orange-400 opacity-80">{tModal("stripe_desc")}</p>
                                        </button>
                                    </div>
                                </div>

                                <button
                                    disabled={upgrading}
                                    onClick={handleUpgrade}
                                    className="w-full py-4 bg-accent hover:opacity-90 text-white font-bold rounded-2xl transition shadow-lg shadow-accent/20 flex items-center justify-center gap-2 disabled:opacity-50"
                                >
                                    {upgrading ? (
                                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    ) : (
                                        <>{t("proceedToCheckout")} (฿{(paymentMethod === "card" ? premiumAddonPrice * 1.06 : premiumAddonPrice).toLocaleString()})</>
                                    )}
                                </button>

                                <p className="text-[10px] text-center text-text-muted px-4">
                                    {t("upgradeNote")}
                                </p>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    )
}

// ── Icons ────────────────────────────────────────────────────────

function ChevronIcon({ size = 16, className = "" }: { size?: number; className?: string }) {
    return (
        <svg
            width={size} height={size} viewBox="0 0 24 24"
            fill="none" stroke="currentColor" strokeWidth="2.5"
            strokeLinecap="round" strokeLinejoin="round"
            className={`transition-transform duration-200 ${className}`}
        >
            <polyline points="6 9 12 15 18 9" />
        </svg>
    )
}

function SearchIcon({ size = 16, className = "" }: { size?: number; className?: string }) {
    return (
        <svg
            width={size} height={size} viewBox="0 0 24 24"
            fill="none" stroke="currentColor" strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round"
            className={className}
        >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
    )
}

function CloseIcon({ size = 16 }: { size?: number }) {
    return (
        <svg
            width={size} height={size} viewBox="0 0 24 24"
            fill="none" stroke="currentColor" strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round"
        >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
    )
}