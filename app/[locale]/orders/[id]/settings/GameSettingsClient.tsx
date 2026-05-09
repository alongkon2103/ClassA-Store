"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { useTranslations, useLocale } from "next-intl"

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
}

export default function GameSettingsClient({
    orderId,
    productName,
    whitelistedUsername,
    functions,
    gifts,
    savedMapping,
    locale,
}: Props) {
    const router = useRouter()
    const [mapping, setMapping] = useState<Record<string, number>>(savedMapping)
    const [saving, setSaving] = useState(false)
    const [saved, setSaved] = useState(false)
    const [openPicker, setOpenPicker] = useState<string | null>(null) // functionId ที่กำลังเลือก gift

    const t = useTranslations("Setting")
    const currentLocale = useLocale()

    const selectGift = (functionId: string, giftId: number) => {
        setMapping((prev) => ({ ...prev, [functionId]: giftId }))
        setOpenPicker(null)
        setSaved(false)
    }

    const clearGift = (functionId: string) => {
        setMapping((prev) => {
            const next = { ...prev }
            delete next[functionId]
            return next
        })
        setSaved(false)
    }

    const handleSave = async () => {
        setSaving(true)
        const res = await fetch(`/api/orders/${orderId}/settings`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ mapping }),
        })
        setSaving(false)
        if (!res.ok) {
            alert(t("saveFailed"))
            return
        }
        setSaved(true)
        router.refresh()
    }

    const getGift = (giftId: number) => gifts.find((g) => g.id === giftId)

    return (
        <div className="min-h-screen bg-bg-base">
            <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">

                {/* Header */}
                <button
                    onClick={() => router.back()}
                    className="text-[12px] text-text-muted hover:text-text-base mb-3 flex items-center gap-1 transition"
                >
                    ← {t("back")}
                </button>

                <h1 className="text-[22px] font-bold">{t("title")}</h1>
                <p className="text-[13px] text-text-muted mt-1">
                    {t("subtitle")}
                </p>

                {/* Product + Username Card */}
                <div className="bg-bg-card border border-accent/15 rounded-2xl p-5 flex items-center gap-4">
                    <div className="flex-1">
                        <p className="text-[11px] text-text-muted uppercase tracking-widest mb-1">
                            {t("game")}
                        </p>
                        <p className="text-[16px] font-bold text-text-base">{productName}</p>
                    </div>
                    <div className="w-px h-10 bg-accent/10" />
                    <div className="flex-1">
                        <p className="text-[11px] text-text-muted uppercase tracking-widest mb-1">Whitelist Username</p>
                        <p className="font-mono text-[16px] font-bold text-accent-light">
                            {whitelistedUsername ?? "—"}
                        </p>
                    </div>
                </div>

                {/* Functions */}
                {functions.length === 0 ? (
                    <div className="text-center py-16 text-text-muted text-[13px] bg-bg-card border border-accent/10 rounded-2xl">
                        {t("noFunctions")}
                    </div>
                ) : (
                    <div className="space-y-3">
                        <p className="text-[11px] text-text-muted uppercase tracking-widest font-medium px-1">
                            {t("selectGiftForFunction")}
                        </p>

                        {functions.map((fn) => {
                            const selectedGiftId = mapping[fn.id]
                            const selectedGift = selectedGiftId ? getGift(selectedGiftId) : null
                            const isOpen = openPicker === fn.id

                            return (
                                <div key={fn.id} className="bg-bg-card border border-accent/10 rounded-2xl overflow-hidden">
                                    {/* Function row */}
                                    <div className="flex items-center gap-3 p-4">
                                        {/* Function label */}
                                        <div className="flex-1">
                                            <span className="font-mono text-[13px] bg-accent/10 text-accent-light px-2 py-0.5 rounded-lg">
                                                {fn.name}
                                            </span>
                                            {(locale === "th" ? fn.label_th : fn.label_en) && (
                                                <span className="text-[13px] text-text-muted ml-2">
                                                    {locale === "th" ? fn.label_th : fn.label_en}
                                                </span>
                                            )}
                                        </div>

                                        {/* Arrow */}
                                        <span className="text-text-muted text-[18px]">→</span>

                                        {/* Selected gift / picker button */}
                                        <button
                                            onClick={() => setOpenPicker(isOpen ? null : fn.id)}
                                            className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition min-w-[140px] justify-between ${selectedGift
                                                ? "border-accent/30 bg-accent/10 text-accent-light"
                                                : "border-white/10 bg-bg-base text-text-muted hover:border-accent/20"
                                                }`}
                                        >
                                            {selectedGift ? (
                                                <div className="flex items-center gap-2">
                                                    {selectedGift.image_url ? (
                                                        <Image
                                                            src={selectedGift.image_url}
                                                            alt={selectedGift.name}
                                                            width={20} height={20}
                                                            className="rounded object-cover"
                                                        />
                                                    ) : (
                                                        <span className="text-[14px]">🎁</span>
                                                    )}
                                                    <span className="text-[13px] font-medium">{selectedGift.name}</span>
                                                </div>
                                            ) : (
                                                <span className="text-[13px]">{t("selectGift")}</span>
                                            )}
                                            <ChevronIcon size={14} className={`transition ${isOpen ? "rotate-180" : ""}`} />
                                        </button>

                                        {/* Clear button */}
                                        {selectedGift && (
                                            <button
                                                onClick={() => clearGift(fn.id)}
                                                className="text-text-muted hover:text-red-400 transition text-[18px] leading-none"
                                            >
                                                ×
                                            </button>
                                        )}
                                    </div>

                                    {/* Gift picker dropdown */}
                                    {isOpen && (
                                        <div className="border-t border-accent/10 p-3 grid grid-cols-3 sm:grid-cols-4 gap-2 bg-bg-base/60">
                                            {gifts.map((gift) => (
                                                <button
                                                    key={gift.id}
                                                    onClick={() => selectGift(fn.id, gift.id)}
                                                    className={`flex flex-col items-center gap-1.5 p-2.5 rounded-xl border transition ${selectedGiftId === gift.id
                                                        ? "border-accent/50 bg-accent/15 text-accent-light"
                                                        : "border-white/5 bg-bg-card hover:border-accent/20 text-text-base"
                                                        }`}
                                                >
                                                    {gift.image_url ? (
                                                        <Image
                                                            src={gift.image_url}
                                                            alt={gift.name}
                                                            width={32} height={32}
                                                            className="rounded object-cover"
                                                        />
                                                    ) : (
                                                        <span className="text-[24px]">🎁</span>
                                                    )}
                                                    <span className="text-[11px] font-medium text-center leading-tight">
                                                        {gift.name}
                                                    </span>
                                                    <span className="text-[10px] text-text-muted">
                                                        💎 {gift.diamonds}
                                                    </span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                )}

                {/* Save button */}
                {/* Save button */}
                {functions.length > 0 && (
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="w-full py-3 rounded-2xl font-semibold text-[14px] transition flex items-center justify-center gap-2 bg-accent hover:opacity-90 text-white disabled:opacity-50"
                    >
                        {saving && <SpinIcon />}
                        {saving ? t("saving") : t("save")}
                    </button>
                )}
            </div>
        </div>
    )
}

function ChevronIcon({ size = 16, className = "" }: { size?: number; className?: string }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <polyline points="6 9 12 15 18 9" />
        </svg>
    )
}

function SpinIcon() {
    return (
        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
    )
}