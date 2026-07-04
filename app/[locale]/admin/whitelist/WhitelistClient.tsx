"use client"

import { useState, useMemo, useEffect } from "react"
import { useRouter } from "@/i18n/routing"
import { format } from "date-fns"
import { useTranslations, useLocale } from "next-intl"
import { useSession } from "next-auth/react"
import { th, enUS } from "date-fns/locale"
import { motion, AnimatePresence } from "framer-motion"
import { isPermanentExpiry } from "@/lib/formatExpiresAt"

// Days remaining until expiry (min 1) — used to pre-fill the duration field when
// editing a time-limited entry.
function remainingDays(expiresAt: string | Date): number {
    const ms = new Date(expiresAt).getTime() - Date.now()
    return Math.max(1, Math.ceil(ms / 86_400_000))
}

type WhitelistItem = {
    id: string
    ign: string
    is_premium: boolean
    expires_at: string | Date
    products: { id: string; name_th: string; name_en: string }
}

type ProductOption = { id: string; name_th: string; name_en: string }

type UserOption = {
    id: string
    username: string
    email: string | null
    avatar: string | null
}

export default function WhitelistClient({
    initialWhitelist,
    products,
    users = [],
    config = {}
}: {
    initialWhitelist: WhitelistItem[],
    products: ProductOption[],
    users?: UserOption[],
    config?: Record<string, string>
}) {
    const t = useTranslations("AdminWhitelist")
    const commonT = useTranslations("Admin")
    const locale = useLocale()
    const { data: session } = useSession()
    const dateLocale = locale === "th" ? th : enUS
    const router = useRouter()

    const [whitelist, setWhitelist] = useState(initialWhitelist)
    const [search, setSearch] = useState("")
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    // null = add mode; a string id = editing that row.
    const [editingId, setEditingId] = useState<string | null>(null)

    // User Search State
    const [userSearch, setUserSearch] = useState("")
    const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false)

    // Form State
    const [formData, setFormData] = useState({
        userId: "",
        ign: "",
        productId: "",
        isPremium: false,
        durationDays: 30,
        isPermanent: false,
    })

    // Set default duration and premium from config when the ADD modal opens.
    useEffect(() => {
        if (isModalOpen && !editingId) {
            const defDuration = parseInt(config?.free_trial_duration || "30")
            const defPremium = config?.free_trial_is_premium === "true"
            setFormData(prev => ({
                ...prev,
                durationDays: defDuration,
                isPremium: defPremium,
            }))
        }
    }, [isModalOpen, editingId, config])

    const filteredUsers = useMemo(() => {
        const q = userSearch.toLowerCase()
        return users.filter(u =>
            u.username.toLowerCase().includes(q) ||
            u.email?.toLowerCase().includes(q)
        )
    }, [users, userSearch])

    const selectedUser = useMemo(() =>
        users.find(u => u.id === formData.userId),
    [users, formData.userId])

    const filtered = useMemo(() => {
        return whitelist.filter((item) =>
            item.ign.toLowerCase().includes(search.toLowerCase()) ||
            item.products.name_en.toLowerCase().includes(search.toLowerCase()) ||
            item.products.name_th.toLowerCase().includes(search.toLowerCase())
        )
    }, [whitelist, search])

    const resetForm = () => {
        setFormData({ userId: "", ign: "", productId: "", isPremium: false, durationDays: 30, isPermanent: false })
        setUserSearch("")
        setEditingId(null)
    }

    const openAdd = () => {
        resetForm()
        setIsModalOpen(true)
    }

    const openEdit = (item: WhitelistItem) => {
        const permanent = isPermanentExpiry(item.expires_at)
        setFormData({
            userId: "",
            ign: item.ign,
            productId: item.products.id,
            isPremium: !!item.is_premium,
            durationDays: permanent ? 30 : remainingDays(item.expires_at),
            isPermanent: permanent,
        })
        setUserSearch("")
        setEditingId(item.id)
        setIsModalOpen(true)
    }

    const closeModal = () => {
        setIsModalOpen(false)
        resetForm()
    }

    const handleDelete = async (id: string) => {
        if (!confirm(t("delete_confirm"))) return

        try {
            const res = await fetch(`/api/admin/whitelist/${id}`, { method: "DELETE" })
            if (res.ok) {
                setWhitelist(whitelist.filter(w => w.id !== id))
                router.refresh()
            }
        } catch {
            alert(t("error_save"))
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        // Add mode needs a user (it creates a TRIAL order); edit mode does not
        // because the whitelist row has no user_id.
        if (!formData.ign || !formData.productId || (!editingId && !formData.userId)) {
            alert("Please fill all required fields")
            return
        }

        setLoading(true)
        try {
            const url = editingId ? `/api/admin/whitelist/${editingId}` : "/api/admin/whitelist"
            const method = editingId ? "PATCH" : "POST"
            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData),
            })

            if (res.ok) {
                const updated = await fetch("/api/admin/whitelist").then(r => r.json())
                setWhitelist(updated)
                closeModal()
                router.refresh()
            } else {
                const err = await res.json().catch(() => ({}))
                alert(err.error || t("error_save"))
            }
        } catch {
            alert(t("error_save"))
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-[24px] font-bold">{t("title")}</h1>
                    <p className="text-text-muted text-[13px] mt-0.5">{t("subtitle")}</p>
                </div>
                <button
                    onClick={openAdd}
                    className="bg-accent hover:bg-accent-light text-white px-5 py-2.5 rounded-xl text-[13px] font-medium transition-all shadow-lg shadow-accent/20"
                >
                    {t("add_whitelist")}
                </button>
            </div>

            {/* Filters */}
            <div className="relative">
                <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder={t("search_users")}
                    className="w-full bg-bg-card border border-accent/15 rounded-xl px-11 py-3 text-[13px] placeholder:text-text-muted outline-none focus:border-accent/40 transition-all"
                />
                <svg className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
                </svg>
            </div>

            {/* Table */}
            <div className="bg-bg-card border border-accent/10 rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-[13px]">
                        <thead>
                            <tr className="text-left text-[11px] text-text-muted border-b border-white/5 bg-white/[0.02]">
                                <th className="px-5 py-4 font-medium uppercase tracking-wider">{t("user")}</th>
                                <th className="px-5 py-4 font-medium uppercase tracking-wider">{t("product")}</th>
                                <th className="px-5 py-4 font-medium uppercase tracking-wider text-center">{t("status")}</th>
                                <th className="px-5 py-4 font-medium uppercase tracking-wider">{t("expires")}</th>
                                <th className="px-5 py-4 font-medium uppercase tracking-wider text-right">{t("actions")}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {filtered.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="text-center py-16 text-text-muted italic">
                                        {t("no_records")}
                                    </td>
                                </tr>
                            )}
                            {filtered.map((item) => (
                                <tr key={item.id} className="hover:bg-white/[0.01] transition group">
                                    <td className="px-5 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 rounded-full bg-accent/20 flex items-center justify-center text-[14px] font-bold text-accent-light border border-accent/20">
                                                {item.ign?.[0]?.toUpperCase()}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="font-semibold text-text-base truncate">{item.ign}</p>
                                                <p className="text-[11px] text-text-muted truncate">In-Game Name</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-5 py-4">
                                        <div className="inline-flex items-center px-2.5 py-1 rounded-lg bg-accent/5 border border-accent/10">
                                            <span className="font-medium">
                                                {locale === "th" ? item.products.name_th : item.products.name_en}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-5 py-4 text-center">
                                        <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold uppercase ${
                                            item.is_premium
                                            ? "bg-amber-500/15 text-amber-500 border border-amber-500/20"
                                            : "bg-accent/15 text-accent-light border border-accent/20"
                                        }`}>
                                            {item.is_premium ? "PREMIUM" : "NORMAL"}
                                        </span>
                                    </td>
                                    <td className="px-5 py-4 text-text-muted">
                                        {isPermanentExpiry(item.expires_at) ? (
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-accent/10 border border-accent/20 text-accent-light text-[11px] font-bold uppercase tracking-wider">
                                                ∞ {t("permanent")}
                                            </span>
                                        ) : (
                                            <div className="flex flex-col">
                                                <span>{format(new Date(item.expires_at), "dd MMM yyyy", { locale: dateLocale })}</span>
                                                <span className="text-[10px] opacity-60">
                                                    {format(new Date(item.expires_at), "HH:mm")}
                                                </span>
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-5 py-4 text-right">
                                        {session?.user?.role === "admin" && (
                                            <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => openEdit(item)}
                                                    className="p-2 text-accent-light hover:bg-accent/10 rounded-lg transition-colors"
                                                    title={t("edit")}
                                                >
                                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                                                    </svg>
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(item.id)}
                                                    className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                                                    title={commonT("delete")}
                                                >
                                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                        <path d="M3 6h18m-2 0v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6m3 0V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2m-6 3v8m4-8v8"/>
                                                    </svg>
                                                </button>
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal */}
            <AnimatePresence>
                {isModalOpen && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={closeModal}
                            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        />
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.9, opacity: 0, y: 20 }}
                            className="relative w-full max-w-md bg-bg-card border border-accent/20 rounded-3xl p-6 shadow-2xl"
                        >
                            <h2 className="text-[20px] font-bold mb-1">
                                {editingId ? t("edit_whitelist") : t("new_whitelist")}
                            </h2>
                            <p className="text-text-muted text-[13px] mb-6">{t("subtitle")}</p>

                            <form onSubmit={handleSubmit} className="space-y-4">
                                {/* Select User — add mode only (whitelist rows have no user_id) */}
                                {!editingId && (
                                    <div className="relative">
                                        <label className="block text-[12px] font-medium text-text-muted mb-1.5 ml-1">{t("select_user")}</label>
                                        <div
                                            onClick={() => setIsUserDropdownOpen(!isUserDropdownOpen)}
                                            className="w-full bg-white/[0.03] border border-accent/15 rounded-xl px-4 py-3 text-[13px] cursor-pointer flex items-center justify-between"
                                        >
                                            <span className={selectedUser ? "text-text-base" : "text-text-muted"}>
                                                {selectedUser ? `${selectedUser.username} (${selectedUser.email || 'No email'})` : t("select_user")}
                                            </span>
                                            <svg className={`transition-transform ${isUserDropdownOpen ? 'rotate-180' : ''}`} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                                <polyline points="6 9 12 15 18 9" />
                                            </svg>
                                        </div>

                                        {isUserDropdownOpen && (
                                            <div className="absolute z-10 w-full mt-2 bg-bg-card border border-accent/20 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                                                <div className="p-2 border-b border-white/5">
                                                    <input
                                                        autoFocus
                                                        placeholder="Search user..."
                                                        value={userSearch}
                                                        onChange={(e) => setUserSearch(e.target.value)}
                                                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-[12px] outline-none focus:border-accent/40"
                                                    />
                                                </div>
                                                <div className="max-h-[200px] overflow-y-auto">
                                                    {filteredUsers.length === 0 ? (
                                                        <div className="p-4 text-center text-[12px] text-text-muted italic">No users found</div>
                                                    ) : (
                                                        filteredUsers.map(u => (
                                                            <div
                                                                key={u.id}
                                                                onClick={() => {
                                                                    setFormData({ ...formData, userId: u.id })
                                                                    setIsUserDropdownOpen(false)
                                                                }}
                                                                className="p-3 hover:bg-white/5 cursor-pointer flex items-center gap-3 transition-colors"
                                                            >
                                                                <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center text-[12px] font-bold text-accent-light">
                                                                    {u.username[0].toUpperCase()}
                                                                </div>
                                                                <div className="min-w-0">
                                                                    <p className="text-[13px] font-medium text-text-base truncate">{u.username}</p>
                                                                    <p className="text-[11px] text-text-muted truncate">{u.email}</p>
                                                                </div>
                                                            </div>
                                                        ))
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* IGN Input */}
                                <div>
                                    <label className="block text-[12px] font-medium text-text-muted mb-1.5 ml-1">{t("ign")}</label>
                                    <input
                                        required
                                        type="text"
                                        placeholder="e.g. Player123"
                                        value={formData.ign}
                                        onChange={(e) => setFormData({...formData, ign: e.target.value})}
                                        className="w-full bg-white/[0.03] border border-accent/15 rounded-xl px-4 py-3 text-[13px] outline-none focus:border-accent/40 transition-all"
                                    />
                                </div>

                                {/* Product Selection */}
                                <div>
                                    <label className="block text-[12px] font-medium text-text-muted mb-1.5 ml-1">{t("select_product")}</label>
                                    <select
                                        required
                                        value={formData.productId}
                                        onChange={(e) => setFormData({...formData, productId: e.target.value})}
                                        className="w-full bg-white/[0.03] border border-accent/15 rounded-xl px-4 py-3 text-[13px] outline-none focus:border-accent/40 transition-all appearance-none"
                                    >
                                        <option value="" disabled className="bg-bg-card">{t("select_product")}</option>
                                        {products.map(p => (
                                            <option key={p.id} value={p.id} className="bg-bg-card">
                                                {locale === "th" ? p.name_th : p.name_en}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {/* Permanent toggle */}
                                <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-accent/15">
                                    <div>
                                        <p className="text-[13px] font-medium text-text-base">{t("permanent")}</p>
                                        <p className="text-[11px] text-text-muted mt-0.5">{t("permanent_hint")}</p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setFormData({ ...formData, isPermanent: !formData.isPermanent })}
                                        className={`relative w-12 h-6 rounded-full transition-colors duration-200 shrink-0 ${
                                            formData.isPermanent ? "bg-accent" : "bg-white/10"
                                        }`}
                                        aria-label="Toggle permanent"
                                    >
                                        <div className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform duration-200 ${
                                            formData.isPermanent ? "translate-x-6" : "translate-x-0"
                                        }`} />
                                    </button>
                                </div>

                                {/* Options Row */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[12px] font-medium text-text-muted mb-1.5 ml-1">
                                            {t("duration")}
                                        </label>
                                        <input
                                            type="number"
                                            min="1"
                                            required={!formData.isPermanent}
                                            disabled={formData.isPermanent}
                                            value={formData.isPermanent ? "" : formData.durationDays}
                                            onChange={(e) => setFormData({...formData, durationDays: parseInt(e.target.value) || 0})}
                                            className="w-full bg-white/[0.03] border border-accent/15 rounded-xl px-4 py-3 text-[13px] outline-none focus:border-accent/40 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                                            placeholder={formData.isPermanent ? "∞" : "30"}
                                        />
                                    </div>
                                    <div className="flex flex-col">
                                        <label className="block text-[12px] font-medium text-text-muted mb-1.5 ml-1">{t("is_premium")}</label>
                                        <button
                                            type="button"
                                            onClick={() => setFormData({...formData, isPremium: !formData.isPremium})}
                                            className={`flex-1 flex items-center justify-center rounded-xl border transition-all text-[12px] font-bold ${
                                                formData.isPremium
                                                ? "bg-amber-500/10 border-amber-500/30 text-amber-500"
                                                : "bg-white/5 border-white/10 text-text-muted"
                                            }`}
                                        >
                                            {formData.isPremium ? "★ PREMIUM" : "NORMAL"}
                                        </button>
                                    </div>
                                </div>

                                {/* Footer */}
                                <div className="flex gap-3 pt-2">
                                    <button
                                        type="button"
                                        onClick={closeModal}
                                        className="flex-1 px-5 py-3 rounded-xl border border-white/10 text-[13px] font-medium hover:bg-white/5 transition-all"
                                    >
                                        {t("cancel")}
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className="flex-1 bg-accent hover:bg-accent-light text-white px-5 py-3 rounded-xl text-[13px] font-bold transition-all shadow-lg shadow-accent/20 disabled:opacity-50"
                                    >
                                        {loading ? t("saving") : t("save")}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    )
}
