"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { useTranslations, useLocale } from "next-intl"
import { getImageUrl } from "@/lib/getImageUrl"

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
}: Props) {
    const router = useRouter()
    const t = useTranslations("Setting")

    const [mapping, setMapping]               = useState<Record<string, number>>(savedMapping)
    const [tiktokUsername, setTiktokUsername] = useState(savedTiktokUsername ?? "")
    const [saving, setSaving]                 = useState(false)
    const [openPicker, setOpenPicker]         = useState<string | null>(null)
    const [searchQuery, setSearchQuery]       = useState("")

    // ── Logic ──────────────────────────────────────────────────────

    const filteredGifts = useMemo(() => {
        const query = searchQuery.toLowerCase().trim()
        if (!query) return gifts
        return gifts.filter((gift) =>
            gift.name.toLowerCase().includes(query) ||
            String(gift.id).includes(query)
        )
    }, [gifts, searchQuery])

    const selectGift = (functionId: string, giftId: number) => {
        setMapping((prev) => ({ ...prev, [functionId]: giftId }))
        setOpenPicker(null)
        setSearchQuery("")
    }

    const togglePicker = (functionId: string) => {
        if (openPicker === functionId) {
            setOpenPicker(null)
            setSearchQuery("")
        } else {
            setOpenPicker(functionId)
            setSearchQuery("")
        }
    }

    const clearGift = (functionId: string) => {
        setMapping((prev) => {
            const next = { ...prev }
            delete next[functionId]
            return next
        })
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
                <div className="bg-bg-card border border-accent/15 rounded-2xl p-5 flex items-center gap-4">
                    <div className="flex-1">
                        <p className="text-[11px] text-text-muted uppercase tracking-widest mb-1">{t("game")}</p>
                        <p className="text-[16px] font-bold text-text-base">{productName}</p>
                    </div>
                    <div className="w-px h-10 bg-accent/10" />
                    <div className="flex-1">
                        <p className="text-[11px] text-text-muted uppercase tracking-widest mb-1">Whitelist</p>
                        <p className="font-mono text-[16px] font-bold text-accent-light">
                            {whitelistedUsername ?? "—"}
                        </p>
                    </div>
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
                    <p className="text-[11px] text-text-muted">{t("tiktok_username_hint")}</p>
                </div>

                {/* Function List */}
                <div className="space-y-3">
                    <p className="text-[11px] text-text-muted uppercase tracking-widest font-medium px-1">
                        {t("selectGiftForFunction")}
                    </p>

                    {functions.length === 0 ? (
                        <div className="text-center py-12 bg-bg-card border border-accent/10 rounded-2xl text-text-muted text-[13px]">
                            {t("noFunctions")}
                        </div>
                    ) : (
                        functions.map((fn) => {
                            const selectedGiftId = mapping[fn.id]
                            const selectedGift   = selectedGiftId ? getGift(selectedGiftId) : null
                            const isOpen         = openPicker === fn.id

                            return (
                                <div key={fn.id} className="bg-bg-card border border-accent/10 rounded-2xl overflow-hidden transition-all">
                                    {/* Main Row */}
                                    <div className="flex items-center gap-3 p-4">
                                        <div className="flex-1 flex flex-wrap items-center gap-2">
                                            <span className="font-mono text-[12px] bg-accent/10 text-accent-light px-2 py-0.5 rounded-md">
                                                {fn.name}
                                            </span>
                                            <span className="text-[13px] text-text-muted">
                                                {locale === "th" ? fn.label_th : fn.label_en}
                                            </span>
                                        </div>

                                        <button
                                            onClick={() => togglePicker(fn.id)}
                                            className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition min-w-[150px] justify-between ${
                                                selectedGift
                                                    ? "border-accent/40 bg-accent/5 text-accent-light"
                                                    : "border-white/10 bg-bg-base text-text-muted"
                                            }`}
                                        >
                                            <div className="flex items-center gap-2 overflow-hidden">
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
                                                    </>
                                                ) : (
                                                    <span className="text-[13px]">{t("selectGift")}</span>
                                                )}
                                            </div>
                                            <ChevronIcon size={14} className={isOpen ? "rotate-180" : ""} />
                                        </button>

                                        {selectedGift && (
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
                                                        className={`flex flex-col items-center gap-1.5 p-2 rounded-xl border transition ${
                                                            selectedGiftId === gift.id
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