// // "use client"

// // import { useState, useMemo, useEffect } from "react"
// // import { useRouter, useSearchParams } from "next/navigation"
// // import Image from "next/image"
// // import { useTranslations, useLocale } from "next-intl"
// // import { getImageUrl } from "@/lib/getImageUrl"
// // import { motion, AnimatePresence } from "framer-motion"

// // type Gift = {
// //     id: number
// //     name: string
// //     image_url: string | null
// //     diamonds: number
// // }

// // type ProductFunction = {
// //     id: string
// //     name: string
// //     label_th: string | null
// //     label_en: string | null
// //     sort_order: number
// //     default_gift_id?: number | null
// //     image_url?: string | null
// // }

// // type Props = {
// //     orderId: string
// //     productName: string
// //     whitelistedUsername: string | null
// //     functions: ProductFunction[]
// //     gifts: Gift[]
// //     savedMapping: Record<string, number>
// //     savedTiktokUsername?: string | null
// //     locale: string
// //     isPremium: boolean
// //     premiumAddonPrice: number
// // }

// // export default function GameSettingsClient({
// //     orderId,
// //     productName,
// //     whitelistedUsername,
// //     functions,
// //     gifts,
// //     savedMapping,
// //     savedTiktokUsername,
// //     locale,
// //     isPremium,
// //     premiumAddonPrice,
// // }: Props) {
// //     const router = useRouter()
// //     const searchParams = useSearchParams()
// //     const t = useTranslations("Setting")
// //     const tModal = useTranslations("ProductModal")

// //     useEffect(() => {
// //         if (searchParams?.get("upgrade") === "success") {
// //             alert(t("upgradeSuccess") || "Upgrade Successful! You are now a Premium user.")
// //             window.history.replaceState({}, '', window.location.pathname)
// //         }
// //     }, [searchParams, t])

// //     const [showUpgradeModal, setShowUpgradeModal] = useState(false)
// //     const [paymentMethod, setPaymentMethod] = useState<"card" | "promptpay">("promptpay")
// //     const [upgrading, setUpgrading] = useState(false)
// //     const [showKey, setShowKey] = useState(false)
// //     const [copied, setCopied] = useState(false)

// //     const effectiveMapping = useMemo(() => {
// //         if (!isPremium) {
// //             const dm: Record<string, number> = {}
// //             functions.forEach(fn => {
// //                 if (fn.default_gift_id) dm[fn.id] = fn.default_gift_id
// //             })
// //             return dm
// //         }
// //         if (Object.keys(savedMapping).length > 0) return savedMapping
// //         const dm: Record<string, number> = {}
// //         functions.forEach(fn => {
// //             if (fn.default_gift_id) dm[fn.id] = fn.default_gift_id
// //         })
// //         return dm
// //     }, [isPremium, savedMapping, functions])

// //     const [mapping, setMapping] = useState<Record<string, number>>(effectiveMapping)
// //     const [tiktokUsername, setTiktokUsername] = useState(savedTiktokUsername ?? "")
// //     const [saving, setSaving] = useState(false)
// //     const [openPicker, setOpenPicker] = useState<string | null>(null)
// //     const [searchQuery, setSearchQuery] = useState("")

// //     useEffect(() => {
// //         setMapping(effectiveMapping)
// //     }, [effectiveMapping])

// //     const handleCopy = () => {
// //         navigator.clipboard.writeText(orderId)
// //         setCopied(true)
// //         setTimeout(() => setCopied(false), 2000)
// //     }

// //     const selectGift = (functionId: string, giftId: number) => {
// //         if (!isPremium) return
// //         setMapping((prev) => ({ ...prev, [functionId]: giftId }))
// //         setOpenPicker(null)
// //         setSearchQuery("")
// //     }

// //     const togglePicker = (functionId: string) => {
// //         if (!isPremium) return
// //         if (openPicker === functionId) {
// //             setOpenPicker(null)
// //             setSearchQuery("")
// //         } else {
// //             setOpenPicker(functionId)
// //             setSearchQuery("")
// //         }
// //     }

// //     const clearGift = (functionId: string) => {
// //         if (!isPremium) return
// //         setMapping((prev) => {
// //             const next = { ...prev }
// //             delete next[functionId]
// //             return next
// //         })
// //     }

// //     const handleUpgrade = async () => {
// //         try {
// //             setUpgrading(true)
// //             const res = await fetch(`/api/orders/${orderId}/upgrade`, {
// //                 method: "POST",
// //                 headers: { "Content-Type": "application/json" },
// //                 body: JSON.stringify({ paymentMethod, locale })
// //             })
// //             const data = await res.json()
// //             if (data.url) window.location.href = data.url
// //             else alert(data.error || "Upgrade failed")
// //         } catch {
// //             alert("Connection error")
// //         } finally {
// //             setUpgrading(false)
// //         }
// //     }

// //     const handleSave = async () => {
// //         try {
// //             setSaving(true)
// //             const res = await fetch(`/api/orders/${orderId}/settings`, {
// //                 method: "POST",
// //                 headers: { "Content-Type": "application/json" },
// //                 body: JSON.stringify({
// //                     mapping,
// //                     tiktok_username: tiktokUsername.trim() || null,
// //                 }),
// //             })
// //             if (!res.ok) throw new Error()
// //             router.refresh()
// //             alert(t("saveSuccess") || "Saved successfully")
// //         } catch {
// //             alert(t("saveFailed"))
// //         } finally {
// //             setSaving(false)
// //         }
// //     }

// //     const getGift = (giftId: number) => gifts.find((g) => g.id === giftId)

// //     const filteredGifts = useMemo(() => {
// //         const query = searchQuery.toLowerCase().trim()
// //         if (!query) return gifts
// //         return gifts.filter((gift) =>
// //             gift.name.toLowerCase().includes(query) ||
// //             String(gift.id).includes(query)
// //         )
// //     }, [gifts, searchQuery])

// //     const maskedKey = orderId.replace(/./g, "•")

// //     return (
// //         <div className="min-h-screen bg-bg-base">
// //             <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">

// //                 {/* Back & Title */}
// //                 <div>
// //                     <button
// //                         onClick={() => router.back()}
// //                         className="text-[12px] text-text-muted hover:text-text-base mb-3 flex items-center gap-1 transition"
// //                     >
// //                         ← {t("back")}
// //                     </button>
// //                     <h1 className="text-[22px] font-bold">{t("title")}</h1>
// //                     <p className="text-[13px] text-text-muted mt-1">{t("subtitle")}</p>
// //                 </div>

// //                 {/* Game Info Card */}
// //                 <div className="bg-bg-card border border-accent/15 rounded-2xl p-5 flex flex-col gap-4">
// //                     <div className="flex items-center gap-4">
// //                         <div className="flex-1">
// //                             <p className="text-[11px] text-text-muted uppercase tracking-widest mb-1">{t("game")}</p>
// //                             <p className="text-[16px] font-bold text-text-base">{productName}</p>
// //                         </div>
// //                         <div className="w-px h-10 bg-accent/10" />
// //                         <div className="flex-1">
// //                             <p className="text-[11px] text-text-muted uppercase tracking-widest mb-1">{t("whitelist_label") || "Whitelist"}</p>
// //                             <p className="font-mono text-[16px] font-bold text-accent-light">
// //                                 {whitelistedUsername ?? "—"}
// //                             </p>
// //                         </div>
// //                     </div>

// //                     {!isPremium && (
// //                         <div className="bg-accent/10 border border-accent/20 rounded-xl p-3 flex items-center justify-between gap-3">
// //                             <div className="flex items-center gap-2.5 text-accent-light">
// //                                 <div>
// //                                     <p className="text-[13px] font-bold leading-tight">{t("upgradePremium")}</p>
// //                                     <p className="text-[11px] opacity-80">{t("upgradeUnlock")}</p>
// //                                 </div>
// //                             </div>
// //                             <button
// //                                 onClick={() => setShowUpgradeModal(true)}
// //                                 className="bg-accent text-white text-[11px] font-bold px-3 py-1.5 rounded-lg hover:opacity-90 transition"
// //                             >
// //                                 {t("buyPremium")}
// //                             </button>
// //                         </div>
// //                     )}
// //                 </div>

// //                 {/* TikTok + Key Section */}
// //                 <div className="bg-bg-card border border-accent/10 rounded-2xl p-5 space-y-4">

// //                     {/* TikTok Username */}
// //                     <div className="space-y-2">
// //                         <div className="flex items-center gap-2">
// //                             <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" className="text-accent-light flex-shrink-0">
// //                                 <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.78 1.52V6.76a4.85 4.85 0 0 1-1.01-.07z" />
// //                             </svg>
// //                             <p className="text-[13px] font-semibold">{t("tiktok_username_label")}</p>
// //                         </div>
// //                         <div className="relative">
// //                             <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-[13px]">@</span>
// //                             <input
// //                                 value={tiktokUsername}
// //                                 onChange={(e) => setTiktokUsername(e.target.value.replace("@", ""))}
// //                                 placeholder={t("tiktok_username_placeholder")}
// //                                 className="w-full bg-bg-base border border-accent/15 rounded-xl pl-7 pr-4 py-2.5 text-[13px] placeholder:text-text-muted outline-none focus:border-accent/40 transition"
// //                             />
// //                         </div>
// //                         <p className="text-[11px] text-text-muted">{t("tiktok_username_hint")}</p>
// //                     </div>

// //                     <div className="border-t border-accent/5" />

// //                     {/* Program Key */}
// //                     <div className="space-y-2">
// //                         <div className="flex items-center gap-2">
// //                             <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-accent-light flex-shrink-0">
// //                                 <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
// //                                 <path d="M7 11V7a5 5 0 0 1 10 0v4" />
// //                             </svg>
// //                             <p className="text-[13px] font-semibold">{t("program_key") || "Program Key"}</p>
// //                         </div>

// //                         <div className="flex items-center gap-2">
// //                             <div className="relative flex-1">
// //                                 <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-[13px]">#</span>
// //                                 <input
// //                                     value={showKey ? orderId : maskedKey}
// //                                     readOnly
// //                                     className="w-full bg-bg-base border border-accent/15 rounded-xl pl-7 pr-10 py-2.5 text-[13px] text-accent-light outline-none font-mono tracking-wider"
// //                                 />
// //                                 {/* Eye Toggle */}
// //                                 <button
// //                                     onClick={() => setShowKey((v) => !v)}
// //                                     className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-base transition"
// //                                 >
// //                                     {showKey ? (
// //                                         <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
// //                                             <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
// //                                             <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
// //                                             <line x1="1" y1="1" x2="23" y2="23"/>
// //                                         </svg>
// //                                     ) : (
// //                                         <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
// //                                             <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
// //                                             <circle cx="12" cy="12" r="3"/>
// //                                         </svg>
// //                                     )}
// //                                 </button>
// //                             </div>

// //                             {/* Copy Button */}
// //                             <button
// //                                 onClick={handleCopy}
// //                                 className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-[11px] font-bold transition flex-shrink-0 ${
// //                                     copied
// //                                         ? "bg-green-500/15 text-green-400 border border-green-500/20"
// //                                         : "bg-accent/10 hover:bg-accent/20 text-accent-light border border-accent/15"
// //                                 }`}
// //                             >
// //                                 {copied ? (
// //                                     <>
// //                                         <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
// //                                             <polyline points="20 6 9 17 4 12"/>
// //                                         </svg>
// //                                         {t("copied") || "Copied"}
// //                                     </>
// //                                 ) : (
// //                                     <>
// //                                         <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
// //                                             <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
// //                                             <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
// //                                         </svg>
// //                                         {t("copy") || "Copy"}
// //                                     </>
// //                                 )}
// //                             </button>
// //                         </div>
// //                         <p className="text-[11px] text-text-muted">{t("key_label")}</p>
// //                     </div>
// //                 </div>

// //                 {/* Download App */}
// //                 <div className="bg-bg-card border border-accent/10 rounded-2xl overflow-hidden">

// //                     {/* Banner Header */}
// //                     <div className="relative bg-gradient-to-r from-accent/20 via-accent/10 to-transparent px-5 py-4 border-b border-accent/10 overflow-hidden">
// //                         <div className="absolute -top-4 -right-4 w-32 h-32 rounded-full bg-accent/10 blur-2xl pointer-events-none" />
// //                         <div className="flex items-center gap-2.5">
// //                             <div className="w-7 h-7 rounded-lg bg-accent/20 border border-accent/30 flex items-center justify-center flex-shrink-0">
// //                                 <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-accent-light">
// //                                     <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>
// //                                 </svg>
// //                             </div>
// //                             <div>
// //                                 <p className="text-[13px] font-bold text-text-base">{t("downloadApp") || "โปรแกรมของร้าน"}</p>
// //                                 <p className="text-[10px] text-text-muted">{t("downloadAppSub") || "ใช้สำหรับรับ Gift และจัดการ TikTok Live"}</p>
// //                             </div>
// //                         </div>
// //                     </div>

// //                     <div className="p-5 space-y-4">
// //                         {/* App Info Row */}
// //                         <div className="flex items-center gap-4">
// //                             <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-accent/20 to-accent/5 border border-accent/20 flex items-center justify-center flex-shrink-0 shadow-lg shadow-accent/10">
// //                                 <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-accent-light">
// //                                     <rect x="2" y="3" width="20" height="14" rx="2"/>
// //                                     <path d="M8 21h8M12 17v4"/>
// //                                 </svg>
// //                             </div>
// //                             <div className="flex-1 min-w-0">
// //                                 <div className="flex items-center gap-2 flex-wrap">
// //                                     <p className="text-[15px] font-bold text-text-base">AclassStore Live</p>
// //                                     <span className="text-[9px] font-bold bg-accent/15 text-accent-light px-1.5 py-0.5 rounded-md border border-accent/20">
// //                                         v3.0
// //                                     </span>
// //                                 </div>
// //                                 <p className="text-[11px] text-text-muted mt-0.5">
// //                                     {t("downloadDesc") || "โปรแกรมสำหรับจัดการของร้าน · ใช้คู่กับ TikTok Live"}
// //                                 </p>
// //                                 <div className="flex items-center gap-2 mt-1.5">
// //                                     <span className="text-[10px] text-text-muted bg-white/5 px-2 py-0.5 rounded-full">Windows</span>
// //                                     <span className="text-[10px] text-text-muted">.exe · 45 MB</span>
// //                                 </div>
// //                             </div>
// //                         </div>

// //                         {/* Download Button */}
// //                         <a
// //                             href="https://aclassstore.com/downloads/AclassStoreLiveV3.exe"
// //                             download
// //                             className="w-full flex items-center justify-center gap-2.5 py-3 bg-accent hover:opacity-90 active:scale-[0.98] text-white text-[13px] font-bold rounded-xl transition-all shadow-lg shadow-accent/25"
// //                         >
// //                             <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
// //                                 <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
// //                                 <polyline points="7 10 12 15 17 10"/>
// //                                 <line x1="12" y1="15" x2="12" y2="3"/>
// //                             </svg>
// //                             {t("download") || "ดาวน์โหลดโปรแกรม"}
// //                         </a>

// //                         {/* Warning */}
// //                         <div className="flex items-start gap-2">
// //                             <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-yellow-500/70 flex-shrink-0 mt-0.5">
// //                                 <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
// //                             </svg>
// //                             <p className="text-[10px] text-text-muted leading-relaxed">
// //                                 {t("downloadHint") || "Windows อาจแจ้งเตือนความปลอดภัย ให้กด \"Keep anyway\" หรือ \"More info → Run anyway\""}
// //                             </p>
// //                         </div>
// //                     </div>
// //                 </div>

// //                 {/* Function List */}
// //                 <div className="space-y-3">
// //                     <div className="flex items-center justify-between px-1">
// //                         <p className="text-[11px] text-text-muted uppercase tracking-widest font-medium">
// //                             {t("selectGiftForFunction")}
// //                         </p>
// //                         {isPremium && Object.keys(mapping).length > 0 && (
// //                             <button
// //                                 onClick={() => {
// //                                     if (confirm(t("confirm_clear_all") || "Clear all selected gifts?")) {
// //                                         setMapping({})
// //                                     }
// //                                 }}
// //                                 className="text-[11px] text-red-400 hover:text-red-500 font-medium transition"
// //                             >
// //                                 {t("clear_all") || "Clear All"}
// //                             </button>
// //                         )}
// //                     </div>

// //                     {functions.length === 0 ? (
// //                         <div className="text-center py-12 bg-bg-card border border-accent/10 rounded-2xl text-text-muted text-[13px]">
// //                             {t("noFunctions")}
// //                         </div>
// //                     ) : (
// //                         functions.map((fn) => {
// //                             const selectedGiftId = mapping[fn.id]
// //                             const selectedGift = selectedGiftId ? getGift(selectedGiftId) : null
// //                             const isOpen = openPicker === fn.id

// //                             return (
// //                                 <div key={fn.id} className="bg-bg-card border border-accent/10 rounded-2xl overflow-hidden transition-all">
// //                                     <div className="flex items-center gap-3 p-4">
// //                                         <div className="flex-1 flex flex-wrap items-center gap-3">
// //                                             {fn.image_url && (
// //                                                 <div className="w-8 h-8 rounded-lg overflow-hidden border border-white/5 bg-bg-base flex-shrink-0">
// //                                                     <Image src={getImageUrl(fn.image_url)} alt="" width={32} height={32} className="w-full h-full object-cover" unoptimized />
// //                                                 </div>
// //                                             )}
// //                                             <div className="flex flex-col gap-0.5">
// //                                                 <span className="text-[13px] font-bold text-text-base">
// //                                                     {locale === "th" ? fn.label_th : fn.label_en}
// //                                                 </span>
// //                                                 <span className="font-mono text-[10px] text-accent-light/70 tracking-wider uppercase">
// //                                                     {fn.name}
// //                                                 </span>
// //                                             </div>
// //                                         </div>

// //                                         <button
// //                                             onClick={() => togglePicker(fn.id)}
// //                                             disabled={!isPremium}
// //                                             className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition min-w-[150px] justify-between ${selectedGift
// //                                                 ? "border-accent/40 bg-accent/5 text-accent-light"
// //                                                 : "border-white/10 bg-bg-base text-text-muted"
// //                                                 } ${!isPremium ? "cursor-default opacity-80" : ""}`}
// //                                         >
// //                                             <div className="flex items-center gap-2 overflow-hidden">
// //                                                 {!isPremium && !selectedGift && (
// //                                                     <span className="text-[11px] font-bold bg-white/5 px-1.5 py-0.5 rounded text-text-muted">LOCKED</span>
// //                                                 )}
// //                                                 {selectedGift ? (
// //                                                     <>
// //                                                         {selectedGift.image_url ? (
// //                                                             <Image src={getImageUrl(selectedGift.image_url)} alt="" width={18} height={18} className="rounded object-cover" unoptimized />
// //                                                         ) : (
// //                                                             <span>🎁</span>
// //                                                         )}
// //                                                         <span className="text-[13px] font-medium truncate">{selectedGift.name}</span>
// //                                                         {(!isPremium || (Object.keys(savedMapping).length === 0 && selectedGiftId === fn.default_gift_id)) && (
// //                                                             <span className="text-[10px] bg-accent/10 px-1 rounded">DEFAULT</span>
// //                                                         )}
// //                                                     </>
// //                                                 ) : (
// //                                                     <span className="text-[13px]">{t("selectGift")}</span>
// //                                                 )}
// //                                             </div>
// //                                             {isPremium && <ChevronIcon size={14} className={isOpen ? "rotate-180" : ""} />}
// //                                         </button>

// //                                         {selectedGift && isPremium && (
// //                                             <button onClick={() => clearGift(fn.id)} className="text-text-muted hover:text-red-400 p-1 transition">
// //                                                 <CloseIcon size={18} />
// //                                             </button>
// //                                         )}
// //                                     </div>

// //                                     {isOpen && (
// //                                         <div className="border-t border-accent/10 bg-bg-base/40 p-3 space-y-3">
// //                                             <div className="relative">
// //                                                 <input
// //                                                     autoFocus
// //                                                     type="text"
// //                                                     value={searchQuery}
// //                                                     onChange={(e) => setSearchQuery(e.target.value)}
// //                                                     placeholder={t("searchPlaceholder")}
// //                                                     className="w-full bg-bg-card border border-accent/20 rounded-xl pl-9 pr-4 py-2 text-[13px] outline-none focus:border-accent/50 transition"
// //                                                 />
// //                                                 <SearchIcon className="absolute left-3 top-2.5 text-text-muted" size={16} />
// //                                             </div>
// //                                             <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-[260px] overflow-y-auto pr-1">
// //                                                 {filteredGifts.map((gift) => (
// //                                                     <button
// //                                                         key={gift.id}
// //                                                         onClick={() => selectGift(fn.id, gift.id)}
// //                                                         className={`flex flex-col items-center gap-1.5 p-2 rounded-xl border transition ${selectedGiftId === gift.id ? "border-accent bg-accent/10" : "border-white/5 bg-bg-card hover:border-accent/30"}`}
// //                                                     >
// //                                                         <div className="w-8 h-8 flex items-center justify-center">
// //                                                             {gift.image_url ? (
// //                                                                 <Image src={getImageUrl(gift.image_url)} alt="" width={32} height={32} className="rounded object-cover" unoptimized />
// //                                                             ) : (
// //                                                                 <span className="text-[20px]">🎁</span>
// //                                                             )}
// //                                                         </div>
// //                                                         <div className="text-center">
// //                                                             <p className="text-[11px] font-medium leading-tight line-clamp-1">{gift.name}</p>
// //                                                             <p className="text-[10px] text-text-muted">💎 {gift.diamonds}</p>
// //                                                         </div>
// //                                                     </button>
// //                                                 ))}
// //                                                 {filteredGifts.length === 0 && (
// //                                                     <div className="col-span-full py-8 text-center text-text-muted text-[12px]">
// //                                                         {t("noResults")}
// //                                                     </div>
// //                                                 )}
// //                                             </div>
// //                                         </div>
// //                                     )}
// //                                 </div>
// //                             )
// //                         })
// //                     )}
// //                 </div>

// //                 {/* Save Button */}
// //                 {functions.length > 0 && (
// //                     <button
// //                         onClick={handleSave}
// //                         disabled={saving}
// //                         className="w-full py-3.5 rounded-2xl font-bold text-[15px] bg-accent hover:opacity-90 text-white transition flex items-center justify-center gap-2 disabled:opacity-50"
// //                     >
// //                         {saving && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
// //                         {saving ? t("saving") : t("save")}
// //                     </button>
// //                 )}
// //             </div>

// //             {/* Upgrade Modal */}
// //             <AnimatePresence>
// //                 {showUpgradeModal && (
// //                     <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
// //                         <motion.div
// //                             initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
// //                             onClick={() => setShowUpgradeModal(false)}
// //                             className="absolute inset-0 bg-black/60 backdrop-blur-sm"
// //                         />
// //                         <motion.div
// //                             initial={{ opacity: 0, scale: 0.9, y: 20 }}
// //                             animate={{ opacity: 1, scale: 1, y: 0 }}
// //                             exit={{ opacity: 0, scale: 0.9, y: 20 }}
// //                             className="relative w-full max-w-md bg-bg-card border border-accent/20 rounded-3xl overflow-hidden shadow-2xl"
// //                             onClick={(e) => e.stopPropagation()}
// //                         >
// //                             <div className="p-6 space-y-6">
// //                                 <div className="flex items-center justify-between">
// //                                     <h2 className="text-[18px] font-bold text-text-base">{t("upgradePremium")}</h2>
// //                                     <button onClick={() => setShowUpgradeModal(false)} className="text-text-muted hover:text-text-base transition">
// //                                         <CloseIcon size={20} />
// //                                     </button>
// //                                 </div>

// //                                 <div className="bg-accent/5 border border-accent/10 rounded-2xl p-4 flex items-center justify-between">
// //                                     <div>
// //                                         <p className="text-[14px] font-bold">{t("premiumLifetime")}</p>
// //                                         <p className="text-[11px] text-text-muted">{t("premiumLifetimeDesc")}</p>
// //                                     </div>
// //                                     <p className="text-[18px] font-bold text-accent-light">฿{premiumAddonPrice.toLocaleString()}</p>
// //                                 </div>

// //                                 <div className="space-y-2">
// //                                     <p className="text-[11px] tracking-widest text-text-muted uppercase font-medium">{tModal("payment_method")}</p>
// //                                     <div className="grid grid-cols-2 gap-2">
// //                                         <button onClick={() => setPaymentMethod("promptpay")} className={`p-3 rounded-xl border text-left transition ${paymentMethod === "promptpay" ? "border-accent bg-accent/10 text-accent-light" : "border-white/10"}`}>
// //                                             <p className="text-[13px] font-medium">{tModal("promptpay_label")}</p>
// //                                             <p className="text-[10px] text-green-400 opacity-80">{tModal("promptpay_desc")}</p>
// //                                         </button>
// //                                         <button onClick={() => setPaymentMethod("card")} className={`p-3 rounded-xl border text-left transition ${paymentMethod === "card" ? "border-accent bg-accent/10 text-accent-light" : "border-white/10"}`}>
// //                                             <p className="text-[13px] font-medium">{tModal("stripe_label")}</p>
// //                                             <p className="text-[10px] text-orange-400 opacity-80">{tModal("stripe_desc")}</p>
// //                                         </button>
// //                                     </div>
// //                                 </div>

// //                                 <button
// //                                     disabled={upgrading}
// //                                     onClick={handleUpgrade}
// //                                     className="w-full py-4 bg-accent hover:opacity-90 text-white font-bold rounded-2xl transition shadow-lg shadow-accent/20 flex items-center justify-center gap-2 disabled:opacity-50"
// //                                 >
// //                                     {upgrading ? (
// //                                         <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
// //                                     ) : (
// //                                         <>{t("proceedToCheckout")} (฿{(paymentMethod === "card" ? premiumAddonPrice * 1.06 : premiumAddonPrice).toLocaleString()})</>
// //                                     )}
// //                                 </button>

// //                                 <p className="text-[10px] text-center text-text-muted px-4">{t("upgradeNote")}</p>
// //                             </div>
// //                         </motion.div>
// //                     </div>
// //                 )}
// //             </AnimatePresence>
// //         </div>
// //     )
// // }

// // function ChevronIcon({ size = 16, className = "" }: { size?: number; className?: string }) {
// //     return (
// //         <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform duration-200 ${className}`}>
// //             <polyline points="6 9 12 15 18 9" />
// //         </svg>
// //     )
// // }

// // function SearchIcon({ size = 16, className = "" }: { size?: number; className?: string }) {
// //     return (
// //         <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
// //             <circle cx="11" cy="11" r="8" />
// //             <line x1="21" y1="21" x2="16.65" y2="16.65" />
// //         </svg>
// //     )
// // }

// // function CloseIcon({ size = 16 }: { size?: number }) {
// //     return (
// //         <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
// //             <line x1="18" y1="6" x2="6" y2="18" />
// //             <line x1="6" y1="6" x2="18" y2="18" />
// //         </svg>
// //     )
// // }
// "use client"

// import { useState, useMemo, useEffect } from "react"
// import { useRouter, useSearchParams } from "next/navigation"
// import Image from "next/image"
// import { useTranslations, useLocale } from "next-intl"
// import { getImageUrl } from "@/lib/getImageUrl"
// import { motion, AnimatePresence } from "framer-motion"

// type Gift = {
//     id: number
//     name: string
//     image_url: string | null
//     diamonds: number
// }

// type ProductFunction = {
//     id: string
//     name: string
//     label_th: string | null
//     label_en: string | null
//     sort_order: number
//     default_gift_id?: number | null
//     image_url?: string | null
// }

// type Props = {
//     orderId: string
//     productName: string
//     whitelistedUsername: string | null
//     functions: ProductFunction[]
//     gifts: Gift[]
//     savedMapping: Record<string, number>
//     savedTiktokUsername?: string | null
//     locale: string
//     isPremium: boolean
//     premiumAddonPrice: number
// }

// export default function GameSettingsClient({
//     orderId, productName, whitelistedUsername, functions, gifts,
//     savedMapping, savedTiktokUsername, locale, isPremium, premiumAddonPrice,
// }: Props) {
//     const router = useRouter()
//     const searchParams = useSearchParams()
//     const t = useTranslations("Setting")
//     const tModal = useTranslations("ProductModal")

//     useEffect(() => {
//         if (searchParams?.get("upgrade") === "success") {
//             alert(t("upgradeSuccess") || "Upgrade Successful!")
//             window.history.replaceState({}, '', window.location.pathname)
//         }
//     }, [searchParams, t])

//     const [showUpgradeModal, setShowUpgradeModal] = useState(false)
//     const [paymentMethod, setPaymentMethod] = useState<"card" | "promptpay">("promptpay")
//     const [upgrading, setUpgrading] = useState(false)
//     const [showKey, setShowKey] = useState(false)
//     const [copied, setCopied] = useState(false)
//     const [saving, setSaving] = useState(false)
//     const [openPicker, setOpenPicker] = useState<string | null>(null)
//     const [searchQuery, setSearchQuery] = useState("")
//     const [tiktokUsername, setTiktokUsername] = useState(savedTiktokUsername ?? "")

//     const effectiveMapping = useMemo(() => {
//         if (!isPremium) {
//             const dm: Record<string, number> = {}
//             functions.forEach(fn => { if (fn.default_gift_id) dm[fn.id] = fn.default_gift_id })
//             return dm
//         }
//         if (Object.keys(savedMapping).length > 0) return savedMapping
//         const dm: Record<string, number> = {}
//         functions.forEach(fn => { if (fn.default_gift_id) dm[fn.id] = fn.default_gift_id })
//         return dm
//     }, [isPremium, savedMapping, functions])

//     const [mapping, setMapping] = useState<Record<string, number>>(effectiveMapping)
//     useEffect(() => { setMapping(effectiveMapping) }, [effectiveMapping])

//     const handleCopy = () => {
//         navigator.clipboard.writeText(orderId)
//         setCopied(true)
//         setTimeout(() => setCopied(false), 2000)
//     }

//     const selectGift = (functionId: string, giftId: number) => {
//         if (!isPremium) return
//         setMapping(prev => ({ ...prev, [functionId]: giftId }))
//         setOpenPicker(null)
//         setSearchQuery("")
//     }

//     const togglePicker = (functionId: string) => {
//         if (!isPremium) return
//         setOpenPicker(prev => prev === functionId ? null : functionId)
//         setSearchQuery("")
//     }

//     const clearGift = (functionId: string) => {
//         if (!isPremium) return
//         setMapping(prev => { const n = { ...prev }; delete n[functionId]; return n })
//     }

//     const handleUpgrade = async () => {
//         try {
//             setUpgrading(true)
//             const res = await fetch(`/api/orders/${orderId}/upgrade`, {
//                 method: "POST",
//                 headers: { "Content-Type": "application/json" },
//                 body: JSON.stringify({ paymentMethod, locale })
//             })
//             const data = await res.json()
//             if (data.url) window.location.href = data.url
//             else alert(data.error || "Upgrade failed")
//         } catch { alert("Connection error") }
//         finally { setUpgrading(false) }
//     }

//     const handleSave = async () => {
//         try {
//             setSaving(true)
//             const res = await fetch(`/api/orders/${orderId}/settings`, {
//                 method: "POST",
//                 headers: { "Content-Type": "application/json" },
//                 body: JSON.stringify({ mapping, tiktok_username: tiktokUsername.trim() || null }),
//             })
//             if (!res.ok) throw new Error()
//             router.refresh()
//             alert(t("saveSuccess") || "Saved successfully")
//         } catch { alert(t("saveFailed")) }
//         finally { setSaving(false) }
//     }

//     const getGift = (giftId: number) => gifts.find(g => g.id === giftId)

//     const filteredGifts = useMemo(() => {
//         const q = searchQuery.toLowerCase().trim()
//         if (!q) return gifts
//         return gifts.filter(g => g.name.toLowerCase().includes(q) || String(g.id).includes(q))
//     }, [gifts, searchQuery])

//     const maskedKey = "•".repeat(orderId.length)

//     return (
//         <div className="min-h-screen bg-bg-base">
//             <div className="max-w-6xl mx-auto px-4 py-8">

//                 {/* ── Header ── */}
//                 <div className="mb-6">
//                     <button onClick={() => router.back()} className="text-[12px] text-text-muted hover:text-text-base mb-3 flex items-center gap-1 transition">
//                         ← {t("back")}
//                     </button>
//                     <div className="flex items-center justify-between flex-wrap gap-3">
//                         <div>
//                             <h1 className="text-[22px] font-bold">{t("title")}</h1>
//                             <p className="text-[13px] text-text-muted mt-0.5">{t("subtitle")}</p>
//                         </div>
//                         {/* Premium Badge */}
//                         {isPremium ? (
//                             <span className="flex items-center gap-1.5 text-[11px] font-bold bg-accent/15 text-accent-light px-3 py-1.5 rounded-full border border-accent/25 uppercase tracking-wide">
//                                 <span className="w-1.5 h-1.5 rounded-full bg-accent-light" />
//                                 Premium
//                             </span>
//                         ) : (
//                             <button onClick={() => setShowUpgradeModal(true)} className="flex items-center gap-1.5 text-[11px] font-bold bg-accent text-white px-3 py-1.5 rounded-full hover:opacity-90 transition shadow-lg shadow-accent/20">
//                                 ⭐ {t("buyPremium")}
//                             </button>
//                         )}
//                     </div>
//                 </div>

//                 {/* ── 2-Column Layout ── */}
//                 <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-5">

//                     {/* ══ LEFT COLUMN ══ */}
//                     <div className="space-y-4">

//                         {/* Game Info */}
//                         <div className="bg-bg-card border border-accent/15 rounded-2xl p-4 space-y-3">
//                             <p className="text-[10px] text-text-muted uppercase tracking-widest font-medium">{t("game")}</p>
//                             <p className="text-[16px] font-bold text-text-base">{productName}</p>
//                             <div className="border-t border-accent/8 pt-3">
//                                 <p className="text-[10px] text-text-muted uppercase tracking-widest mb-1">{t("whitelist_label") || "Whitelist"}</p>
//                                 <p className="font-mono text-[15px] font-bold text-accent-light">{whitelistedUsername ?? "—"}</p>
//                             </div>
//                             {!isPremium && (
//                                 <div className="bg-accent/8 border border-accent/20 rounded-xl p-3 flex items-center justify-between gap-2">
//                                     <div>
//                                         <p className="text-[12px] font-bold text-accent-light leading-tight">{t("upgradePremium")}</p>
//                                         <p className="text-[10px] text-text-muted mt-0.5">{t("upgradeUnlock")}</p>
//                                     </div>
//                                     <button onClick={() => setShowUpgradeModal(true)} className="bg-accent text-white text-[10px] font-bold px-2.5 py-1.5 rounded-lg hover:opacity-90 transition flex-shrink-0">
//                                         {t("buyPremium")}
//                                     </button>
//                                 </div>
//                             )}
//                         </div>

//                         {/* TikTok + Key */}
//                         <div className="bg-bg-card border border-accent/10 rounded-2xl p-4 space-y-4">

//                             {/* TikTok */}
//                             <div className="space-y-2">
//                                 <div className="flex items-center gap-2">
//                                     <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" className="text-accent-light flex-shrink-0">
//                                         <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.78 1.52V6.76a4.85 4.85 0 0 1-1.01-.07z"/>
//                                     </svg>
//                                     <p className="text-[12px] font-semibold">{t("tiktok_username_label")}</p>
//                                 </div>
//                                 <div className="relative">
//                                     <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-[13px]">@</span>
//                                     <input
//                                         value={tiktokUsername}
//                                         onChange={e => setTiktokUsername(e.target.value.replace("@", ""))}
//                                         placeholder={t("tiktok_username_placeholder")}
//                                         className="w-full bg-bg-base border border-accent/15 rounded-xl pl-7 pr-4 py-2 text-[13px] placeholder:text-text-muted outline-none focus:border-accent/40 transition"
//                                     />
//                                 </div>
//                                 <p className="text-[10px] text-text-muted">{t("tiktok_username_hint")}</p>
//                             </div>

//                             <div className="border-t border-accent/5" />

//                             {/* Program Key */}
//                             <div className="space-y-2">
//                                 <div className="flex items-center gap-2">
//                                     <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-accent-light flex-shrink-0">
//                                         <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
//                                     </svg>
//                                     <p className="text-[12px] font-semibold">{t("program_key") || "Program Key"}</p>
//                                 </div>
//                                 <div className="flex items-center gap-2">
//                                     <div className="relative flex-1">
//                                         <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-[12px]">#</span>
//                                         <input
//                                             value={showKey ? orderId : maskedKey}
//                                             readOnly
//                                             className="w-full bg-bg-base border border-accent/15 rounded-xl pl-6 pr-9 py-2 text-[12px] text-accent-light outline-none font-mono tracking-wider"
//                                         />
//                                         <button onClick={() => setShowKey(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-base transition">
//                                             {showKey ? (
//                                                 <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
//                                                     <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/>
//                                                 </svg>
//                                             ) : (
//                                                 <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
//                                                     <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
//                                                 </svg>
//                                             )}
//                                         </button>
//                                     </div>
//                                     <button onClick={handleCopy} className={`flex items-center gap-1 px-3 py-2 rounded-xl text-[11px] font-bold transition flex-shrink-0 ${copied ? "bg-green-500/15 text-green-400 border border-green-500/20" : "bg-accent/10 hover:bg-accent/20 text-accent-light border border-accent/15"}`}>
//                                         {copied ? (
//                                             <><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>{t("copied") || "Copied"}</>
//                                         ) : (
//                                             <><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>{t("copy") || "Copy"}</>
//                                         )}
//                                     </button>
//                                 </div>
//                                 <p className="text-[10px] text-text-muted">{t("key_label")}</p>
//                             </div>
//                         </div>

//                         {/* Download App */}
//                         <div className="bg-bg-card border border-accent/10 rounded-2xl overflow-hidden">
//                             <div className="relative bg-gradient-to-r from-accent/20 via-accent/10 to-transparent px-4 py-3 border-b border-accent/10 overflow-hidden">
//                                 <div className="absolute -top-4 -right-4 w-24 h-24 rounded-full bg-accent/10 blur-2xl pointer-events-none" />
//                                 <div className="flex items-center gap-2">
//                                     <div className="w-6 h-6 rounded-lg bg-accent/20 border border-accent/30 flex items-center justify-center">
//                                         <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-accent-light">
//                                             <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>
//                                         </svg>
//                                     </div>
//                                     <div>
//                                         <p className="text-[12px] font-bold">{t("downloadApp") || "โปรแกรมของร้าน"}</p>
//                                         <p className="text-[10px] text-text-muted">{t("downloadAppSub") || "สำหรับ TikTok Live"}</p>
//                                     </div>
//                                 </div>
//                             </div>
//                             <div className="p-4 space-y-3">
//                                 <div className="flex items-center gap-3">
//                                     <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-accent/20 to-accent/5 border border-accent/20 flex items-center justify-center flex-shrink-0">
//                                         <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-accent-light">
//                                             <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>
//                                         </svg>
//                                     </div>
//                                     <div className="flex-1 min-w-0">
//                                         <div className="flex items-center gap-2">
//                                             <p className="text-[13px] font-bold">AclassStore Live</p>
//                                             <span className="text-[9px] font-bold bg-accent/15 text-accent-light px-1.5 py-0.5 rounded border border-accent/20">v3.0</span>
//                                         </div>
//                                         <p className="text-[10px] text-text-muted mt-0.5">{t("downloadDesc") || "จัดการร้านค้า · TikTok Live"}</p>
//                                         <div className="flex items-center gap-1.5 mt-1">
//                                             <span className="text-[9px] text-text-muted bg-white/5 px-1.5 py-0.5 rounded-full">Windows</span>
//                                             <span className="text-[9px] text-text-muted">.exe · 45 MB</span>
//                                         </div>
//                                     </div>
//                                 </div>
//                                 <a href="https://github.com/alongkon2103/AclassStore-Live/releases/latest/download/AclassStoreLiveV3.exe" download className="w-full flex items-center justify-center gap-2 py-2.5 bg-accent hover:opacity-90 active:scale-[0.98] text-white text-[12px] font-bold rounded-xl transition-all shadow-lg shadow-accent/20">
//                                     <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
//                                         <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
//                                     </svg>
//                                     {t("download") || "ดาวน์โหลดโปรแกรม"}
//                                 </a>
//                                 <div className="flex items-start gap-1.5">
//                                     <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-yellow-500/70 flex-shrink-0 mt-0.5">
//                                         <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
//                                     </svg>
//                                     <p className="text-[10px] text-text-muted leading-relaxed">{t("downloadHint") || "Windows อาจแจ้งเตือน ให้กด \"Keep anyway\""}</p>
//                                 </div>
//                             </div>
//                         </div>

//                         {/* Save Button (desktop: in left col) */}
//                         {functions.length > 0 && (
//                             <button onClick={handleSave} disabled={saving} className="hidden lg:flex w-full py-3 rounded-2xl font-bold text-[14px] bg-accent hover:opacity-90 text-white transition items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-accent/20">
//                                 {saving && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
//                                 {saving ? t("saving") : t("save")}
//                             </button>
//                         )}
//                     </div>

//                     {/* ══ RIGHT COLUMN — Function List ══ */}
//                     <div className="space-y-3">
//                         <div className="flex items-center justify-between px-1">
//                             <p className="text-[11px] text-text-muted uppercase tracking-widest font-medium">{t("selectGiftForFunction")}</p>
//                             {isPremium && Object.keys(mapping).length > 0 && (
//                                 <button onClick={() => { if (confirm(t("confirm_clear_all") || "Clear all?")) setMapping({}) }} className="text-[11px] text-red-400 hover:text-red-500 font-medium transition">
//                                     {t("clear_all") || "Clear All"}
//                                 </button>
//                             )}
//                         </div>

//                         {functions.length === 0 ? (
//                             <div className="text-center py-16 bg-bg-card border border-accent/10 rounded-2xl text-text-muted text-[13px]">
//                                 {t("noFunctions")}
//                             </div>
//                         ) : (
//                             functions.map(fn => {
//                                 const selectedGiftId = mapping[fn.id]
//                                 const selectedGift = selectedGiftId ? getGift(selectedGiftId) : null
//                                 const isOpen = openPicker === fn.id

//                                 return (
//                                     <div key={fn.id} className="bg-bg-card border border-accent/10 rounded-2xl overflow-hidden transition-all">
//                                         <div className="flex items-center gap-3 p-4">
//                                             <div className="flex-1 flex items-center gap-3 min-w-0">
//                                                 {fn.image_url && (
//                                                     <div className="w-8 h-8 rounded-lg overflow-hidden border border-white/5 bg-bg-base flex-shrink-0">
//                                                         <Image src={getImageUrl(fn.image_url)} alt="" width={32} height={32} className="w-full h-full object-cover" unoptimized />
//                                                     </div>
//                                                 )}
//                                                 <div className="min-w-0">
//                                                     <p className="text-[13px] font-bold text-text-base truncate">{locale === "th" ? fn.label_th : fn.label_en}</p>
//                                                     <p className="font-mono text-[10px] text-accent-light/70 tracking-wider uppercase">{fn.name}</p>
//                                                 </div>
//                                             </div>

//                                             <button onClick={() => togglePicker(fn.id)} disabled={!isPremium}
//                                                 className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition min-w-[140px] justify-between flex-shrink-0 ${selectedGift ? "border-accent/40 bg-accent/5 text-accent-light" : "border-white/10 bg-bg-base text-text-muted"} ${!isPremium ? "cursor-default opacity-80" : ""}`}>
//                                                 <div className="flex items-center gap-2 overflow-hidden">
//                                                     {!isPremium && !selectedGift && <span className="text-[10px] font-bold bg-white/5 px-1.5 py-0.5 rounded text-text-muted">LOCKED</span>}
//                                                     {selectedGift ? (
//                                                         <>
//                                                             {selectedGift.image_url ? <Image src={getImageUrl(selectedGift.image_url)} alt="" width={16} height={16} className="rounded object-cover flex-shrink-0" unoptimized /> : <span>🎁</span>}
//                                                             <span className="text-[12px] font-medium truncate">{selectedGift.name}</span>
//                                                             {(!isPremium || (Object.keys(savedMapping).length === 0 && selectedGiftId === fn.default_gift_id)) && <span className="text-[9px] bg-accent/10 px-1 rounded flex-shrink-0">DEFAULT</span>}
//                                                         </>
//                                                     ) : (
//                                                         <span className="text-[12px]">{t("selectGift")}</span>
//                                                     )}
//                                                 </div>
//                                                 {isPremium && <ChevronIcon size={13} className={isOpen ? "rotate-180" : ""} />}
//                                             </button>

//                                             {selectedGift && isPremium && (
//                                                 <button onClick={() => clearGift(fn.id)} className="text-text-muted hover:text-red-400 p-1 transition flex-shrink-0">
//                                                     <CloseIcon size={16} />
//                                                 </button>
//                                             )}
//                                         </div>

//                                         {isOpen && (
//                                             <div className="border-t border-accent/10 bg-bg-base/40 p-3 space-y-3">
//                                                 <div className="relative">
//                                                     <input autoFocus type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder={t("searchPlaceholder")}
//                                                         className="w-full bg-bg-card border border-accent/20 rounded-xl pl-9 pr-4 py-2 text-[13px] outline-none focus:border-accent/50 transition" />
//                                                     <SearchIcon className="absolute left-3 top-2.5 text-text-muted" size={16} />
//                                                 </div>
//                                                 <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 max-h-[220px] overflow-y-auto pr-1">
//                                                     {filteredGifts.map(gift => (
//                                                         <button key={gift.id} onClick={() => selectGift(fn.id, gift.id)}
//                                                             className={`flex flex-col items-center gap-1.5 p-2 rounded-xl border transition ${selectedGiftId === gift.id ? "border-accent bg-accent/10" : "border-white/5 bg-bg-card hover:border-accent/30"}`}>
//                                                             <div className="w-8 h-8 flex items-center justify-center">
//                                                                 {gift.image_url ? <Image src={getImageUrl(gift.image_url)} alt="" width={32} height={32} className="rounded object-cover" unoptimized /> : <span className="text-[20px]">🎁</span>}
//                                                             </div>
//                                                             <p className="text-[10px] font-medium leading-tight line-clamp-1 text-center">{gift.name}</p>
//                                                             <p className="text-[9px] text-text-muted">💎{gift.diamonds}</p>
//                                                         </button>
//                                                     ))}
//                                                     {filteredGifts.length === 0 && <div className="col-span-full py-8 text-center text-text-muted text-[12px]">{t("noResults")}</div>}
//                                                 </div>
//                                             </div>
//                                         )}
//                                     </div>
//                                 )
//                             })
//                         )}

//                         {/* Save Button (mobile: in right col bottom) */}
//                         {functions.length > 0 && (
//                             <button onClick={handleSave} disabled={saving} className="lg:hidden w-full py-3.5 rounded-2xl font-bold text-[15px] bg-accent hover:opacity-90 text-white transition flex items-center justify-center gap-2 disabled:opacity-50">
//                                 {saving && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
//                                 {saving ? t("saving") : t("save")}
//                             </button>
//                         )}
//                     </div>
//                 </div>
//             </div>

//             {/* Upgrade Modal */}
//             <AnimatePresence>
//                 {showUpgradeModal && (
//                     <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
//                         <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowUpgradeModal(false)} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
//                         <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }}
//                             className="relative w-full max-w-md bg-bg-card border border-accent/20 rounded-3xl overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
//                             <div className="p-6 space-y-5">
//                                 <div className="flex items-center justify-between">
//                                     <h2 className="text-[18px] font-bold">{t("upgradePremium")}</h2>
//                                     <button onClick={() => setShowUpgradeModal(false)} className="text-text-muted hover:text-text-base transition"><CloseIcon size={20} /></button>
//                                 </div>
//                                 <div className="bg-accent/5 border border-accent/10 rounded-2xl p-4 flex items-center justify-between">
//                                     <div>
//                                         <p className="text-[14px] font-bold">{t("premiumLifetime")}</p>
//                                         <p className="text-[11px] text-text-muted">{t("premiumLifetimeDesc")}</p>
//                                     </div>
//                                     <p className="text-[18px] font-bold text-accent-light">฿{premiumAddonPrice.toLocaleString()}</p>
//                                 </div>
//                                 <div className="space-y-2">
//                                     <p className="text-[11px] tracking-widest text-text-muted uppercase font-medium">{tModal("payment_method")}</p>
//                                     <div className="grid grid-cols-2 gap-2">
//                                         <button onClick={() => setPaymentMethod("promptpay")} className={`p-3 rounded-xl border text-left transition ${paymentMethod === "promptpay" ? "border-accent bg-accent/10 text-accent-light" : "border-white/10"}`}>
//                                             <p className="text-[13px] font-medium">{tModal("promptpay_label")}</p>
//                                             <p className="text-[10px] text-green-400 opacity-80">{tModal("promptpay_desc")}</p>
//                                         </button>
//                                         <button onClick={() => setPaymentMethod("card")} className={`p-3 rounded-xl border text-left transition ${paymentMethod === "card" ? "border-accent bg-accent/10 text-accent-light" : "border-white/10"}`}>
//                                             <p className="text-[13px] font-medium">{tModal("stripe_label")}</p>
//                                             <p className="text-[10px] text-orange-400 opacity-80">{tModal("stripe_desc")}</p>
//                                         </button>
//                                     </div>
//                                 </div>
//                                 <button disabled={upgrading} onClick={handleUpgrade} className="w-full py-4 bg-accent hover:opacity-90 text-white font-bold rounded-2xl transition shadow-lg shadow-accent/20 flex items-center justify-center gap-2 disabled:opacity-50">
//                                     {upgrading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <>{t("proceedToCheckout")} (฿{(paymentMethod === "card" ? premiumAddonPrice * 1.06 : premiumAddonPrice).toLocaleString()})</>}
//                                 </button>
//                                 <p className="text-[10px] text-center text-text-muted px-4">{t("upgradeNote")}</p>
//                             </div>
//                         </motion.div>
//                     </div>
//                 )}
//             </AnimatePresence>
//         </div>
//     )
// }

// function ChevronIcon({ size = 16, className = "" }: { size?: number; className?: string }) {
//     return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform duration-200 ${className}`}><polyline points="6 9 12 15 18 9"/></svg>
// }
// function SearchIcon({ size = 16, className = "" }: { size?: number; className?: string }) {
//     return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
// }
// function CloseIcon({ size = 16 }: { size?: number }) {
//     return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
// }


// "use client"

// import { useState, useMemo, useEffect } from "react"
// import { useRouter, useSearchParams } from "next/navigation"
// import Image from "next/image"
// import { useTranslations, useLocale } from "next-intl"
// import { getImageUrl } from "@/lib/getImageUrl"
// import { motion, AnimatePresence } from "framer-motion"

// type Gift = {
//     id: number
//     name: string
//     image_url: string | null
//     diamonds: number
// }

// type ProductFunction = {
//     id: string
//     name: string
//     label_th: string | null
//     label_en: string | null
//     sort_order: number
//     default_gift_id?: number | null
//     image_url?: string | null
// }

// type Props = {
//     orderId: string
//     productName: string
//     whitelistedUsername: string | null
//     functions: ProductFunction[]
//     gifts: Gift[]
//     savedMapping: Record<string, number>
//     savedTiktokUsername?: string | null
//     locale: string
//     isPremium: boolean
//     premiumAddonPrice: number
// }

// export default function GameSettingsClient({
//     orderId, productName, whitelistedUsername, functions, gifts,
//     savedMapping, savedTiktokUsername, locale, isPremium, premiumAddonPrice,
// }: Props) {
//     const router = useRouter()
//     const searchParams = useSearchParams()
//     const t = useTranslations("Setting")
//     const tModal = useTranslations("ProductModal")

//     useEffect(() => {
//         if (searchParams?.get("upgrade") === "success") {
//             alert(t("upgradeSuccess") || "Upgrade Successful!")
//             window.history.replaceState({}, '', window.location.pathname)
//         }
//     }, [searchParams, t])

//     const [showUpgradeModal, setShowUpgradeModal] = useState(false)
//     const [paymentMethod, setPaymentMethod] = useState<"card" | "promptpay">("promptpay")
//     const [upgrading, setUpgrading] = useState(false)
//     const [showKey, setShowKey] = useState(false)
//     const [copied, setCopied] = useState(false)
//     const [saving, setSaving] = useState(false)
//     const [openPicker, setOpenPicker] = useState<string | null>(null)
//     const [searchQuery, setSearchQuery] = useState("")
//     const [tiktokUsername, setTiktokUsername] = useState(savedTiktokUsername ?? "")

//     // สร้าง Default Mapping Helper
//     const getDefaultMapping = () => {
//         const dm: Record<string, number> = {}
//         functions.forEach(fn => { if (fn.default_gift_id) dm[fn.id] = fn.default_gift_id })
//         return dm
//     }

//     const effectiveMapping = useMemo(() => {
//         if (!isPremium) return getDefaultMapping()
//         if (Object.keys(savedMapping).length > 0) return savedMapping
//         return getDefaultMapping()
//     }, [isPremium, savedMapping, functions])

//     const [mapping, setMapping] = useState<Record<string, number>>(effectiveMapping)
//     useEffect(() => { setMapping(effectiveMapping) }, [effectiveMapping])

//     const handleCopy = () => {
//         navigator.clipboard.writeText(orderId)
//         setCopied(true)
//         setTimeout(() => setCopied(false), 2000)
//     }

//     const selectGift = (functionId: string, giftId: number) => {
//         if (!isPremium) return
//         setMapping(prev => ({ ...prev, [functionId]: giftId }))
//         setOpenPicker(null)
//         setSearchQuery("")
//     }

//     const togglePicker = (functionId: string) => {
//         if (!isPremium) return
//         setOpenPicker(prev => prev === functionId ? null : functionId)
//         setSearchQuery("")
//     }

//     // แก้ไข: ให้กลับไปเป็นค่า Default แทนการลบออก
//     const clearGift = (functionId: string) => {
//         if (!isPremium) return
//         const fn = functions.find(f => f.id === functionId)
//         setMapping(prev => {
//             const n = { ...prev }
//             if (fn?.default_gift_id) {
//                 n[functionId] = fn.default_gift_id
//             } else {
//                 delete n[functionId]
//             }
//             return n
//         })
//     }

//     // แก้ไข: ให้ Clear All แล้วกลับไปเป็นค่า Default ทั้งหมด
//     const handleClearAll = () => {
//         if (confirm(t("confirm_clear_all") || "Clear all and reset to default?")) {
//             setMapping(getDefaultMapping())
//         }
//     }

//     const handleUpgrade = async () => {
//         try {
//             setUpgrading(true)
//             const res = await fetch(`/api/orders/${orderId}/upgrade`, {
//                 method: "POST",
//                 headers: { "Content-Type": "application/json" },
//                 body: JSON.stringify({ paymentMethod, locale })
//             })
//             const data = await res.json()
//             if (data.url) window.location.href = data.url
//             else alert(data.error || "Upgrade failed")
//         } catch { alert("Connection error") }
//         finally { setUpgrading(false) }
//     }

//     const handleSave = async () => {
//         try {
//             setSaving(true)
//             const res = await fetch(`/api/orders/${orderId}/settings`, {
//                 method: "POST",
//                 headers: { "Content-Type": "application/json" },
//                 body: JSON.stringify({ mapping, tiktok_username: tiktokUsername.trim() || null }),
//             })
//             if (!res.ok) throw new Error()
//             router.refresh()
//             alert(t("saveSuccess") || "Saved successfully")
//         } catch { alert(t("saveFailed")) }
//         finally { setSaving(false) }
//     }

//     const getGift = (giftId: number) => gifts.find(g => g.id === giftId)

//     const filteredGifts = useMemo(() => {
//         const q = searchQuery.toLowerCase().trim()
//         if (!q) return gifts
//         return gifts.filter(g => g.name.toLowerCase().includes(q) || String(g.id).includes(q))
//     }, [gifts, searchQuery])

//     const maskedKey = "•".repeat(orderId.length)

//     return (
//         <div className="min-h-screen bg-bg-base text-text-base">
//             <div className="max-w-6xl mx-auto px-4 py-8">

//                 {/* ── Header ── */}
//                 <div className="mb-6">
//                     <button onClick={() => router.back()} className="text-[12px] text-text-muted hover:text-text-base mb-3 flex items-center gap-1 transition">
//                         ← {t("back")}
//                     </button>
//                     <div className="flex items-center justify-between flex-wrap gap-3">
//                         <div>
//                             <h1 className="text-[22px] font-bold">{t("title")}</h1>
//                             <p className="text-[13px] text-text-muted mt-0.5">{t("subtitle")}</p>
//                         </div>
//                         {isPremium ? (
//                             <span className="flex items-center gap-1.5 text-[11px] font-bold bg-accent/15 text-accent-light px-3 py-1.5 rounded-full border border-accent/25 uppercase tracking-wide">
//                                 <span className="w-1.5 h-1.5 rounded-full bg-accent-light" />
//                                 Premium
//                             </span>
//                         ) : (
//                             <button onClick={() => setShowUpgradeModal(true)} className="flex items-center gap-1.5 text-[11px] font-bold bg-accent text-white px-3 py-1.5 rounded-full hover:opacity-90 transition shadow-lg shadow-accent/20">
//                                 {t("buyPremium")}
//                             </button>
//                         )}
//                     </div>
//                 </div>

//                 <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-5">

//                     {/* ══ LEFT COLUMN ══ */}
//                     <div className="space-y-4">
//                         {/* Game Info */}
//                         <div className="bg-bg-card border border-accent/15 rounded-2xl p-4 space-y-3">
//                             <p className="text-[10px] text-text-muted uppercase tracking-widest font-medium">{t("game")}</p>
//                             <p className="text-[16px] font-bold text-text-base">{productName}</p>
//                             <div className="border-t border-accent/8 pt-3">
//                                 <p className="text-[10px] text-text-muted uppercase tracking-widest mb-1">{t("whitelist_label") || "Whitelist"}</p>
//                                 <p className="font-mono text-[15px] font-bold text-accent-light">{whitelistedUsername ?? "—"}</p>
//                             </div>
//                             {!isPremium && (
//                                 <div className="bg-accent/8 border border-accent/20 rounded-xl p-3 flex items-center justify-between gap-2">
//                                     <div className="min-w-0">
//                                         <p className="text-[12px] font-bold text-accent-light leading-tight line-clamp-1">{t("upgradePremium")}</p>
//                                         <p className="text-[10px] text-text-muted mt-0.5 line-clamp-1">{t("upgradeUnlock")}</p>
//                                     </div>
//                                     <button onClick={() => setShowUpgradeModal(true)} className="bg-accent text-white text-[10px] font-bold px-2.5 py-1.5 rounded-lg hover:opacity-90 transition flex-shrink-0">
//                                         {t("buyPremium")}
//                                     </button>
//                                 </div>
//                             )}
//                         </div>

//                         {/* TikTok + Key */}
//                         <div className="bg-bg-card border border-accent/10 rounded-2xl p-4 space-y-4">
//                             <div className="space-y-2">
//                                 <div className="flex items-center gap-2">
//                                     <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" className="text-accent-light flex-shrink-0">
//                                         <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.78 1.52V6.76a4.85 4.85 0 0 1-1.01-.07z"/>
//                                     </svg>
//                                     <p className="text-[12px] font-semibold">{t("tiktok_username_label")}</p>
//                                 </div>
//                                 <div className="relative">
//                                     <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-[13px]">@</span>
//                                     <input
//                                         value={tiktokUsername}
//                                         onChange={e => setTiktokUsername(e.target.value.replace("@", ""))}
//                                         placeholder={t("tiktok_username_placeholder")}
//                                         className="w-full bg-bg-base border border-accent/15 rounded-xl pl-7 pr-4 py-2 text-[13px] placeholder:text-text-muted outline-none focus:border-accent/40 transition"
//                                     />
//                                 </div>
//                                 <p className="text-[10px] text-text-muted">{t("tiktok_username_hint")}</p>
//                             </div>

//                             <div className="border-t border-accent/5" />

//                             <div className="space-y-2">
//                                 <div className="flex items-center gap-2">
//                                     <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-accent-light flex-shrink-0">
//                                         <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
//                                     </svg>
//                                     <p className="text-[12px] font-semibold">{t("program_key") || "Program Key"}</p>
//                                 </div>
//                                 <div className="flex items-center gap-2">
//                                     <div className="relative flex-1">
//                                         <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-[12px]">#</span>
//                                         <input
//                                             value={showKey ? orderId : maskedKey}
//                                             readOnly
//                                             className="w-full bg-bg-base border border-accent/15 rounded-xl pl-6 pr-9 py-2 text-[12px] text-accent-light outline-none font-mono tracking-wider"
//                                         />
//                                         <button onClick={() => setShowKey(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-base transition">
//                                             {showKey ? (
//                                                 <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
//                                                     <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/>
//                                                 </svg>
//                                             ) : (
//                                                 <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
//                                                     <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
//                                                 </svg>
//                                             )}
//                                         </button>
//                                     </div>
//                                     <button onClick={handleCopy} className={`flex items-center gap-1 px-3 py-2 rounded-xl text-[11px] font-bold transition flex-shrink-0 ${copied ? "bg-green-500/15 text-green-400 border border-green-500/20" : "bg-accent/10 hover:bg-accent/20 text-accent-light border border-accent/15"}`}>
//                                         {copied ? <>{t("copied") || "Copied"}</> : <>{t("copy") || "Copy"}</>}
//                                     </button>
//                                 </div>
//                                 <p className="text-[10px] text-text-muted">{t("key_label")}</p>
//                             </div>
//                         </div>

//                         {/* Download App */}
//                         <div className="bg-bg-card border border-accent/10 rounded-2xl overflow-hidden">
//                             <div className="relative bg-gradient-to-r from-accent/20 via-accent/10 to-transparent px-4 py-3 border-b border-accent/10 overflow-hidden">
//                                 <div className="absolute -top-4 -right-4 w-24 h-24 rounded-full bg-accent/10 blur-2xl pointer-events-none" />
//                                 <div className="flex items-center gap-2">
//                                     <div className="w-6 h-6 rounded-lg bg-accent/20 border border-accent/30 flex items-center justify-center">
//                                         <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-accent-light">
//                                             <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>
//                                         </svg>
//                                     </div>
//                                     <div>
//                                         <p className="text-[12px] font-bold">{t("downloadApp") || "โปรแกรมของร้าน"}</p>
//                                         <p className="text-[10px] text-text-muted">{t("downloadAppSub") || "สำหรับ TikTok Live"}</p>
//                                     </div>
//                                 </div>
//                             </div>
//                             <div className="p-4 space-y-3">
//                                 <div className="flex items-center gap-3">
//                                     <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-accent/20 to-accent/5 border border-accent/20 flex items-center justify-center flex-shrink-0">
//                                         <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-accent-light">
//                                             <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>
//                                         </svg>
//                                     </div>
//                                     <div className="flex-1 min-w-0">
//                                         <div className="flex items-center gap-2">
//                                             <p className="text-[13px] font-bold">AclassStore Live</p>
//                                             <span className="text-[9px] font-bold bg-accent/15 text-accent-light px-1.5 py-0.5 rounded border border-accent/20">v3.0</span>
//                                         </div>
//                                         <p className="text-[10px] text-text-muted mt-0.5 line-clamp-1">{t("downloadDesc") || "จัดการร้านค้า · TikTok Live"}</p>
//                                     </div>
//                                 </div>
//                                 <a href="https://github.com/alongkon2103/AclassStore-Live/releases/latest/download/AclassStoreLiveV3.exe" download className="w-full flex items-center justify-center gap-2 py-2.5 bg-accent hover:opacity-90 active:scale-[0.98] text-white text-[12px] font-bold rounded-xl transition-all shadow-lg shadow-accent/20">
//                                     {t("download") || "ดาวน์โหลดโปรแกรม"}
//                                 </a>
//                             </div>
//                         </div>

//                         {/* Save Button (desktop) */}
//                         {functions.length > 0 && (
//                             <button onClick={handleSave} disabled={saving} className="hidden lg:flex w-full py-3 rounded-2xl font-bold text-[14px] bg-accent hover:opacity-90 text-white transition items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-accent/20">
//                                 {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : null}
//                                 {saving ? t("saving") : t("save")}
//                             </button>
//                         )}
//                     </div>

//                     {/* ══ RIGHT COLUMN — Function List ══ */}
//                     <div className="space-y-3">
//                         <div className="flex items-center justify-between px-1">
//                             <p className="text-[11px] text-text-muted uppercase tracking-widest font-medium">{t("selectGiftForFunction")}</p>
//                             {isPremium && (
//                                 <button onClick={handleClearAll} className="text-[11px] text-red-400 hover:text-red-500 font-medium transition">
//                                     {t("clear_all") || "Reset to Default"}
//                                 </button>
//                             )}
//                         </div>

//                         {functions.length === 0 ? (
//                             <div className="text-center py-16 bg-bg-card border border-accent/10 rounded-2xl text-text-muted text-[13px]">
//                                 {t("noFunctions")}
//                             </div>
//                         ) : (
//                             functions.map(fn => {
//                                 const selectedGiftId = mapping[fn.id]
//                                 const selectedGift = selectedGiftId ? getGift(selectedGiftId) : null
//                                 const isOpen = openPicker === fn.id
//                                 const isDefault = selectedGiftId === fn.default_gift_id

//                                 return (
//                                     <div key={fn.id} className="bg-bg-card border border-accent/10 rounded-2xl overflow-hidden transition-all">
//                                         <div className="flex items-center gap-3 p-4">
//                                             <div className="flex-1 flex items-center gap-3 min-w-0">
//                                                 {fn.image_url && (
//                                                     <div className="w-8 h-8 rounded-lg overflow-hidden border border-white/5 bg-bg-base flex-shrink-0">
//                                                         <Image src={getImageUrl(fn.image_url)} alt="" width={32} height={32} className="w-full h-full object-cover" unoptimized />
//                                                     </div>
//                                                 )}
//                                                 <div className="min-w-0">
//                                                     <p className="text-[13px] font-bold text-text-base truncate">{locale === "th" ? fn.label_th : fn.label_en}</p>
//                                                     <p className="font-mono text-[10px] text-accent-light/70 tracking-wider uppercase">{fn.name}</p>
//                                                 </div>
//                                             </div>

//                                             <button onClick={() => togglePicker(fn.id)} disabled={!isPremium}
//                                                 className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition min-w-[140px] justify-between flex-shrink-0 ${selectedGift ? "border-accent/40 bg-accent/5 text-accent-light" : "border-white/10 bg-bg-base text-text-muted"} ${!isPremium ? "cursor-default opacity-80" : ""}`}>
//                                                 <div className="flex items-center gap-2 overflow-hidden">
//                                                     {!isPremium && !selectedGift && <span className="text-[10px] font-bold bg-white/5 px-1.5 py-0.5 rounded text-text-muted">LOCKED</span>}
//                                                     {selectedGift ? (
//                                                         <>
//                                                             {selectedGift.image_url ? <Image src={getImageUrl(selectedGift.image_url)} alt="" width={16} height={16} className="rounded object-cover flex-shrink-0" unoptimized /> : <span>🎁</span>}
//                                                             <span className="text-[12px] font-medium truncate">{selectedGift.name}</span>
//                                                             {isDefault && <span className="text-[9px] bg-accent/10 px-1 rounded flex-shrink-0">DEFAULT</span>}
//                                                         </>
//                                                     ) : (
//                                                         <span className="text-[12px]">{t("selectGift")}</span>
//                                                     )}
//                                                 </div>
//                                                 {isPremium && <ChevronIcon size={13} className={isOpen ? "rotate-180" : ""} />}
//                                             </button>

//                                             {selectedGift && isPremium && !isDefault && (
//                                                 <button onClick={() => clearGift(fn.id)} className="text-text-muted hover:text-red-400 p-1 transition flex-shrink-0" title="Reset to default">
//                                                     <CloseIcon size={16} />
//                                                 </button>
//                                             )}
//                                         </div>

//                                         {isOpen && (
//                                             <div className="border-t border-accent/10 bg-bg-base/40 p-3 space-y-3">
//                                                 <div className="relative">
//                                                     <input autoFocus type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder={t("searchPlaceholder")}
//                                                         className="w-full bg-bg-card border border-accent/20 rounded-xl pl-9 pr-4 py-2 text-[13px] outline-none focus:border-accent/50 transition" />
//                                                     <SearchIcon className="absolute left-3 top-2.5 text-text-muted" size={16} />
//                                                 </div>
//                                                 <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 max-h-[220px] overflow-y-auto pr-1">
//                                                     {filteredGifts.map(gift => (
//                                                         <button key={gift.id} onClick={() => selectGift(fn.id, gift.id)}
//                                                             className={`flex flex-col items-center gap-1.5 p-2 rounded-xl border transition ${selectedGiftId === gift.id ? "border-accent bg-accent/10" : "border-white/5 bg-bg-card hover:border-accent/30"}`}>
//                                                             <div className="w-8 h-8 flex items-center justify-center">
//                                                                 {gift.image_url ? <Image src={getImageUrl(gift.image_url)} alt="" width={32} height={32} className="rounded object-cover" unoptimized /> : <span className="text-[20px]">🎁</span>}
//                                                             </div>
//                                                             <p className="text-[10px] font-medium leading-tight line-clamp-1 text-center">{gift.name}</p>
//                                                             <p className="text-[9px] text-text-muted">💎{gift.diamonds}</p>
//                                                         </button>
//                                                     ))}
//                                                 </div>
//                                             </div>
//                                         )}
//                                     </div>
//                                 )
//                             })
//                         )}

//                         {/* Save Button (mobile) */}
//                         {functions.length > 0 && (
//                             <button onClick={handleSave} disabled={saving} className="lg:hidden w-full py-3.5 rounded-2xl font-bold text-[15px] bg-accent hover:opacity-90 text-white transition flex items-center justify-center gap-2 disabled:opacity-50">
//                                 {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : null}
//                                 {saving ? t("saving") : t("save")}
//                             </button>
//                         )}
//                     </div>
//                 </div>
//             </div>

//             {/* Upgrade Modal */}
//             <AnimatePresence>
//                 {showUpgradeModal && (
//                     <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
//                         <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowUpgradeModal(false)} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
//                         <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }}
//                             className="relative w-full max-w-md bg-bg-card border border-accent/20 rounded-3xl overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
//                             <div className="p-6 space-y-5">
//                                 <div className="flex items-center justify-between">
//                                     <h2 className="text-[18px] font-bold">{t("upgradePremium")}</h2>
//                                     <button onClick={() => setShowUpgradeModal(false)} className="text-text-muted hover:text-text-base transition"><CloseIcon size={20} /></button>
//                                 </div>
//                                 <div className="bg-accent/5 border border-accent/10 rounded-2xl p-4 flex items-center justify-between">
//                                     <div>
//                                         <p className="text-[14px] font-bold">{t("premiumLifetime")}</p>
//                                         <p className="text-[11px] text-text-muted">{t("premiumLifetimeDesc")}</p>
//                                     </div>
//                                     <p className="text-[18px] font-bold text-accent-light">฿{premiumAddonPrice.toLocaleString()}</p>
//                                 </div>
//                                 <div className="space-y-2">
//                                     <p className="text-[11px] tracking-widest text-text-muted uppercase font-medium">{tModal("payment_method")}</p>
//                                     <div className="grid grid-cols-2 gap-2">
//                                         <button onClick={() => setPaymentMethod("promptpay")} className={`p-3 rounded-xl border text-left transition ${paymentMethod === "promptpay" ? "border-accent bg-accent/10 text-accent-light" : "border-white/10"}`}>
//                                             <p className="text-[13px] font-medium">{tModal("promptpay_label")}</p>
//                                             <p className="text-[10px] text-green-400 opacity-80">{tModal("promptpay_desc")}</p>
//                                         </button>
//                                         <button onClick={() => setPaymentMethod("card")} className={`p-3 rounded-xl border text-left transition ${paymentMethod === "card" ? "border-accent bg-accent/10 text-accent-light" : "border-white/10"}`}>
//                                             <p className="text-[13px] font-medium">{tModal("stripe_label")}</p>
//                                             <p className="text-[10px] text-orange-400 opacity-80">{tModal("stripe_desc")}</p>
//                                         </button>
//                                     </div>
//                                 </div>
//                                 <button disabled={upgrading} onClick={handleUpgrade} className="w-full py-4 bg-accent hover:opacity-90 text-white font-bold rounded-2xl transition shadow-lg shadow-accent/20 flex items-center justify-center gap-2 disabled:opacity-50">
//                                     {upgrading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <>{t("proceedToCheckout")} (฿{(paymentMethod === "card" ? premiumAddonPrice * 1.06 : premiumAddonPrice).toLocaleString()})</>}
//                                 </button>
//                             </div>
//                         </motion.div>
//                     </div>
//                 )}
//             </AnimatePresence>
//         </div>
//     )
// }

// function ChevronIcon({ size = 16, className = "" }: { size?: number; className?: string }) {
//     return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform duration-200 ${className}`}><polyline points="6 9 12 15 18 9"/></svg>
// }
// function SearchIcon({ size = 16, className = "" }: { size?: number; className?: string }) {
//     return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
// }
// function CloseIcon({ size = 16 }: { size?: number }) {
//     return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
// }
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
    orderId, productName, whitelistedUsername, functions, gifts,
    savedMapping, savedTiktokUsername, locale, isPremium, premiumAddonPrice,
}: Props) {
    const router = useRouter()
    const searchParams = useSearchParams()
    const t = useTranslations("Setting")
    const tModal = useTranslations("ProductModal")
    const tD = useTranslations("DownloadModal") // ใช้ตัวแปลสำหรับหน้าดาวน์โหลด

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
    const [openPicker, setOpenPicker] = useState<string | null>(null)
    const [searchQuery, setSearchQuery] = useState("")
    const [tiktokUsername, setTiktokUsername] = useState(savedTiktokUsername ?? "")

    const getDefaultMapping = () => {
        const dm: Record<string, number> = {}
        functions.forEach(fn => { if (fn.default_gift_id) dm[fn.id] = fn.default_gift_id })
        return dm
    }

    const effectiveMapping = useMemo(() => {
        if (!isPremium) return getDefaultMapping()
        if (Object.keys(savedMapping).length > 0) return savedMapping
        return getDefaultMapping()
    }, [isPremium, savedMapping, functions])

    const [mapping, setMapping] = useState<Record<string, number>>(effectiveMapping)
    useEffect(() => { setMapping(effectiveMapping) }, [effectiveMapping])

    const handleCopy = () => {
        navigator.clipboard.writeText(orderId)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    const selectGift = (functionId: string, giftId: number) => {
        if (!isPremium) return
        setMapping(prev => ({ ...prev, [functionId]: giftId }))
        setOpenPicker(null)
        setSearchQuery("")
    }

    const togglePicker = (functionId: string) => {
        if (!isPremium) return
        setOpenPicker(prev => prev === functionId ? null : functionId)
        setSearchQuery("")
    }

    const clearGift = (functionId: string) => {
        if (!isPremium) return
        const fn = functions.find(f => f.id === functionId)
        setMapping(prev => {
            const n = { ...prev }
            if (fn?.default_gift_id) {
                n[functionId] = fn.default_gift_id
            } else {
                delete n[functionId]
            }
            return n
        })
    }

    const handleClearAll = () => {
        if (confirm(t("confirm_clear_all") || "Clear all and reset to default?")) {
            setMapping(getDefaultMapping())
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
        } catch { alert("Connection error") }
        finally { setUpgrading(false) }
    }

    const handleSave = async () => {
        try {
            setSaving(true)
            const res = await fetch(`/api/orders/${orderId}/settings`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ mapping, tiktok_username: tiktokUsername.trim() || null }),
            })
            if (!res.ok) throw new Error()
            router.refresh()
            alert(t("saveSuccess") || "Saved successfully")
        } catch { alert(t("saveFailed")) }
        finally { setSaving(false) }
    }

    const getGift = (giftId: number) => gifts.find(g => g.id === giftId)

    const filteredGifts = useMemo(() => {
        const q = searchQuery.toLowerCase().trim()
        if (!q) return gifts
        return gifts.filter(g => g.name.toLowerCase().includes(q) || String(g.id).includes(q))
    }, [gifts, searchQuery])

    const maskedKey = "•".repeat(orderId.length)

    return (
        <div className="min-h-screen bg-bg-base text-text-base">
            <div className="max-w-6xl mx-auto px-4 py-8">

                {/* ── Header ── */}
                <div className="mb-6">
                    <button onClick={() => router.back()} className="text-[12px] text-text-muted hover:text-text-base mb-3 flex items-center gap-1 transition">
                        ← {t("back")}
                    </button>
                    <div className="flex items-center justify-between flex-wrap gap-3">
                        <div>
                            <h1 className="text-[22px] font-bold">{t("title")}</h1>
                            <p className="text-[13px] text-text-muted mt-0.5">{t("subtitle")}</p>
                        </div>
                        {isPremium ? (
                            <span className="flex items-center gap-1.5 text-[11px] font-bold bg-accent/15 text-accent-light px-3 py-1.5 rounded-full border border-accent/25 uppercase tracking-wide">
                                <span className="w-1.5 h-1.5 rounded-full bg-accent-light" />
                                Premium
                            </span>
                        ) : (
                            <button onClick={() => setShowUpgradeModal(true)} className="flex items-center gap-1.5 text-[11px] font-bold bg-accent text-white px-3 py-1.5 rounded-full hover:opacity-90 transition shadow-lg shadow-accent/20">
                                {t("buyPremium")}
                            </button>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-5">

                    {/* ══ LEFT COLUMN ══ */}
                    <div className="space-y-4">
                        {/* Game Info */}
                        <div className="bg-bg-card border border-accent/15 rounded-2xl p-4 space-y-3">
                            <p className="text-[10px] text-text-muted uppercase tracking-widest font-medium">{t("game")}</p>
                            <p className="text-[16px] font-bold text-text-base">{productName}</p>
                            <div className="border-t border-accent/8 pt-3">
                                <p className="text-[10px] text-text-muted uppercase tracking-widest mb-1">{t("whitelist_label") || "Whitelist"}</p>
                                <p className="font-mono text-[15px] font-bold text-accent-light">{whitelistedUsername ?? "—"}</p>
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
                                        value={tiktokUsername}
                                        onChange={e => setTiktokUsername(e.target.value.replace("@", ""))}
                                        placeholder={t("tiktok_username_placeholder")}
                                        className="w-full bg-bg-base border border-accent/15 rounded-xl pl-7 pr-4 py-2 text-[13px] placeholder:text-text-muted outline-none focus:border-accent/40 transition"
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
                                        <button onClick={() => setShowKey(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-base transition">
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
                                    <button onClick={handleCopy} className={`flex items-center gap-1 px-3 py-2 rounded-xl text-[11px] font-bold transition flex-shrink-0 ${copied ? "bg-green-500/15 text-green-400 border border-green-500/20" : "bg-accent/10 hover:bg-accent/20 text-accent-light border border-accent/15"}`}>
                                        {copied ? <>{t("copied") || "Copied"}</> : <>{t("copy") || "Copy"}</>}
                                    </button>
                                </div>
                                <p className="text-[10px] text-text-muted">{t("key_label")}</p>
                            </div>
                        </div>

                        {/* Download App */}
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
                                        <p className="text-[12px] font-bold">{t("downloadApp") || "โปรแกรมของร้าน"}</p>
                                        <p className="text-[10px] text-text-muted">{t("downloadAppSub") || "สำหรับ TikTok Live"}</p>
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
                                        <p className="text-[10px] text-text-muted mt-0.5 line-clamp-1">{t("downloadDesc") || "จัดการร้านค้า · TikTok Live"}</p>
                                    </div>
                                </div>
                                <button onClick={() => setShowDownloadModal(true)} className="w-full flex items-center justify-center gap-2 py-2.5 bg-accent hover:opacity-90 active:scale-[0.98] text-white text-[12px] font-bold rounded-xl transition-all shadow-lg shadow-accent/20">
                                    {t("download") || "ดาวน์โหลดโปรแกรม"}
                                </button>
                            </div>
                        </div>

                        {/* Save Button (desktop) */}
                        {functions.length > 0 && (
                            <button onClick={handleSave} disabled={saving} className="hidden lg:flex w-full py-3 rounded-2xl font-bold text-[14px] bg-accent hover:opacity-90 text-white transition items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-accent/20">
                                {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : null}
                                {saving ? t("saving") : t("save")}
                            </button>
                        )}
                    </div>

                    {/* ══ RIGHT COLUMN ══ */}
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
                                const selectedGiftId = mapping[fn.id]
                                const selectedGift = selectedGiftId ? getGift(selectedGiftId) : null
                                const isOpen = openPicker === fn.id
                                const isDefault = selectedGiftId === fn.default_gift_id

                                return (
                                    <div key={fn.id} className="bg-bg-card border border-accent/10 rounded-2xl overflow-hidden transition-all">
                                        <div className="flex items-center gap-3 p-4">
                                            <div className="flex-1 flex items-center gap-3 min-w-0">
                                                {fn.image_url && (
                                                    <div className="w-8 h-8 rounded-lg overflow-hidden border border-white/5 bg-bg-base flex-shrink-0">
                                                        <Image src={getImageUrl(fn.image_url)} alt="" width={32} height={32} className="w-full h-full object-cover" unoptimized />
                                                    </div>
                                                )}
                                                <div className="min-w-0">
                                                    <p className="text-[13px] font-bold text-text-base truncate">{locale === "th" ? fn.label_th : fn.label_en}</p>
                                                    <p className="font-mono text-[10px] text-accent-light/70 tracking-wider uppercase">{fn.name}</p>
                                                </div>
                                            </div>

                                            <button onClick={() => togglePicker(fn.id)} disabled={!isPremium}
                                                className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition min-w-[140px] justify-between flex-shrink-0 ${selectedGift ? "border-accent/40 bg-accent/5 text-accent-light" : "border-white/10 bg-bg-base text-text-muted"} ${!isPremium ? "cursor-default opacity-80" : ""}`}>
                                                <div className="flex items-center gap-2 overflow-hidden">
                                                    {!isPremium && !selectedGift && <span className="text-[10px] font-bold bg-white/5 px-1.5 py-0.5 rounded text-text-muted">LOCKED</span>}
                                                    {selectedGift ? (
                                                        <>
                                                            {selectedGift.image_url ? <Image src={getImageUrl(selectedGift.image_url)} alt="" width={16} height={16} className="rounded object-cover flex-shrink-0" unoptimized /> : <span>🎁</span>}
                                                            <span className="text-[12px] font-medium truncate">{selectedGift.name}</span>
                                                            {isDefault && <span className="text-[9px] bg-accent/10 px-1 rounded flex-shrink-0">DEFAULT</span>}
                                                        </>
                                                    ) : (
                                                        <span className="text-[12px]">{t("selectGift")}</span>
                                                    )}
                                                </div>
                                                {isPremium && <ChevronIcon size={13} className={isOpen ? "rotate-180" : ""} />}
                                            </button>

                                            {selectedGift && isPremium && !isDefault && (
                                                <button onClick={() => clearGift(fn.id)} className="text-text-muted hover:text-red-400 p-1 transition flex-shrink-0" title="Reset to default">
                                                    <CloseIcon size={16} />
                                                </button>
                                            )}
                                        </div>

                                        {isOpen && (
                                            <div className="border-t border-accent/10 bg-bg-base/40 p-3 space-y-3">
                                                <div className="relative">
                                                    <input autoFocus type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder={t("searchPlaceholder")}
                                                        className="w-full bg-bg-card border border-accent/20 rounded-xl pl-9 pr-4 py-2 text-[13px] outline-none focus:border-accent/50 transition" />
                                                    <SearchIcon className="absolute left-3 top-2.5 text-text-muted" size={16} />
                                                </div>
                                                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 max-h-[220px] overflow-y-auto pr-1">
                                                    {filteredGifts.map(gift => (
                                                        <button key={gift.id} onClick={() => selectGift(fn.id, gift.id)}
                                                            className={`flex flex-col items-center gap-1.5 p-2 rounded-xl border transition ${selectedGiftId === gift.id ? "border-accent bg-accent/10" : "border-white/5 bg-bg-card hover:border-accent/30"}`}>
                                                            <div className="w-8 h-8 flex items-center justify-center">
                                                                {gift.image_url ? <Image src={getImageUrl(gift.image_url)} alt="" width={32} height={32} className="rounded object-cover" unoptimized /> : <span className="text-[20px]">🎁</span>}
                                                            </div>
                                                            <p className="text-[10px] font-medium leading-tight line-clamp-1 text-center">{gift.name}</p>
                                                            <p className="text-[9px] text-text-muted">💎{gift.diamonds}</p>
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
                            <button onClick={handleSave} disabled={saving} className="lg:hidden w-full py-3.5 rounded-2xl font-bold text-[15px] bg-accent hover:opacity-90 text-white transition flex items-center justify-center gap-2 disabled:opacity-50">
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
                                    <p className="text-[18px] font-bold text-accent-light">฿{premiumAddonPrice.toLocaleString()}</p>
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
                                    {upgrading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <>{t("proceedToCheckout")} (฿{(paymentMethod === "card" ? premiumAddonPrice * 1.06 : premiumAddonPrice).toLocaleString()})</>}
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
                                    href="https://github.com/alongkon2103/AclassStore-Live/releases/latest/download/AclassStoreLiveV3.exe"
                                    download
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