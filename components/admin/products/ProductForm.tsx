"use client"

import { useState } from "react"
import { useRouter } from "@/i18n/routing"
import VariantManager from "./VariantManager"
import ImageManager from "./ImageManager"
import KeysPanel from "./KeysPanel"
import GiftManager from "./GiftManager"
import PresetManager from "./PresetManager"
import FunctionManager from "./FunctionManager"
import ConsignmentManager from "./ConsignmentManager"
import PartnershipManager from "./PartnershipManager"

import { useTranslations, useLocale } from "next-intl"

type Props = {
    product?: any
    mode: "create" | "edit"
    allGifts?: any[]
    allPartners?: any[]
}

export default function ProductForm({ product, mode, allGifts, allPartners }: Props) {
    const t = useTranslations("AdminProductForm")
    const locale = useLocale()
    const router = useRouter()
    const [saving, setSaving] = useState(false)
    const [activeTab, setActiveTab] = useState<"info" | "variants" | "images" | "gifts" | "presets" | "keys" | "consignment" | "functions" | "partnership"> ("info")

    const [form, setForm] = useState({
        name_en: product?.name_en ?? "",
        name_th: product?.name_th ?? "",
        slug: product?.slug ?? "",
        description_en: product?.description_en ?? "",
        description_th: product?.description_th ?? "",
        price: product?.price ?? "",

        is_active: product?.is_active ?? true,
        is_featured: product?.is_featured ?? false,
        isLower: product?.isLower ?? false,

        is_consignment: product?.is_consignment ?? false,
        commission_pct: product?.commission_pct ?? "",
        owner_name: product?.owner_name ?? "",
        owner_contact: product?.owner_contact ?? "",

        info_page_url: product?.info_page_url ?? "",
        discord_role_id: product?.discord_role_id ?? "",
        discord_guild_id: product?.discord_guild_id ?? "",
        consignments: product?.product_consignments ?? [],
        partnership_shares: product?.product_shares ?? [],
    })

    const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }))

    const handleNameEn = (v: string) => {
        set("name_en", v)
        if (mode === "create") {
            set("slug", v.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""))
        }
    }

    const handleSave = async () => {
        if (!form.name_en || !form.slug || !form.price) {
            alert(t("fill_required"))
            return
        }
        setSaving(true)
        const url = mode === "create" ? "/api/admin/products" : `/api/admin/products/${product.id}`
        const method = mode === "create" ? "POST" : "PATCH"

        // Prepare clean data based on exclusive mode
        const submissionData = {
            ...form,
            price: Number(form.price),
            commission_pct: form.is_consignment ? Number(form.commission_pct || 0) : 0,
            consignments: form.is_consignment ? form.consignments : [],
            partnership_shares: form.is_consignment ? [] : form.partnership_shares,
        }

        const res = await fetch(url, {
            method,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(submissionData),
        })
        const data = await res.json()
        setSaving(false)
        if (!res.ok) { alert(data.error ?? "Error"); return }
        if (mode === "create") router.push(`/admin/products/${data.id}`)
        else router.refresh()
    }

    const tabs = [
        { key: "info", label: t("tab_info"), hidden: false },
        { key: "variants", label: t("tab_variants"), hidden: mode === "create" },
        { key: "images", label: t("tab_images"), hidden: mode === "create" },
        { key: "gifts", label: t("tab_gifts"), hidden: mode === "create" },
        { key: "presets", label: t("tab_presets"), hidden: mode === "create" },
        // { key: "keys", label: t("tab_keys"), hidden: mode === "create" }, // Hiding Game Keys UI
        { key: "consignment", label: t("tab_consignment"), hidden: mode === "create" || !form.is_consignment },
        { key: "partnership", label: t("tab_partnership"), hidden: mode === "create" || form.is_consignment },
        { key: "functions", label: "Functions", hidden: mode === "create" },
    ] as const

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <button onClick={() => router.push("/admin/products")}
                        className="text-[12px] text-text-muted hover:text-text-base mb-2 flex items-center gap-1 transition">
                        {t("back_to_products")}
                    </button>
                    <h1 className="text-[22px] font-bold">
                        {mode === "create" ? t("new") : t("edit", { name: locale === "th" ? product.name_th : product.name_en })}
                    </h1>
                </div>
                <button onClick={handleSave} disabled={saving}
                    className="bg-accent hover:opacity-90 text-white text-[13px] font-semibold px-5 py-2.5 rounded-xl transition active:scale-95 disabled:opacity-50">
                    {saving ? t("saving") : mode === "create" ? t("create") : t("save_changes")}
                </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-bg-card border border-accent/10 rounded-xl p-1 w-fit flex-wrap">
                {tabs.filter((t) => !t.hidden).map((t) => (
                    <button key={t.key} onClick={() => setActiveTab(t.key as any)}
                        className={`px-4 py-2 rounded-lg text-[13px] font-medium transition ${activeTab === t.key
                            ? "bg-accent/20 text-accent-light"
                            : "text-text-muted hover:text-text-base"
                            }`}>
                        {t.label}
                    </button>
                ))}
            </div>

            {/* Tab: Info */}
            {activeTab === "info" && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <Field label="Product ID" className="lg:col-span-2">
                        <div className="flex items-center gap-2">
                            <div className="px-4 py-3 rounded-xl border border-white/10 text-text-muted flex-1 break-all">
                                {product?.id || "-"}  {/* ✅ เพิ่ม ? */}
                            </div>
                        </div>
                    </Field>
                    <Field label={t("label_name_en")} required>
                        <input value={form.name_en} onChange={(e) => handleNameEn(e.target.value)}
                            placeholder="Roblox Live Map 1" className={input} />
                    </Field>

                    <Field label={t("label_name_th")} required>
                        <input value={form.name_th} onChange={(e) => set("name_th", e.target.value)}
                            placeholder="Roblox Live Map 1" className={input} />
                    </Field>

                    <Field label={t("label_slug")} required>
                        <input value={form.slug} onChange={(e) => set("slug", e.target.value)}
                            placeholder="roblox-live-map-1" className={input} />
                    </Field>

                    <Field label={t("label_price")} required>
                        <input type="number" value={form.price} 
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => set("price", e.target.value)}
                            placeholder="550" className={input} />
                    </Field>

                    <Field label={t("label_info_url")}>
                        <input
                            value={form.info_page_url}
                            onChange={(e) => set("info_page_url", e.target.value)}
                            placeholder="https://roblox.com"
                            className={input}
                        />
                    </Field>

                    <Field label={t("label_discord_role")}>
                        <input
                            value={form.discord_role_id}
                            onChange={(e) => set("discord_role_id", e.target.value)}
                            placeholder="1394838383838383"
                            className={input}
                        />
                    </Field>

                    <Field label={t("label_discord_guild")}>
                        <input
                            value={form.discord_guild_id}
                            onChange={(e) => set("discord_guild_id", e.target.value)}
                            placeholder="1283838383838383"
                            className={input}
                        />
                    </Field>

                    <Field label={t("label_desc_en")} className="lg:col-span-2">
                        <textarea value={form.description_en} onChange={(e) => set("description_en", e.target.value)}
                            rows={3} placeholder="English description..." className={`${input} resize-none`} />
                    </Field>

                    <Field label={t("label_desc_th")} className="lg:col-span-2">
                        <textarea value={form.description_th} onChange={(e) => set("description_th", e.target.value)}
                            rows={3} placeholder="Thai description..." className={`${input} resize-none`} />
                    </Field>

                    {/* Revenue Model Selection */}
                    <Field label="Revenue Model" className="lg:col-span-2">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <button
                                type="button"
                                onClick={() => set("is_consignment", false)}
                                className={`flex items-center gap-4 p-4 rounded-2xl border-2 transition-all ${!form.is_consignment
                                        ? "border-accent bg-accent/5 ring-4 ring-accent/5"
                                        : "border-accent/10 bg-bg-card hover:border-accent/30"
                                    }`}
                            >
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${!form.is_consignment ? "bg-accent text-white" : "bg-white/5 text-text-muted"
                                    }`}>
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
                                    </svg>
                                </div>
                                <div className="text-left">
                                    <p className={`text-[15px] font-bold ${!form.is_consignment ? "text-text-base" : "text-text-muted"}`}>
                                        Standard / Partnership
                                    </p>
                                    <p className="text-[11px] text-text-muted opacity-80">
                                        In-house product with internal profit sharing.
                                    </p>
                                </div>
                            </button>

                            <button
                                type="button"
                                onClick={() => set("is_consignment", true)}
                                className={`flex items-center gap-4 p-4 rounded-2xl border-2 transition-all ${form.is_consignment
                                        ? "border-accent bg-accent/5 ring-4 ring-accent/5"
                                        : "border-accent/10 bg-bg-card hover:border-accent/30"
                                    }`}
                            >
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${form.is_consignment ? "bg-accent text-white" : "bg-white/5 text-text-muted"
                                    }`}>
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                        <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                                    </svg>
                                </div>
                                <div className="text-left">
                                    <p className={`text-[15px] font-bold ${form.is_consignment ? "text-text-base" : "text-text-muted"}`}>
                                        Consignment
                                    </p>
                                    <p className="text-[11px] text-text-muted opacity-80">
                                        External vendor product with platform fee.
                                    </p>
                                </div>
                            </button>
                        </div>
                    </Field>

                    {/* Toggles */}
                    <div className="lg:col-span-2 flex flex-wrap gap-3">
                        {([
                            { key: "is_active", label: t("label_active"), desc: t("desc_active") },
                            { key: "is_featured", label: t("label_featured"), desc: t("desc_featured") },
                            { key: "isLower", label: t("label_low_stock"), desc: t("desc_low_stock") },
                        ] as const).map(({ key, label, desc }) => (
                            <button key={key} onClick={() => set(key, !form[key])}
                                className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition ${form[key]
                                    ? "border-accent/40 bg-accent/10 text-accent-light"
                                    : "border-accent/10 bg-bg-card text-text-muted hover:border-accent/30"
                                    }`}>
                                <div className={`w-8 h-4 rounded-full transition-colors relative ${form[key] ? "bg-accent" : "bg-slate-300 dark:bg-white/10"}`}>
                                    <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow-sm transition-all ${form[key] ? "left-4" : "left-0.5"}`} />
                                </div>
                                <div className="text-left">
                                    <p className="text-[13px] font-medium">{label}</p>
                                    <p className="text-[11px] opacity-60">{desc}</p>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Tab: Variants */}
            {activeTab === "variants" && <VariantManager productId={product.id} variants={product.product_variants} />}

            {/* Tab: Images */}
            {activeTab === "images" && <ImageManager productId={product.id} images={product.product_images} />}

            {/* Tab: Gifts */}
            {activeTab === "gifts" && <GiftManager productId={product.id} gifts={product.product_gifts ?? []} />}

            {/* Tab: Presets */}
            {activeTab === "presets" && <PresetManager productId={product.id} presets={product.product_presets ?? []} />}

            {/* Tab: Keys */}
            {activeTab === "keys" && <KeysPanel productId={product.id} variants={product.product_variants} />}

            {/* Tab: Consignment */}
            {activeTab === "consignment" && (
                <ConsignmentManager 
                    productId={product.id}
                    initialConsignments={form.consignments}
                    onUpdate={(list) => set("consignments", list)}
                    productPrice={Number(form.price)}
                    platformCommission={Number(form.commission_pct)}
                    onCommissionChange={(val) => set("commission_pct", val)}
                />
            )}

            {/* Tab: Partnership */}
            {activeTab === "partnership" && (
                <PartnershipManager
                    productId={product.id}
                    allPartners={allPartners ?? []}
                    initialShares={form.partnership_shares}
                    onUpdate={(list) => set("partnership_shares", list)}
                />
            )}
            {activeTab === "functions" && (
                <FunctionManager productId={product.id} functions={product.product_functions ?? []} allGifts={allGifts ?? []} />
            )}
            
        </div>
    )
}

function Field({ label, children, required, className = "" }: any) {
    return (
        <div className={className}>
            <label className="block text-[11px] tracking-wide text-text-muted uppercase mb-2">
                {label}{required && <span className="text-red-400 ml-1">*</span>}
            </label>
            {children}
        </div>
    )
}

const input = "w-full bg-bg-input border border-accent/20 rounded-xl px-4 py-2.5 text-[13px] text-text-base placeholder:text-text-muted outline-none focus:border-accent/50 focus:ring-4 focus:ring-accent/5 transition"