"use client"

import { useState } from "react"
import { useRouter } from "@/i18n/routing"
import VariantManager from "./VariantManager"
import ImageManager from "./ImageManager"
import KeysPanel from "./KeysPanel"
import GiftManager from "./GiftManager"
import PresetManager from "./PresetManager"

type Props = {
    product?: any
    mode: "create" | "edit"
}

export default function ProductForm({ product, mode }: Props) {
    const router = useRouter()
    const [saving, setSaving] = useState(false)
    const [activeTab, setActiveTab] = useState<"info" | "variants" | "images" | "gifts" | "presets" | "keys" | "consignment">("info")

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
        commission_pct: product?.commission_pct ?? 0,
        owner_name: product?.owner_name ?? "",
        owner_contact: product?.owner_contact ?? "",

        info_page_url: product?.info_page_url ?? "",
        discord_role_id: product?.discord_role_id ?? "",
        discord_guild_id: product?.discord_guild_id ?? "",
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
            alert("Please fill name, slug and price")
            return
        }
        setSaving(true)
        const url = mode === "create" ? "/api/admin/products" : `/api/admin/products/${product.id}`
        const method = mode === "create" ? "POST" : "PATCH"
        const res = await fetch(url, {
            method,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...form, price: Number(form.price) }),
        })
        const data = await res.json()
        setSaving(false)
        if (!res.ok) { alert(data.error ?? "Error"); return }
        if (mode === "create") router.push(`/admin/products/${data.id}`)
        else router.refresh()
    }

    const tabs = [
        { key: "info", label: "Info", hidden: false },
        { key: "variants", label: "Variants", hidden: mode === "create" },
        { key: "images", label: "Images", hidden: mode === "create" },
        { key: "gifts", label: "Gifts", hidden: mode === "create" },
        { key: "presets", label: "Presets", hidden: mode === "create" },
        { key: "keys", label: "Game Keys", hidden: mode === "create" },
        { key: "consignment", label: "Consignment", hidden: mode === "create" },
    ] as const

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <button onClick={() => router.push("/admin/products")}
                        className="text-[12px] text-text-muted hover:text-text-base mb-2 flex items-center gap-1 transition">
                        ← Products
                    </button>
                    <h1 className="text-[22px] font-bold">
                        {mode === "create" ? "New Product" : `Edit — ${product.name_en}`}
                    </h1>
                </div>
                <button onClick={handleSave} disabled={saving}
                    className="bg-accent hover:opacity-90 text-white text-[13px] font-semibold px-5 py-2.5 rounded-xl transition active:scale-95 disabled:opacity-50">
                    {saving ? "Saving..." : mode === "create" ? "Create Product" : "Save Changes"}
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
                    <Field label="Name (EN)" required>
                        <input value={form.name_en} onChange={(e) => handleNameEn(e.target.value)}
                            placeholder="Roblox Live Map 1" className={input} />
                    </Field>

                    <Field label="Name (TH)" required>
                        <input value={form.name_th} onChange={(e) => set("name_th", e.target.value)}
                            placeholder="Roblox Live Map 1" className={input} />
                    </Field>

                    <Field label="Slug" required>
                        <input value={form.slug} onChange={(e) => set("slug", e.target.value)}
                            placeholder="roblox-live-map-1" className={input} />
                    </Field>

                    <Field label="Base Price (฿)" required>
                        <input type="number" value={form.price} onChange={(e) => set("price", e.target.value)}
                            placeholder="550" className={input} />
                    </Field>

                    <Field label="Info Page URL">
                        <input
                            value={form.info_page_url}
                            onChange={(e) => set("info_page_url", e.target.value)}
                            placeholder="https://roblox.com"
                            className={input}
                        />
                    </Field>

                    <Field label="Discord Role ID">
                        <input
                            value={form.discord_role_id}
                            onChange={(e) => set("discord_role_id", e.target.value)}
                            placeholder="1394838383838383"
                            className={input}
                        />
                    </Field>

                    <Field label="Discord Guild ID">
                        <input
                            value={form.discord_guild_id}
                            onChange={(e) => set("discord_guild_id", e.target.value)}
                            placeholder="1283838383838383"
                            className={input}
                        />
                    </Field>

                    <Field label="Description (EN)" className="lg:col-span-2">
                        <textarea value={form.description_en} onChange={(e) => set("description_en", e.target.value)}
                            rows={3} placeholder="English description..." className={`${input} resize-none`} />
                    </Field>

                    <Field label="Description (TH)" className="lg:col-span-2">
                        <textarea value={form.description_th} onChange={(e) => set("description_th", e.target.value)}
                            rows={3} placeholder="Thai description..." className={`${input} resize-none`} />
                    </Field>

                    {/* Toggles */}
                    <div className="lg:col-span-2 flex flex-wrap gap-3">
                        {([
                            { key: "is_active", label: "Active", desc: "Show in store" },
                            { key: "is_featured", label: "Featured", desc: "Show in homepage" },
                            { key: "isLower", label: "Low Stock Flag", desc: "Mark as low stock" },
                        ] as const).map(({ key, label, desc }) => (
                            <button key={key} onClick={() => set(key, !form[key])}
                                className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition ${form[key]
                                    ? "border-accent/30 bg-accent/10 text-accent-light"
                                    : "border-white/10 text-text-muted hover:border-white/20"
                                    }`}>
                                <div className={`w-8 h-4 rounded-full transition-colors relative ${form[key] ? "bg-accent" : "bg-white/10"}`}>
                                    <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${form[key] ? "left-4" : "left-0.5"}`} />
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
            {/* Tab: Consignment */}
            {activeTab === "consignment" && (
                <div className="space-y-5">
                    {/* Toggle */}
                    <div className="flex items-center justify-between p-4 bg-bg-card border border-accent/10 rounded-2xl">
                        <div>
                            <p className="text-[14px] font-semibold">Consignment Product</p>
                            <p className="text-[12px] text-text-muted mt-0.5">
                                Enable if this product is sold on behalf of another owner
                            </p>
                        </div>
                        <button onClick={() => set("is_consignment", !form.is_consignment)}
                            className={`w-12 h-6 rounded-full transition-colors relative flex-shrink-0 ${form.is_consignment ? "bg-accent" : "bg-white/10"
                                }`}>
                            <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${form.is_consignment ? "left-7" : "left-1"
                                }`} />
                        </button>
                    </div>

                    {form.is_consignment && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            <Field label="Owner Name">
                                <input value={form.owner_name}
                                    onChange={(e) => set("owner_name", e.target.value)}
                                    placeholder="Store / Owner name" className={input} />
                            </Field>

                            <Field label="Owner Contact">
                                <input value={form.owner_contact}
                                    onChange={(e) => set("owner_contact", e.target.value)}
                                    placeholder="Line / Discord / Email" className={input} />
                            </Field>

                            <Field label="Our Commission %" required>
                                <div className="relative">
                                    <input type="number" min="0" max="100" step="0.5"
                                        value={form.commission_pct}
                                        onChange={(e) => set("commission_pct", Number(e.target.value))}
                                        className={input} placeholder="20" />
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted text-[13px]">%</span>
                                </div>
                            </Field>

                            {form.price && (
                                <div className="flex flex-col justify-center bg-bg-base border border-accent/10 rounded-xl px-4 py-4 text-[13px] space-y-2">
                                    <p className="text-[11px] tracking-widest text-text-muted uppercase font-medium">Revenue Preview</p>
                                    <div className="flex justify-between">
                                        <span className="text-text-muted">Sale Price</span>
                                        <span className="font-medium">฿{Number(form.price).toLocaleString()}</span>
                                    </div>
                                    <div className="h-px bg-white/5" />
                                    <div className="flex justify-between text-green-400">
                                        <span>We earn ({form.commission_pct}%)</span>
                                        <span className="font-semibold">
                                            ฿{(Number(form.price) * Number(form.commission_pct) / 100).toLocaleString()}
                                        </span>
                                    </div>
                                    <div className="flex justify-between text-text-muted">
                                        <span>Owner payout</span>
                                        <span>
                                            ฿{(Number(form.price) * (100 - Number(form.commission_pct)) / 100).toLocaleString()}
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {!form.is_consignment && (
                        <div className="text-center py-12 text-text-muted text-[13px] bg-bg-card border border-accent/10 rounded-2xl">
                            Enable consignment mode to configure owner and commission settings.
                        </div>
                    )}
                </div>
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

const input = "w-full bg-bg-base border border-accent/15 rounded-xl px-4 py-2.5 text-[13px] placeholder:text-text-muted outline-none focus:border-accent/40 transition"