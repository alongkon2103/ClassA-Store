"use client"

import { useState, useMemo, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Image from "next/image"
import { useTranslations, useLocale } from "next-intl"
import { getImageUrl } from "@/lib/getImageUrl"
import { motion, AnimatePresence } from "framer-motion"

type Gift = {
    id: number
    name: string
    image_url: string | null
    diamonds: number
    trigger_type: string | null
}

type ProductFunction = {
    id: string
    name: string
    label_th: string | null
    label_en: string | null
    sort_order: number
    default_gift_id?: number | null
    default_trigger_threshold?: number | null
    image_url?: string | null
}

// One row in the user's gift pool for an order. Multiple rows can exist for
// the same function_id — active rows trigger, standby rows wait to be swapped.
type UserFunctionGift = {
    id: string // real DB uuid, or "tmp_…" for unsaved rows added locally
    function_id: string
    gift_id: number
    is_enabled: boolean
    trigger_threshold: number | null
    gifts: Gift
}

const newTempId = () =>
    `tmp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`

type Props = {
    orderId: string
    orderType?: string | null
    expiresAt?: string | null
    productName: string
    productSlug?: string | null
    whitelistedUsername: string | null
    functions: ProductFunction[]
    gifts: Gift[]
    savedMappings: UserFunctionGift[]
    savedTiktokUsername?: string | null
    locale: string
    isPremium: boolean
    premiumAddonPrice: number
    tutorialVideoUrl?: string | null
    downloadUrl?: string | null
}

export default function GameSettingsClient({
    orderId, orderType, expiresAt, productName, productSlug, whitelistedUsername, functions, gifts,
    savedMappings, savedTiktokUsername, locale, isPremium, premiumAddonPrice, tutorialVideoUrl,
    downloadUrl,
}: Props) {
    const router = useRouter()
    const searchParams = useSearchParams()
    const t = useTranslations("Setting")
    const tModal = useTranslations("ProductModal")
    const tD = useTranslations("DownloadModal") // 

    const [timeLeft, setTimeLeft] = useState<number | null>(null)
    const [isExpired, setIsExpired] = useState(false)

    const getYoutubeEmbedUrl = (url: string | null | undefined) => {
        if (!url) return null
        let videoId = ""
        if (url.includes("youtube.com/watch?v=")) videoId = url.split("v=")[1].split("&")[0]
        else if (url.includes("youtu.be/")) videoId = url.split("youtu.be/")[1].split("?")[0]
        else if (url.includes("youtube.com/embed/")) videoId = url.split("embed/")[1].split("?")[0]
        return videoId ? `https://www.youtube.com/embed/${videoId}` : null
    }

    const tutorialEmbedUrl = getYoutubeEmbedUrl(tutorialVideoUrl)

    useEffect(() => {
        if (orderType === "TRIAL" && expiresAt) {
            const expiry = new Date(expiresAt).getTime()
            const updateTimer = () => {
                const now = new Date().getTime()
                const diff = Math.max(0, Math.floor((expiry - now) / 1000))
                setTimeLeft(diff)
                if (diff <= 0) {
                    setIsExpired(true)
                }
            }
            updateTimer()
            const interval = setInterval(updateTimer, 1000)
            return () => clearInterval(interval)
        }
    }, [orderType, expiresAt])

    useEffect(() => {
        // Initial expiration check
        if (orderType === "TRIAL" && expiresAt) {
            if (new Date() > new Date(expiresAt)) {
                setIsExpired(true)
            }
        }
    }, [orderType, expiresAt])

    const formatTime = (seconds: number) => {
        const days = Math.floor(seconds / (24 * 3600))
        const hours = Math.floor((seconds % (24 * 3600)) / 3600)
        const minutes = Math.floor((seconds % 3600) / 60)
        const secs = seconds % 60

        if (days > 0) {
            return `${days}d ${hours}h ${minutes}m`
        }
        if (hours > 0) {
            return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
        }
        return `${minutes}:${secs.toString().padStart(2, "0")}`
    }

    useEffect(() => {
        if (searchParams?.get("upgrade") === "success") {
            alert(t("upgradeSuccess") || "Upgrade Successful!")
            window.history.replaceState({}, '', window.location.pathname)
        }
    }, [searchParams, t])

    const [showUpgradeModal, setShowUpgradeModal] = useState(false)
    const [showDownloadModal, setShowDownloadModal] = useState(false)
    const [paymentMethod, setPaymentMethod] = useState<"card" | "promptpay">("promptpay")
    const [upgrading, setUpgrading] = useState(false)
    const [showKey, setShowKey] = useState(false)
    const [copied, setCopied] = useState(false)
    const [saving, setSaving] = useState(false)
    // openPicker holds the row we're editing OR { mappingId: null } when adding
    // a brand-new row to a function's pool.
    const [openPicker, setOpenPicker] = useState<{ functionId: string; mappingId: string | null } | null>(null)
    const [searchQuery, setSearchQuery] = useState("")
    const [tiktokUsername, setTiktokUsername] = useState(savedTiktokUsername ?? "")

    // Build a default pool from product_functions.default_gift_id — used when
    // the user has no saved settings yet, or hits "Reset to default".
    const getDefaultMappings = (): UserFunctionGift[] => {
        const rows: UserFunctionGift[] = []
        functions.forEach(fn => {
            if (!fn.default_gift_id) return
            const gift = gifts.find(g => g.id === fn.default_gift_id)
            if (!gift) return
            rows.push({
                id: newTempId(),
                function_id: fn.id,
                gift_id: gift.id,
                is_enabled: true,
                trigger_threshold: fn.default_trigger_threshold ?? (gift.trigger_type === "like" ? 1 : null),
                gifts: gift,
            })
        })
        return rows
    }

    const [mappings, setMappings] = useState<UserFunctionGift[]>(() => {
        if (!isPremium) return getDefaultMappings()
        if (savedMappings.length > 0) return savedMappings
        return getDefaultMappings()
    })

    const handleCopy = () => {
        navigator.clipboard.writeText(orderId)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    // Picker selected a gift — either replace the gift on an existing row OR
    // push a brand-new row to this function's pool. Like-type gifts are limited
    // to one per function: the old like row is silently dropped if a new one is
    // picked in the same function.
    const handleUpdateGift = (functionId: string, mappingId: string | null, gift: Gift) => {
        if (!isPremium) return
        setMappings(prev => {
            let next = [...prev]

            if (gift.trigger_type === "like") {
                next = next.filter(m => {
                    const isThisRow = m.id === mappingId
                    if (
                        !isThisRow &&
                        m.function_id === functionId &&
                        m.gifts?.trigger_type === "like"
                    ) {
                        return false // drop the previous like row in this function
                    }
                    return true
                })
            }

            if (mappingId === null) {
                next.push({
                    id: newTempId(),
                    function_id: functionId,
                    gift_id: gift.id,
                    is_enabled: true,
                    trigger_threshold: gift.trigger_type === "like" ? 1 : null,
                    gifts: gift,
                })
            } else {
                next = next.map(m =>
                    m.id === mappingId
                        ? {
                            ...m,
                            gift_id: gift.id,
                            gifts: gift,
                            trigger_threshold:
                                gift.trigger_type === "like"
                                    ? (m.trigger_threshold ?? 1)
                                    : null,
                        }
                        : m,
                )
            }

            return next
        })
        setOpenPicker(null)
        setSearchQuery("")
    }

    const handleAddMapping = (functionId: string) => {
        if (!isPremium) return
        setOpenPicker({ functionId, mappingId: null })
        setSearchQuery("")
    }

    const handleRemoveMapping = (mappingId: string) => {
        if (!isPremium) return
        if (!confirm(t("confirm_remove_mapping"))) return
        setMappings(prev => prev.filter(m => m.id !== mappingId))
    }

    // Independent per-row toggle: any number of rows can be active inside one
    // function. Every active row triggers its function when its gift arrives.
    const handleSetActive = (mappingId: string) => {
        if (!isPremium) return
        setMappings(prev =>
            prev.map(m => (m.id === mappingId ? { ...m, is_enabled: !m.is_enabled } : m)),
        )
    }

    const handleUpdateThreshold = (mappingId: string, threshold: number) => {
        if (!isPremium) return
        setMappings(prev =>
            prev.map(m => (m.id === mappingId ? { ...m, trigger_threshold: threshold } : m)),
        )
    }

    const togglePicker = (functionId: string, mappingId: string | null) => {
        if (!isPremium) return
        if (
            openPicker?.functionId === functionId &&
            openPicker?.mappingId === mappingId
        ) {
            setOpenPicker(null)
        } else {
            setOpenPicker({ functionId, mappingId })
        }
        setSearchQuery("")
    }

    const handleClearAll = () => {
        if (confirm(t("confirm_clear_all") || "Clear all and reset to default?")) {
            setMappings(getDefaultMappings())
        }
    }
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
        } catch (e) { alert("Connection error") }
        finally { setUpgrading(false) }
    }

    // const handleSave = async () => {
    //     try {
    //         setSaving(true)
    //         const res = await fetch(`/api/orders/${orderId}/settings`, {
    //             method: "POST",
    //             headers: { "Content-Type": "application/json" },
    //             body: JSON.stringify({ mapping, tiktok_username: tiktokUsername.trim() || null }),
    //         })
    //         if (!res.ok) throw new Error()
    //         router.refresh()
    //         alert(t("saveSuccess") || "Saved successfully")
    //     } catch (e) { alert(t("saveFailed")) }
    //     finally { setSaving(false) }
    // }
    // GameSettingsClient.tsx - handleSave
    const handleSave = async () => {
        try {
            setSaving(true)
            const res = await fetch(`/api/orders/${orderId}/settings`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    mappings: mappings.map(m => ({
                        functionId: m.function_id,
                        giftId: m.gift_id,
                        isEnabled: m.is_enabled,
                        triggerThreshold: m.trigger_threshold,
                    })),
                    tiktok_username: tiktokUsername.trim() || null,
                }),
            })

            // ← ดู response body ก่อน throw เพื่อให้รู้ว่า error อะไร
            const data = await res.json()

            if (!res.ok) {
                console.error("Save failed:", data)
                alert(`${t("saveFailed")}: ${data.error || res.status}`)
                return
            }

            router.refresh()
            alert(t("saveSuccess") || "Saved successfully")
        } catch (e) {
            console.error("Save error:", e)
            alert(t("saveFailed"))
        } finally {
            setSaving(false)
        }
    }
    const filteredGifts = useMemo(() => {
        const q = searchQuery.toLowerCase().trim()
        if (!q) return gifts
        return gifts.filter(g => g.name.toLowerCase().includes(q) || String(g.id).includes(q))
    }, [gifts, searchQuery])

    const maskedKey = "*".repeat(orderId.length)

    if (isExpired) {
        return (
            <div className="py-20 flex items-center justify-center">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="max-w-md w-full bg-bg-card border border-red-500/20 rounded-[32px] p-8 text-center space-y-6 shadow-2xl shadow-red-500/5"
                >
                    <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto border border-red-500/20">
                        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-red-500">
                            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                        </svg>
                    </div>
                    <div className="space-y-2">
                        <h2 className="text-[24px] font-black text-white">{t("trial_expired_title")}</h2>
                        <p className="text-[14px] text-text-muted leading-relaxed">
                            {t("trial_expired_desc")}
                        </p>
                    </div>
                    <div className="pt-4 space-y-3">
                        <button
                            onClick={() => router.push(`/products?slug=${productSlug}`)}
                            className="w-full py-4 bg-accent hover:opacity-90 text-white font-black text-[15px] rounded-2xl transition-all shadow-xl shadow-accent/20 flex items-center justify-center gap-2 active:scale-[0.98]"
                        >                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" /><path d="M3 6h18" /><path d="M16 10a4 4 0 0 1-8 0" />
                            </svg>
                            {t("order_to_continue")}
                        </button>
                        <button
                            onClick={() => router.push('/')}
                            className="w-full py-4 bg-white/5 hover:bg-white/10 text-text-muted font-bold text-[14px] rounded-2xl transition-all"
                        >
                            {t("back_to_home")}
                        </button>
                    </div>                </motion.div>

                {/* Modals need to be here too */}
                <AnimatePresence>
                    {showUpgradeModal && (
                        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowUpgradeModal(false)} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
                            <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }}
                                className="relative w-full max-w-md bg-bg-card border border-accent/20 rounded-3xl overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
                                <div className="p-6 space-y-5">
                                    <div className="flex items-center justify-between">
                                        <h2 className="text-[18px] font-bold">{t("upgradePremium")}</h2>
                                        <button onClick={() => setShowUpgradeModal(false)} className="text-text-muted hover:text-text-base transition"><CloseIcon size={20} /></button>
                                    </div>
                                    <div className="bg-accent/5 border border-accent/10 rounded-2xl p-4 flex items-center justify-between">
                                        <div>
                                            <p className="text-[14px] font-bold">{t("premiumLifetime")}</p>
                                            <p className="text-[11px] text-text-muted">{t("premiumLifetimeDesc")}</p>
                                        </div>
                                        <p className="text-[18px] font-bold text-accent-light">{premiumAddonPrice.toLocaleString()}</p>
                                    </div>
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
                                    <button disabled={upgrading} onClick={handleUpgrade} className="w-full py-4 bg-accent hover:opacity-90 text-white font-bold rounded-2xl transition shadow-lg shadow-accent/20 flex items-center justify-center gap-2 disabled:opacity-50">
                                        {upgrading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <>{t("proceedToCheckout")} ({(paymentMethod === "card" ? premiumAddonPrice * 1.06 : premiumAddonPrice).toLocaleString()})</>}
                                    </button>
                                </div>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-bg-base text-text-base">
            <div className="max-w-6xl mx-auto px-4 py-8">

                {/* Trial Banner */}
                {orderType === "TRIAL" && (
                    <div className="mb-6 bg-yellow-500/10 border border-yellow-500/20 rounded-2xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-full bg-yellow-500/20 flex items-center justify-center animate-pulse shrink-0">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-yellow-500">
                                    <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                                </svg>
                            </div>
                            <div>
                                <h3 className="text-[15px] font-bold text-yellow-500">
                                    {locale === "th" ? "[ Trial Mode Active ]" : "[ Trial Mode Active ]"}
                                </h3>
                                <p className="text-[13px] text-text-muted mt-0.5">
                                    {locale === "th"
                                        ? "คุณกำลังใช้งานสิทธิ์ Whitelist ทดลองใช้ฟรี ระบบจะหยุดทำงานอัตโนมัติเมื่อหมดเวลา"
                                        : "You are using a free trial whitelist. The system will stop automatically when time expires."}
                                </p>
                            </div>
                        </div>
                        {timeLeft !== null && (
                            <div className="flex flex-col items-center sm:items-end gap-1 px-6 py-2 bg-yellow-500/5 rounded-2xl border border-yellow-500/10 min-w-[120px]">
                                <p className="text-[10px] text-yellow-500/70 font-bold uppercase tracking-widest">
                                    {locale === "th" ? "เวลาที่เหลือ" : "TIME REMAINING"}
                                </p>
                                <span className={`font-mono text-[24px] font-black ${timeLeft < 60 ? "text-red-500 animate-pulse" : "text-yellow-500"}`}>
                                    {formatTime(timeLeft)}
                                </span>
                            </div>
                        )}
                    </div>
                )}

                {/*  Header  */}
                <div className="mb-6">
                    <button onClick={() => router.back()} className="text-[12px] text-text-muted hover:text-text-base mb-3 flex items-center gap-1 transition">
                        {t("back")}
                    </button>
                    <div className="flex items-center justify-between flex-wrap gap-3">
                        <div>
                            <h1 className="text-[22px] font-bold">{t("title")}</h1>
                            <p className="text-[13px] text-text-muted mt-0.5">{t("subtitle")}</p>
                        </div>
                        {isPremium && (
                            <span
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-accent/25 bg-accent/10 text-[11px] font-semibold uppercase tracking-[0.08em] text-accent-light whitespace-nowrap">
                                <span className="w-1.5 h-1.5 rounded-full bg-accent-light shrink-0" />
                                Premium
                            </span>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-5">

                    {/*  LEFT COLUMN  */}
                    <div className="space-y-4">
                        {/* Game Info */}
                        <div className="bg-bg-card border border-accent/15 rounded-2xl p-4 space-y-3">
                            <p className="text-[10px] text-text-muted uppercase tracking-widest font-medium">{t("game")}</p>
                            <p className="text-[16px] font-bold text-text-base">{productName}</p>
                            <div className="border-t border-accent/8 pt-3">
                                <p className="text-[10px] text-text-muted uppercase tracking-widest mb-1">{t("whitelist_label") || "Whitelist"}</p>
                                <p className="font-mono text-[15px] font-bold text-accent-light">{whitelistedUsername ?? ""}</p>
                            </div>
                            {!isPremium && (
                                <div className="bg-accent/8 border border-accent/20 rounded-xl p-3 flex items-center justify-between gap-2">
                                    <div className="min-w-0">
                                        <p className="text-[12px] font-bold text-accent-light leading-tight line-clamp-1">{t("upgradePremium")}</p>
                                        <p className="text-[10px] text-text-muted mt-0.5 line-clamp-1">{t("upgradeUnlock")}</p>
                                    </div>
                                    <button onClick={() => setShowUpgradeModal(true)} className="bg-accent text-white text-[10px] font-bold px-2.5 py-1.5 rounded-lg hover:opacity-90 transition flex-shrink-0">
                                        {t("buyPremium")}
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* TikTok + Key */}
                        <div className="bg-bg-card border border-accent/10 rounded-2xl p-4 space-y-4">
                            <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" className="text-accent-light flex-shrink-0">
                                        <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.78 1.52V6.76a4.85 4.85 0 0 1-1.01-.07z" />
                                    </svg>
                                    <p className="text-[12px] font-semibold">{t("tiktok_username_label")}</p>
                                </div>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-[13px]">@</span>
                                    <input
                                        disabled={!isPremium}
                                        value={tiktokUsername}
                                        onChange={e => setTiktokUsername(e.target.value.replace("@", ""))}
                                        placeholder={t("tiktok_username_placeholder")}
                                        className="w-full bg-bg-base border border-accent/15 rounded-xl pl-7 pr-4 py-2 text-[13px] placeholder:text-text-muted outline-none focus:border-accent/40 transition disabled:opacity-50 disabled:cursor-not-allowed"
                                    />
                                </div>
                                <p className="text-[10px] text-text-muted">{t("tiktok_username_hint")}</p>
                            </div>

                            <div className="border-t border-accent/5" />

                            <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-accent-light flex-shrink-0">
                                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
                                    </svg>
                                    <p className="text-[12px] font-semibold">{t("program_key") || "Program Key"}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="relative flex-1">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-[12px]">#</span>
                                        <input
                                            value={showKey ? orderId : maskedKey}
                                            readOnly
                                            className="w-full bg-bg-base border border-accent/15 rounded-xl pl-6 pr-9 py-2 text-[12px] text-accent-light outline-none font-mono tracking-wider"
                                        />
                                        <button
                                            disabled={!isPremium}
                                            onClick={() => setShowKey(v => !v)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-base transition disabled:opacity-30 disabled:cursor-not-allowed"
                                        >
                                            {showKey ? (
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" /><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" /><line x1="1" y1="1" x2="23" y2="23" />
                                                </svg>
                                            ) : (
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
                                                </svg>
                                            )}
                                        </button>
                                    </div>
                                    <button
                                        disabled={!isPremium}
                                        onClick={handleCopy}
                                        className={`flex items-center gap-1 px-3 py-2 rounded-xl text-[11px] font-bold transition flex-shrink-0 ${copied ? "bg-green-500/15 text-green-400 border border-green-500/20" : "bg-accent/10 hover:bg-accent/20 text-accent-light border border-accent/15"} disabled:opacity-50 disabled:cursor-not-allowed`}
                                    >
                                        {copied ? <>{t("copied") || "Copied"}</> : <>{t("copy") || "Copy"}</>}
                                    </button>
                                </div>
                                <p className="text-[10px] text-text-muted">{t("key_label")}</p>
                            </div>
                        </div>

                        {/* Download App (Hidden during Trial) */}

                        <div className="bg-bg-card border border-accent/10 rounded-2xl overflow-hidden">
                            <div className="relative bg-gradient-to-r from-accent/20 via-accent/10 to-transparent px-4 py-3 border-b border-accent/10 overflow-hidden">
                                <div className="absolute -top-4 -right-4 w-24 h-24 rounded-full bg-accent/10 blur-2xl pointer-events-none" />
                                <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 rounded-lg bg-accent/20 border border-accent/30 flex items-center justify-center">
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-accent-light">
                                            <rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8M12 17v4" />
                                        </svg>
                                    </div>
                                    <div>
                                        <p className="text-[12px] font-bold">{t("downloadApp") || ""}</p>
                                        <p className="text-[10px] text-text-muted">{t("downloadAppSub") || " TikTok Live"}</p>
                                    </div>
                                </div>
                            </div>
                            <div className="p-4 space-y-3">
                                <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-accent/20 to-accent/5 border border-accent/20 flex items-center justify-center flex-shrink-0">
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-accent-light">
                                            <rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8M12 17v4" />
                                        </svg>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <p className="text-[13px] font-bold">AclassStore Live</p>
                                            <span className="text-[9px] font-bold bg-accent/15 text-accent-light px-1.5 py-0.5 rounded border border-accent/20">v3.0</span>
                                        </div>
                                        <p className="text-[10px] text-text-muted mt-0.5 line-clamp-1">{t("downloadDesc") || "  TikTok Live"}</p>
                                    </div>
                                </div>
                                <button
                                    disabled={!isPremium}
                                    onClick={() => setShowDownloadModal(true)}
                                    className="w-full flex items-center justify-center gap-2 py-2.5 bg-accent hover:opacity-90 active:scale-[0.98] text-white text-[12px] font-bold rounded-xl transition-all shadow-lg shadow-accent/20 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {t("download") || ""}
                                </button>
                            </div>
                        </div>

                        {/* Save Button (desktop) */}
                        {functions.length > 0 && (
                            <button
                                onClick={handleSave}
                                disabled={saving || !isPremium}
                                className="hidden lg:flex w-full py-3 rounded-2xl font-bold text-[14px] bg-accent hover:opacity-90 text-white transition items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-accent/20 disabled:cursor-not-allowed"
                            >
                                {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : null}
                                {saving ? t("saving") : t("save")}
                            </button>
                        )}
                    </div>

                    {/*  RIGHT COLUMN  */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between px-1">
                            <p className="text-[11px] text-text-muted uppercase tracking-widest font-medium">{t("selectGiftForFunction")}</p>
                            {isPremium && (
                                <button onClick={handleClearAll} className="text-[11px] text-red-400 hover:text-red-500 font-medium transition">
                                    {t("clear_all") || "Reset to Default"}
                                </button>
                            )}
                        </div>

                        {functions.length === 0 ? (
                            <div className="text-center py-16 bg-bg-card border border-accent/10 rounded-2xl text-text-muted text-[13px]">
                                {t("noFunctions")}
                            </div>
                        ) : (
                            functions.map(fn => {
                                // Pool of rows for this function (multiple gifts allowed,
                                // each can be active/standby independently).
                                const fnMappings = mappings.filter(m => m.function_id === fn.id)
                                const activeCount = fnMappings.filter(m => m.is_enabled).length
                                const isPickerForThisFn = openPicker?.functionId === fn.id
                                const pickerMappingId = openPicker?.mappingId ?? null

                                return (
                                    <div key={fn.id} className="bg-bg-card border border-accent/10 rounded-2xl overflow-hidden transition-all">
                                        {/* Function header */}
                                        <div className="flex items-center gap-3 p-4">
                                            <div className="flex-1 flex items-center gap-3 min-w-0">
                                                {fn.image_url && (
                                                    <div className="w-8 h-8 rounded-lg overflow-hidden border border-white/5 bg-bg-base flex-shrink-0">
                                                        <Image src={getImageUrl(fn.image_url)} alt="" width={32} height={32} className="w-full h-full object-cover" unoptimized />
                                                    </div>
                                                )}
                                                <div className="min-w-0">
                                                    <p className="text-[13px] font-bold text-text-base truncate">{locale === "th" ? fn.label_th : fn.label_en}</p>
                                                    <p className="font-mono text-[10px] text-accent-light/70 tracking-wider uppercase">
                                                        {fn.name} · {fnMappings.length} {fnMappings.length === 1 ? "gift" : "gifts"}
                                                        {fnMappings.length > 0 && activeCount === 0 && (
                                                            <span className="ml-2 text-amber-400 normal-case">· {t("no_active_warn")}</span>
                                                        )}
                                                    </p>
                                                </div>
                                            </div>

                                            <button
                                                onClick={() => handleAddMapping(fn.id)}
                                                disabled={!isPremium}
                                                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border border-accent/20 bg-accent/5 text-accent-light text-[12px] font-bold flex-shrink-0 hover:bg-accent/10 transition ${!isPremium ? "opacity-50 cursor-not-allowed" : ""}`}
                                            >
                                                <PlusIcon size={13} />
                                                <span className="hidden sm:inline">{t("add_gift")}</span>
                                            </button>
                                        </div>

                                        {/* Pool rows */}
                                        {fnMappings.length === 0 ? (
                                            <div className="mx-4 mb-4 px-3 py-3 rounded-xl border border-dashed border-white/10 text-[11px] text-text-muted italic">
                                                {t("no_gifts_mapped_hint")}
                                            </div>
                                        ) : (
                                            <div className="px-4 pb-4 flex flex-col gap-2">
                                                {fnMappings.map(row => {
                                                    const gift = row.gifts
                                                    const isEnabled = row.is_enabled
                                                    const isLike = gift?.trigger_type === "like"
                                                    const isEditingThisRow =
                                                        isPickerForThisFn && pickerMappingId === row.id

                                                    return (
                                                        <div
                                                            key={row.id}
                                                            className={`flex items-center gap-2 p-2 rounded-xl border transition-all ${
                                                                isEnabled
                                                                    ? "border-accent/40 bg-accent/5"
                                                                    : "border-white/[0.08] bg-bg-base/40 opacity-60"
                                                            }`}
                                                        >
                                                            <span
                                                                className={`font-mono text-[8px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded shrink-0 ${
                                                                    isEnabled
                                                                        ? "bg-accent/30 text-accent-light"
                                                                        : "bg-white/[0.05] text-text-muted"
                                                                }`}
                                                            >
                                                                {isEnabled ? t("active_badge") : t("standby_badge")}
                                                            </span>

                                                            <button
                                                                onClick={() => togglePicker(fn.id, row.id)}
                                                                disabled={!isPremium}
                                                                className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border flex-1 min-w-0 transition ${
                                                                    isEditingThisRow
                                                                        ? "border-accent bg-accent/10"
                                                                        : "border-white/10 bg-bg-base hover:border-accent/40"
                                                                } ${!isPremium ? "cursor-not-allowed opacity-60" : ""}`}
                                                            >
                                                                {gift?.image_url ? (
                                                                    <Image
                                                                        src={getImageUrl(gift.image_url)}
                                                                        alt=""
                                                                        width={20}
                                                                        height={20}
                                                                        className="rounded object-cover shrink-0"
                                                                        unoptimized
                                                                    />
                                                                ) : (
                                                                    <div className="w-5 h-5 rounded bg-white/5 shrink-0" />
                                                                )}
                                                                <div className="text-left min-w-0 flex-1">
                                                                    <p className="text-[12px] font-semibold text-text-base truncate">{gift?.name}</p>
                                                                    <p className="text-[9px] text-text-muted">{gift?.diamonds} coins</p>
                                                                </div>
                                                                <ChevronIcon size={11} className={isEditingThisRow ? "rotate-180" : ""} />
                                                            </button>

                                                            {isLike && isEnabled && (
                                                                <input
                                                                    type="number"
                                                                    min="1"
                                                                    disabled={!isPremium}
                                                                    value={row.trigger_threshold ?? 1}
                                                                    onChange={e =>
                                                                        handleUpdateThreshold(
                                                                            row.id,
                                                                            parseInt(e.target.value) || 1,
                                                                        )
                                                                    }
                                                                    placeholder="Like"
                                                                    className="w-16 bg-bg-base border border-accent/15 rounded-lg px-2 py-1 text-[11px] text-accent-light text-center focus:border-accent/40 outline-none disabled:opacity-50"
                                                                />
                                                            )}

                                                            <button
                                                                onClick={() => handleSetActive(row.id)}
                                                                disabled={!isPremium}
                                                                title={isEnabled ? t("deactivate_tooltip") : t("set_active_tooltip")}
                                                                className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition ${
                                                                    isEnabled
                                                                        ? "bg-accent/15 text-accent-light border border-accent/30"
                                                                        : "bg-white/5 text-text-muted border border-white/10"
                                                                } ${!isPremium ? "opacity-30 cursor-not-allowed" : ""}`}
                                                            >
                                                                <PowerIcon size={13} />
                                                            </button>

                                                            <button
                                                                onClick={() => handleRemoveMapping(row.id)}
                                                                disabled={!isPremium}
                                                                title={t("remove_mapping")}
                                                                className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-white/5 text-text-muted hover:text-red-400 hover:bg-red-500/10 transition ${
                                                                    !isPremium ? "opacity-30 cursor-not-allowed" : ""
                                                                }`}
                                                            >
                                                                <TrashIcon size={12} />
                                                            </button>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        )}

                                        {/* Single picker at the bottom of the card.
                                            mappingId === null → adding a new row.
                                            mappingId === string → replacing the gift on that row. */}
                                        {isPickerForThisFn && (
                                            <div className="border-t border-accent/10 bg-bg-base/40 p-3 space-y-3">
                                                <div className="relative">
                                                    <input
                                                        autoFocus
                                                        type="text"
                                                        value={searchQuery}
                                                        onChange={e => setSearchQuery(e.target.value)}
                                                        placeholder={t("searchPlaceholder")}
                                                        className="w-full bg-bg-card border border-accent/20 rounded-xl pl-9 pr-4 py-2 text-[13px] outline-none focus:border-accent/50 transition"
                                                    />
                                                    <SearchIcon className="absolute left-3 top-2.5 text-text-muted" size={16} />
                                                </div>
                                                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 max-h-[220px] overflow-y-auto pr-1">
                                                    {filteredGifts.map(gift => (
                                                        <button
                                                            key={gift.id}
                                                            onClick={() => handleUpdateGift(fn.id, pickerMappingId, gift)}
                                                            className="flex flex-col items-center gap-1.5 p-2 rounded-xl border border-white/5 bg-bg-card hover:border-accent/30 transition"
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
                                                                    <span className="text-[20px]"></span>
                                                                )}
                                                            </div>
                                                            <p className="text-[10px] font-medium leading-tight line-clamp-1 text-center">{gift.name}</p>
                                                            <p className="text-[9px] text-text-muted">{gift.diamonds}</p>
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )
                            })
                        )}

                        {/* Save Button (mobile) */}
                        {functions.length > 0 && (
                            <button
                                onClick={handleSave}
                                disabled={saving || !isPremium}
                                className="lg:hidden w-full py-3.5 rounded-2xl font-bold text-[15px] bg-accent hover:opacity-90 text-white transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : null}
                                {saving ? t("saving") : t("save")}
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Upgrade Modal */}
            <AnimatePresence>
                {showUpgradeModal && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowUpgradeModal(false)} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
                        <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            className="relative w-full max-w-md bg-bg-card border border-accent/20 rounded-3xl overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
                            <div className="p-6 space-y-5">
                                <div className="flex items-center justify-between">
                                    <h2 className="text-[18px] font-bold">{t("upgradePremium")}</h2>
                                    <button onClick={() => setShowUpgradeModal(false)} className="text-text-muted hover:text-text-base transition"><CloseIcon size={20} /></button>
                                </div>
                                <div className="bg-accent/5 border border-accent/10 rounded-2xl p-4 flex items-center justify-between">
                                    <div>
                                        <p className="text-[14px] font-bold">{t("premiumLifetime")}</p>
                                        <p className="text-[11px] text-text-muted">{t("premiumLifetimeDesc")}</p>
                                    </div>
                                    <p className="text-[18px] font-bold text-accent-light">{premiumAddonPrice.toLocaleString()}</p>
                                </div>
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
                                <button disabled={upgrading} onClick={handleUpgrade} className="w-full py-4 bg-accent hover:opacity-90 text-white font-bold rounded-2xl transition shadow-lg shadow-accent/20 flex items-center justify-center gap-2 disabled:opacity-50">
                                    {upgrading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <>{t("proceedToCheckout")} ({(paymentMethod === "card" ? premiumAddonPrice * 1.06 : premiumAddonPrice).toLocaleString()})</>}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Download Info Modal */}
            <AnimatePresence>
                {showDownloadModal && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowDownloadModal(false)} className="absolute inset-0 bg-black/70 backdrop-blur-md" />
                        <motion.div initial={{ opacity: 0, scale: 0.95, y: 30 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 30 }}
                            className="relative w-full max-w-2xl bg-bg-card border border-accent/20 rounded-[32px] overflow-hidden shadow-2xl flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>

                            <div className="sticky top-0 z-10 bg-bg-card/80 backdrop-blur-md px-8 py-6 border-b border-white/5 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-accent/20 flex items-center justify-center border border-accent/30">
                                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-accent-light">
                                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
                                        </svg>
                                    </div>
                                    <h2 className="text-[20px] font-bold">{tD("title")}</h2>
                                </div>
                                <button onClick={() => setShowDownloadModal(false)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/5 transition text-text-muted hover:text-text-base">
                                    <CloseIcon size={24} />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-8 pt-6 space-y-6 text-[14px] leading-relaxed custom-scrollbar">
                                <div>
                                    <h1 className="text-[22px] font-black text-accent-light mb-2">{tD("release_title")}</h1>
                                    <p className="text-text-base font-medium">{tD("release_intro")}</p>
                                    <p>{tD("release_sub")}</p>
                                </div>

                                {tutorialEmbedUrl && (
                                    <div className="relative aspect-video w-full rounded-2xl overflow-hidden border border-white/10 bg-black shadow-2xl">
                                        <iframe
                                            width="100%"
                                            height="100%"
                                            src={`${tutorialEmbedUrl}?rel=0&modestbranding=1`}
                                            title="Tutorial video player"
                                            frameBorder="0"
                                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                            allowFullScreen
                                        ></iframe>
                                    </div>
                                )}

                                <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-5">
                                    <p className="text-red-400 font-bold mb-1">{tD("warning_title")}</p>
                                    <p className="text-[13px] text-red-200/80">{tD("warning_body")}</p>
                                </div>

                                <div className="space-y-4">
                                    <h3 className="text-[16px] font-bold flex items-center gap-2 border-l-4 border-accent pl-3 text-white">{tD("features_title")}</h3>
                                    <ul className="space-y-3 list-none">
                                        <li className="flex gap-2">
                                            <span className="text-accent-light mt-1"></span>
                                            <span><strong>{tD("f1_t")}</strong> {tD("f1_d")}</span>
                                        </li>
                                        <li className="flex gap-2">
                                            <span className="text-accent-light mt-1"></span>
                                            <span><strong>{tD("f2_t")}</strong> {tD("f2_d")}</span>
                                        </li>
                                        <li className="flex gap-2">
                                            <span className="text-accent-light mt-1"></span>
                                            <span><strong>{tD("f3_t")}</strong> {tD("f3_d")}</span>
                                        </li>
                                        <li className="flex gap-2">
                                            <span className="text-accent-light mt-1"></span>
                                            <span><strong>{tD("f4_t")}</strong> {tD("f4_d")}</span>
                                        </li>
                                    </ul>
                                </div>

                                <div className="space-y-3">
                                    <h3 className="text-[16px] font-bold flex items-center gap-2 border-l-4 border-green-500 pl-3 text-white">{tD("safety_title")}</h3>
                                    <p className="text-text-muted italic">{tD("safety_body")}</p>
                                    <p className="text-[12px] text-text-muted bg-white/5 p-3 rounded-xl border border-white/5">{tD("safety_note")}</p>
                                </div>

                                <div className="space-y-3">
                                    <h3 className="text-[16px] font-bold flex items-center gap-2 border-l-4 border-yellow-500 pl-3 text-white">{tD("how_to_buy_title")}</h3>
                                    <ol className="list-decimal list-inside space-y-1 ml-2 text-text-muted">
                                        <li>{tD("how_to_buy_step1")}</li>
                                        <li>{tD("how_to_buy_step2")}</li>
                                        <li>{tD("how_to_buy_step3")}</li>
                                    </ol>
                                </div>

                                <div className="space-y-3">
                                    <h3 className="text-[16px] font-bold flex items-center gap-2 border-l-4 border-purple-500 pl-3 text-white">{tD("how_to_setup_title")}</h3>
                                    <ol className="list-decimal list-inside space-y-1 ml-2 text-text-muted">
                                        <li>{tD("setup_step1")}</li>
                                        <li>{tD("setup_step2")}</li>
                                        <li>{tD("setup_step3")}</li>
                                        <li>{tD("setup_step4")}</li>
                                        <li>{tD("setup_step5")}</li>
                                    </ol>
                                </div>

                                <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-5">
                                    <p className="text-red-400 font-bold mb-1">{tD("usage_warning_title")}</p>
                                    <p className="text-[13px] text-red-200/80 leading-relaxed space-y-2">
                                        {tD("usage_warning_intro")}{" "}
                                        {tD("usage_warning_interval")}{" "}
                                        {tD("usage_warning_detection")}{" "}
                                        {tD("usage_warning_gift_issue")}{" "}
                                        {tD("usage_warning_system_effect")}{" "}
                                        <span className="font-semibold text-red-300">
                                            {tD("usage_warning_disclaimer")}
                                        </span>
                                    </p>
                                </div>

                                <div className="border-t border-white/5 pt-6 text-center">
                                    <p className="text-[12px] text-text-muted italic underline underline-offset-4">{tD("footer_contact")}</p>
                                </div>
                            </div>

                            <div className="p-6 bg-bg-card border-t border-white/5">
                                <a
                                    href={downloadUrl ?? "#"}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="w-full py-4 bg-accent hover:opacity-90 text-white font-black text-[16px] rounded-2xl transition-all shadow-xl shadow-accent/20 flex items-center justify-center gap-3 active:scale-[0.99]"
                                >
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
                                    </svg>
                                    {tD("download_btn")}
                                </a>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            <style jsx global>{`
                .custom-scrollbar::-webkit-scrollbar { width: 6px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.05); border-radius: 10px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255, 255, 255, 0.1); }
            `}</style>
        </div>
    )
}

function ChevronIcon({ size = 16, className = "" }: { size?: number; className?: string }) {
    return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform duration-200 ${className}`}><polyline points="6 9 12 15 18 9" /></svg>
}
function SearchIcon({ size = 16, className = "" }: { size?: number; className?: string }) {
    return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
}
function CloseIcon({ size = 16 }: { size?: number }) {
    return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
}
function PowerIcon({ size = 16 }: { size?: number }) {
    return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18.36 6.64a9 9 0 1 1-12.73 0" /><line x1="12" y1="2" x2="12" y2="12" /></svg>
}
function TrashIcon({ size = 16 }: { size?: number }) {
    return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /></svg>
}
function PlusIcon({ size = 16 }: { size?: number }) {
    return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
}