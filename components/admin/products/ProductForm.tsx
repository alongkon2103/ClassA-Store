"use client"

import { useEffect, useState, useId, isValidElement, cloneElement, type ReactElement, type ReactNode } from "react"
import type { gifts, partners } from "@prisma/client"
import { useRouter } from "@/i18n/routing"
import VariantManager from "./VariantManager"
import BundleGamesManager from "./BundleGamesManager"
import ImageManager from "./ImageManager"
import WorkspaceTabs from "../WorkspaceTabs"
import { productSections, resolveProductTab, validateProductBasics, type ProductTab } from "./product-workspace"
import GiftManager from "./GiftManager"
import PresetManager from "./PresetManager"
import GameDefaultsManager from "./GameDefaultsManager"
import FunctionManager from "./FunctionManager"
import FeatureManager from "./FeatureManager"
import ConsignmentManager from "./ConsignmentManager"
import PartnershipManager from "./PartnershipManager"
import TiptapEditor from "../TiptapEditor"

import { useTranslations, useLocale } from "next-intl"

type Props = {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    product?: any
    mode: "create" | "edit"
    allGifts?: gifts[]
    allPartners?: partners[]
    initialType?: "bundle"
    initialTab?: string
    integrationPanel?: ReactNode
}

export default function ProductForm({ product, mode, allGifts, allPartners, initialType, initialTab, integrationPanel }: Props) {
    const t = useTranslations("AdminProductForm")
    const locale = useLocale()
    const router = useRouter()
    const [saving, setSaving] = useState(false)
    const [videoUploading, setVideoUploading] = useState(false)
    const [videoError, setVideoError] = useState<string | null>(null)

    const [form, setForm] = useState({
        name_en: product?.name_en ?? "",
        name_th: product?.name_th ?? "",
        slug: product?.slug ?? "",
        description_en: product?.description_en ?? "",
        description_th: product?.description_th ?? "",
        price: product?.price ?? "",

        // Delivery type: roblox_whitelist (default) or desktop_program.
        type: product?.type ?? initialType ?? "roblox_whitelist",
        bundle_product_ids: (product?.bundle_product_ids ?? []) as string[],
        bundle_all_ac_games: product?.bundle_all_ac_games ?? false,
        bundle_includes_tikkies: product?.bundle_includes_tikkies === true,
        program_key: product?.program_key ?? "",
        download_url: product?.download_url ?? "",

        is_active: product?.is_active ?? false,
        is_featured: product?.is_featured ?? false,
        isLower: product?.isLower ?? false,
        has_limited_discount: product?.has_limited_discount ?? false,

        is_consignment: product?.is_consignment ?? false,
        commission_pct: product?.commission_pct ?? "",
        owner_name: product?.owner_name ?? "",
        owner_contact: product?.owner_contact ?? "",

        info_page_url: product?.info_page_url ?? "",
        // Multiple YouTube URLs. Migrate a legacy single youtube_url into the
        // list so old products keep their video on first edit.
        videos: (product?.product_videos?.map((v: { url: string }) => v.url)
            ?? (product?.youtube_url ? [product.youtube_url] : [])) as string[],
        tutorial_video_url: product?.tutorial_video_url ?? "",
        preview_video_url: product?.preview_video_url ?? "",
        discord_role_id: product?.discord_role_id ?? "",
        discord_guild_id: product?.discord_guild_id ?? "",
        consignments: product?.product_consignments ?? [],
        partnership_shares: product?.product_shares ?? [],
    })

    const th = locale === "th"
    const copy = (thai: string, english: string) => th ? thai : english
    const isBundle = form.type === "bundle"
    // Independent editors operate on the persisted product, never an unsaved type/key.
    const supportsGameDefaults = product?.type === "roblox_whitelist" || (product?.type === "desktop_program" && product?.program_key === "ac_pig_panic")
    const sections = productSections({ editing: mode === "edit", bundle: isBundle, gameDefaults: supportsGameDefaults, th })
    const [selectedTab, setSelectedTab] = useState<ProductTab>(() => resolveProductTab(initialTab, sections))
    const activeTab = resolveProductTab(selectedTab, sections)
    const activeSection = sections.find(section => section.tabs.some(tab => tab.key === activeTab))!
    const [visited, setVisited] = useState<ProductTab[]>(() => [resolveProductTab(initialTab, sections)])
    const [descriptionLanguage, setDescriptionLanguage] = useState(th ? "th" : "en")
    const [notice, setNotice] = useState<{ error: boolean; text: string } | null>(null)
    const [baseline, setBaseline] = useState(() => JSON.stringify(form))
    const dirty = JSON.stringify(form) !== baseline
    const independent = ["variants", "images", "features", "defaults", "functions", "presets", "gifts"].includes(activeTab)
    useEffect(() => {
        if (!dirty) return
        const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = "" }
        const guardLink = (event: MouseEvent) => {
            if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
            const anchor = (event.target as Element | null)?.closest<HTMLAnchorElement>("a[href]")
            if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return
            const destination = new URL(anchor.href, window.location.href)
            if (destination.pathname === window.location.pathname && destination.search === window.location.search) return
            if (!confirm(locale === "th" ? "มีข้อมูลสินค้าที่ยังไม่บันทึก ต้องการออกจากหน้านี้หรือไม่?" : "Leave without saving product changes?")) {
                event.preventDefault()
                event.stopPropagation()
            }
        }
        window.addEventListener("beforeunload", warn)
        document.addEventListener("click", guardLink, true)
        return () => { window.removeEventListener("beforeunload", warn); document.removeEventListener("click", guardLink, true) }
    }, [dirty, locale])

    function changeTab(key: string) {
        const next = resolveProductTab(key, sections)
        setSelectedTab(next)
        setVisited(current => current.includes(next) ? current : [...current, next])
        const url = new URL(window.location.href)
        url.searchParams.set("tab", next)
        window.history.replaceState(null, "", url)
    }
    const back = () => {
        if (dirty && !confirm(copy("มีข้อมูลสินค้าที่ยังไม่บันทึก ต้องการออกจากหน้านี้หรือไม่?", "Leave without saving product changes?"))) return
        router.push(isBundle ? "/admin/bundles" : "/admin/products")
    }
    const set = (k: string, v: unknown) => setForm((f) => ({ ...f, [k]: v }))

    // YouTube video list helpers.
    const setVideo = (i: number, v: string) => setForm((f) => ({ ...f, videos: f.videos.map((u, idx) => (idx === i ? v : u)) }))
    const addVideo = () => setForm((f) => ({ ...f, videos: [...f.videos, ""] }))
    const removeVideo = (i: number) => setForm((f) => ({ ...f, videos: f.videos.filter((_, idx) => idx !== i) }))

    // Read video duration client-side BEFORE uploading. Rejects > 10s
    // to avoid wasting bandwidth on files that won't be accepted.
    const probeVideoDuration = (file: File): Promise<number> =>
        new Promise((resolve, reject) => {
            const url = URL.createObjectURL(file)
            const v = document.createElement("video")
            v.preload = "metadata"
            v.onloadedmetadata = () => {
                URL.revokeObjectURL(url)
                resolve(v.duration)
            }
            v.onerror = () => {
                URL.revokeObjectURL(url)
                reject(new Error("Cannot read video metadata"))
            }
            v.src = url
        })

    const handlePreviewVideoUpload = async (file: File) => {
        setVideoError(null)
        if (file.size > 20 * 1024 * 1024) {
            setVideoError(t("video_too_large"))
            return
        }
        try {
            const duration = await probeVideoDuration(file)
            if (duration > 10.5) {
                setVideoError(t("video_too_long", { seconds: Math.round(duration) }))
                return
            }
        } catch {
            setVideoError(t("video_unreadable"))
            return
        }

        setVideoUploading(true)
        try {
            const fd = new FormData()
            fd.append("file", file)
            fd.append("type", "video")
            const res = await fetch("/api/admin/upload", { method: "POST", body: fd })
            const data = await res.json()
            if (!res.ok) {
                setVideoError(data.error ?? "Upload failed")
                return
            }
            set("preview_video_url", data.url)
        } catch (e: unknown) {
            setVideoError((e as Error)?.message ?? "Upload failed")
        } finally {
            setVideoUploading(false)
        }
    }

    const handleNameEn = (v: string) => {
        set("name_en", v)
        if (mode === "create") {
            set("slug", v.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""))
        }
    }

    const handleSave = async () => {
        setNotice(null)
        const invalid = validateProductBasics(form)
        if (invalid) {
            changeTab(invalid.tab)
            const fieldNames: Record<string, string> = {
                name_en: copy("ชื่อภาษาอังกฤษ", "English name"), name_th: copy("ชื่อภาษาไทย", "Thai name"), slug: "URL slug",
                price: copy("ราคาหลัก (มากกว่า 0 บาท)", "Base price (greater than 0)"), program_key: copy("รหัสโปรแกรม (a-z, 0-9, _ จำนวน 2–40 ตัว)", "Program key (2–40 lowercase letters, digits or _)"),
                bundle_product_ids: copy("เกมในแพ็กเกจ 2–50 เกม", "2–50 games in the package"),
            }
            setNotice({ error: true, text: copy("กรุณาตรวจสอบ: ", "Please check: ") + fieldNames[invalid.field] })
            requestAnimationFrame(() => document.getElementById("product-" + invalid.field)?.focus())
            return
        }
        setSaving(true)
        const url = mode === "create" ? "/api/admin/products" : `/api/admin/products/${product.id}`
        const method = mode === "create" ? "POST" : "PATCH"

        // Prepare clean data based on exclusive mode
        const submissionData = {
            ...form,
            price: Number(form.price),
            bundle_product_ids: isBundle ? form.bundle_product_ids : [],
            bundle_includes_tikkies: isBundle ? form.bundle_includes_tikkies : undefined,
            is_consignment: isBundle ? false : form.is_consignment,
            // Only desktop_program products carry a program_key; roblox → null so
            // empty strings never collide on the unique index.
            program_key: form.type === "desktop_program" ? String(form.program_key || "").trim() : null,
            download_url: form.type === "desktop_program" ? (String(form.download_url || "").trim() || null) : null,
            commission_pct: form.is_consignment ? Number(form.commission_pct || 0) : 0,
            consignments: !isBundle && form.is_consignment ? form.consignments : [],
            partnership_shares: form.is_consignment ? [] : form.partnership_shares,
        }

        try {
            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(submissionData),
            })
            const data = await res.json()
            if (!res.ok) { setNotice({ error: true, text: data.error ?? copy("บันทึกไม่สำเร็จ", "Could not save") }); return }
            setBaseline(JSON.stringify(form))
            if (mode === "create") router.push(`/admin/products/${data.id}?tab=variants`)
            else { setNotice({ error: false, text: copy("บันทึกข้อมูลสินค้าแล้ว", "Product details saved") }); router.refresh() }
        } catch {
            setNotice({ error: true, text: copy("บันทึกไม่สำเร็จ กรุณาลองอีกครั้ง ข้อมูลที่กรอกยังอยู่", "Could not save. Your input has been kept; please retry.") })
        } finally {
            setSaving(false)
        }
    }


    const toggle = (key: "is_active" | "is_featured" | "isLower" | "has_limited_discount", label: string, description: string) => <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border-soft p-4">
        <input type="checkbox" checked={form[key]} onChange={event => set(key, event.target.checked)} className="mt-1 h-4 w-4 accent-accent" />
        <span><span className="block text-sm font-medium">{label}</span><span className="mt-1 block text-xs leading-relaxed text-text-muted">{description}</span></span>
    </label>
    const panel = (key: ProductTab, children: ReactNode) => (visited.includes(key) || activeTab === key) && <section key={key} id={activeTab === key ? "product-editor" : undefined} role="tabpanel" hidden={activeTab !== key} aria-label={sections.flatMap(section => section.tabs).find(tab => tab.key === key)?.label} className="min-w-0 space-y-5">{children}</section>

    return <div className="min-w-0 space-y-5 pb-8">
        <header className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
                <button type="button" onClick={back} className="mb-3 min-h-9 text-xs text-text-muted hover:text-text-base">← {isBundle ? copy("แพ็กเกจสมาชิก", "Membership packages") : copy("รายการสินค้า", "Products")}</button>
                <h1 className="break-words text-2xl font-semibold">{mode === "create" ? (isBundle ? copy("สร้างแพ็กเกจสมาชิก", "New membership package") : t("new")) : (th ? product.name_th || product.name_en : product.name_en || product.name_th)}</h1>
                <p className="mt-2 text-xs text-text-muted">{isBundle ? copy("แพ็กเกจรวมเกม", "Game collection") : form.type === "desktop_program" ? copy("เกม / โปรแกรม Windows", "Windows game / program") : "Roblox"} · {form.is_active ? copy("เปิดขาย", "Published") : copy("ปิดขาย / แบบร่าง", "Unpublished / draft")}</p>
            </div>
            {(!independent || dirty) && <div className="flex flex-wrap items-center gap-3 self-end">
                {dirty && <span className="text-xs text-text-muted">{copy("มีข้อมูลที่ยังไม่บันทึก", "Unsaved product changes")}</span>}
                <button type="button" onClick={handleSave} disabled={saving || videoUploading} className="min-h-11 rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">{saving ? t("saving") : mode === "create" ? copy("สร้างสินค้าและเพิ่มแพ็กเกจ →", "Create & add packages →") : copy("บันทึกข้อมูลสินค้า", "Save product details")}</button>
            </div>}
        </header>
        {notice && <div role={notice.error ? "alert" : "status"} className={"rounded-lg border px-4 py-3 text-sm " + (notice.error ? "border-red-500/30 bg-red-500/5 text-red-500" : "border-border-soft bg-bg-card text-text-base")}>{notice.text}</div>}
        <WorkspaceTabs label={copy("หมวดจัดการสินค้า", "Product workspace")} panelId="product-section" tabs={sections} value={activeSection.key} onChange={key => changeTab(sections.find(section => section.key === key)!.tabs[0].key)} />
        <div id="product-section" role="tabpanel" aria-label={activeSection.label} className="rounded-xl border border-border-soft bg-bg-card p-4 sm:p-6">
            <div className="mb-5 space-y-4">
                {activeSection.tabs.length > 1 && <WorkspaceTabs label={copy("ส่วนที่ต้องการแก้ไข", "Editor section")} panelId="product-editor" tabs={activeSection.tabs} value={activeTab} onChange={changeTab} />}
                <div><h2 className="text-base font-semibold">{activeSection.tabs.find(tab => tab.key === activeTab)?.label}</h2>
                <p className="mt-1 text-xs leading-relaxed text-text-muted">{independent ? copy("ส่วนนี้มีปุ่มบันทึกของตัวเอง การเปลี่ยนแปลงจะไม่รวมกับปุ่มบันทึกข้อมูลสินค้า", "This section saves separately using its own controls") : copy("แก้ไขส่วนนี้แล้วกด “บันทึกข้อมูลสินค้า” ด้านบน", "Use Save product details above to save this section")}</p></div>
            </div>
            {panel("info", <>
                {mode === "create" && <p className="rounded-lg bg-bg-base p-3 text-xs leading-relaxed text-text-muted">{copy("เริ่มจากชื่อและ URL จากนั้นกำหนดราคาหลักในหมวดราคา เมื่อสร้างแล้วจึงเพิ่มแพ็กเกจขาย รูปภาพ และการตั้งค่าเกมได้ สินค้าใหม่เริ่มเป็นแบบร่าง", "Start with names and URL, then set the base price under Pricing. Create the draft to add packages, images and game setup.")}</p>}
                <div className="grid gap-5 lg:grid-cols-2">
                    <Field label={t("label_name_th")} required>
                        <input id="product-name_th" value={form.name_th} onChange={(e) => set("name_th", e.target.value)}
                            placeholder="Roblox Live Map 1" className={input} />
                    </Field>

                    <Field label={t("label_name_en")} required>
                        <input id="product-name_en" value={form.name_en} onChange={(e) => handleNameEn(e.target.value)}
                            placeholder="Roblox Live Map 1" className={input} />
                    </Field>

                    <Field label={t("label_slug")} required>
                        <input id="product-slug" value={form.slug} onChange={(e) => set("slug", e.target.value)}
                            placeholder="roblox-live-map-1" className={input} />
                    </Field>

                    <Field label={t("label_product_type")}>
                        <select value={form.type} disabled={isBundle} onChange={(e) => set("type", e.target.value)} className={input}>
                            {isBundle && <option value="bundle">{locale === "th" ? "ชุดเกม AC" : "AC game bundle"}</option>}
                            <option value="roblox_whitelist">{t("type_roblox")}</option>
                            <option value="desktop_program">{t("type_desktop")}</option>
                        </select>
                    </Field>


                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                    {toggle("is_active", copy("เปิดขายสินค้า", "Publish product"), copy("แสดงสินค้าให้ลูกค้าเลือกซื้อ", "Show this product for purchase"))}
                    {toggle("is_featured", t("label_featured"), t("desc_featured"))}
                </div>
                {product?.id && <details className="border-t border-border-soft pt-4 text-xs text-text-muted"><summary className="cursor-pointer">{copy("รหัสอ้างอิงสินค้า", "Product reference")}</summary><p className="mt-3 break-all font-mono">{product.id}</p></details>}
            </>)}
            {isBundle && panel("membership", <div id="product-bundle_product_ids" tabIndex={-1} className="space-y-5">
                    {isBundle && <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border-soft bg-bg-base p-4"><input type="checkbox" className="mt-1 h-4 w-4 accent-accent" checked={form.bundle_all_ac_games} onChange={event => set("bundle_all_ac_games",event.target.checked)} /><span><span className="block text-sm font-semibold">{copy("รวมทุกเกมของร้าน ทั้งปัจจุบันและเกมใหม่", "Include all current and future store games")}</span><span className="mt-1 block text-xs leading-relaxed text-text-muted">{copy("ไม่รวมสินค้าฝากขายและพาร์ทเนอร์ เกมใหม่ได้รับสิทธิ์ตามวันหมดอายุเดิมของสมาชิก", "Excludes consignment and partner games. New games keep the original membership expiry.")}</span></span></label>}
                    {isBundle && !form.bundle_all_ac_games && <div className="lg:col-span-2"><BundleGamesManager value={form.bundle_product_ids} onChange={ids => set("bundle_product_ids", ids)} productId={product?.id} /></div>}
                    {isBundle && <label className="lg:col-span-2 flex cursor-pointer items-start gap-3 rounded-xl border border-border-soft bg-bg-base p-4"><input type="checkbox" className="mt-1 h-4 w-4 accent-accent" checked={form.bundle_includes_tikkies} onChange={event => set("bundle_includes_tikkies", event.target.checked)} /><span><span className="block text-sm font-semibold">Tikkies Full Access</span><span className="mt-1 block text-xs leading-relaxed text-text-muted">รวมสิทธิ์สมาชิก Tikkies ครบทุกฟังก์ชันตามระยะเวลาของแพ็กเกจ โดยบันทึกสิทธิ์ไว้ตอนสมัคร</span></span></label>}


            </div>)}
            {panel("pricing", <>
                <div className="max-w-xl">                    <Field label={t("label_price")} required>
                        <input id="product-price" type="number" min="0.01" step="0.01" value={form.price}
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => set("price", e.target.value)}
                            placeholder="550" className={input} />
                    </Field>

</div>
                <p className="text-xs leading-relaxed text-text-muted">{copy("ราคาหลักใช้เป็นราคาอ้างอิงของสินค้า ราคาที่ลูกค้าจ่ายให้ตั้งใน “แพ็กเกจที่ขาย”", "The base price is the product reference price. Set purchasable prices under Packages for sale.")}</p>
                <div className="grid gap-3 sm:grid-cols-2">
                    {mode === "edit" && toggle("has_limited_discount", copy("ส่วนลดจำนวนจำกัด", "Limited quantity discount"), copy("เปิดใช้และกำหนดเปอร์เซ็นต์กับจำนวนในแต่ละแพ็กเกจ", "Enable, then set the percentage and quantity per package"))}
                    {toggle("isLower", t("label_low_stock"), t("desc_low_stock"))}
                </div>
                {mode === "create" && <p className="text-xs text-text-muted">{copy("สร้างสินค้าก่อนเพื่อกำหนดส่วนลดและแพ็กเกจที่ขาย", "Create the product before configuring discounts and purchasable packages")}</p>}
                {mode === "edit" && <button type="button" onClick={() => changeTab("variants")} className="min-h-11 text-sm font-medium text-accent-light underline underline-offset-4">{copy("จัดการแพ็กเกจที่ขาย →", "Manage packages for sale →")}</button>}
            </>)}
            {panel("content", <>
                <fieldset className="min-w-0 space-y-3"><legend className="mb-3 text-sm font-medium">{copy("คำอธิบายสินค้า", "Product description")}</legend>
                    <WorkspaceTabs label={copy("ภาษาคำอธิบาย", "Description language")} tabs={[{ key: "th", label: "ภาษาไทย" }, { key: "en", label: "English" }]} value={descriptionLanguage} onChange={setDescriptionLanguage} />
                    <div hidden={descriptionLanguage !== "th"}><TiptapEditor content={form.description_th} onChange={html => set("description_th", html)} /></div>
                    <div hidden={descriptionLanguage !== "en"}><TiptapEditor content={form.description_en} onChange={html => set("description_en", html)} /></div>
                </fieldset>
                <div className="grid gap-5 border-t border-border-soft pt-5 lg:grid-cols-2">
                    <Field label={t("label_youtube_url")} className="lg:col-span-2">
                        <div className="space-y-2">
                            {form.videos.length === 0 && (
                                <p className="text-[12px] text-text-muted">{t("no_videos")}</p>
                            )}
                            {form.videos.map((url, i) => (
                                <div key={i} className="flex items-center gap-2">
                                    <input
                                        aria-label={copy("วิดีโอ YouTube", "YouTube video") + " " + (i + 1)}
                                        value={url}
                                        onChange={(e) => setVideo(i, e.target.value)}
                                        placeholder="https://www.youtube.com/watch?v=..."
                                        className={input}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => removeVideo(i)}
                                        className="shrink-0 w-9 h-9 flex items-center justify-center rounded-lg border border-red-400/25 text-red-400 hover:bg-red-500/10 transition-colors"
                                        aria-label={copy("ลบวิดีโอ", "Remove video") + " " + (i + 1)}
                                    >
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                                    </button>
                                </div>
                            ))}
                            <button
                                type="button"
                                onClick={addVideo}
                                className="text-[13px] px-3 py-1.5 rounded-lg bg-accent/15 text-accent-light hover:bg-accent/25 transition-colors"
                            >
                                + {t("add_video")}
                            </button>
                        </div>
                    </Field>

                    <Field label={t("label_tutorial_video_url")}>
                        <input
                            value={form.tutorial_video_url}
                            onChange={(e) => set("tutorial_video_url", e.target.value)}
                            placeholder="https://www.youtube.com/watch?v=..."
                            className={input}
                        />
                    </Field>

                    {/* Preview video — shown on card hover. Max 10s / 20MB. */}
                    <Field label={t("label_preview_video")} className="lg:col-span-2">
                        <div className="space-y-2">
                            <div className="flex flex-wrap items-center gap-3">
                                <label
                                    className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-accent/20 bg-white/[0.03] text-[13px] cursor-pointer hover:border-accent/40 transition ${videoUploading ? "opacity-50 pointer-events-none" : ""}`}
                                >
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <polygon points="23 7 16 12 23 17 23 7"/>
                                        <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
                                    </svg>
                                    {videoUploading ? t("uploading") : t("choose_video")}
                                    <input
                                        type="file"
                                        accept="video/mp4,video/webm,video/quicktime"
                                        onChange={(e) => {
                                            const f = e.target.files?.[0]
                                            if (f) handlePreviewVideoUpload(f)
                                            e.target.value = ""
                                        }}
                                        className="sr-only"
                                    />
                                </label>
                                {form.preview_video_url && (
                                    <button
                                        type="button"
                                        onClick={() => { set("preview_video_url", ""); setVideoError(null) }}
                                        className="text-[12px] text-red-400 hover:underline"
                                    >
                                        {t("remove_video")}
                                    </button>
                                )}
                                <span className="text-[11px] text-text-muted">
                                    {t("preview_video_hint")}
                                </span>
                            </div>

                            {videoError && (
                                <p className="text-[12px] text-red-400">{videoError}</p>
                            )}

                            {form.preview_video_url && (
                                <div className="mt-2 max-w-sm rounded-xl overflow-hidden border border-accent/15 bg-black">
                                    <video
                                        src={form.preview_video_url}
                                        controls
                                        muted
                                        preload="metadata"
                                        className="w-full aspect-video object-cover"
                                    />
                                    <p className="text-[10px] text-text-muted px-3 py-1.5 font-mono break-all">
                                        {form.preview_video_url}
                                    </p>
                                </div>
                            )}
                        </div>
                    </Field>


                </div>
            </>)}
            {panel("delivery", <>
                <div className="grid gap-5 lg:grid-cols-2">
                    {form.type === "desktop_program" && (
                        <Field label={t("label_program_key")} required>
                            <input id="product-program_key" value={form.program_key} onChange={(e) => set("program_key", e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                                placeholder="ac_pig_panic" className={input} />
                        </Field>
                    )}

                    {form.type === "desktop_program" && (
                        <Field label={t("label_download_url")}>
                            <input value={form.download_url} onChange={(e) => set("download_url", e.target.value)}
                                placeholder="https://github.com/.../ACPigPanic-1.3.4-setup.exe" className={input} />
                        </Field>
                    )}


                    <Field label={t("label_info_url")}>
                        <input
                            value={form.info_page_url}
                            onChange={(e) => set("info_page_url", e.target.value)}
                            placeholder="https://roblox.com"
                            className={input}
                        />
                    </Field>


                </div>
                {integrationPanel && <div className="border-t border-border-soft pt-5"><p className="text-xs text-text-muted">{copy("การเชื่อมต่อ Roblox ด้านล่างใช้ปุ่มบันทึกการเชื่อมต่อของตัวเอง", "Roblox mapping below uses its own save button")}</p>{integrationPanel}</div>}
                {mode === "edit" ? <details className="rounded-lg border border-border-soft p-4"><summary className="cursor-pointer text-sm font-medium">{copy("ให้บทบาท Discord หลังซื้อ (ถ้ามี)", "Discord role after purchase (optional)")}</summary><div className="mt-4 grid gap-5 lg:grid-cols-2">                    <Field label={t("label_discord_role")}>
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

</div></details> : <p className="text-xs text-text-muted">{copy("หลังสร้างสินค้า สามารถตั้งค่าการเชื่อมต่อ Discord และการแบ่งรายได้ได้", "After creating the product, configure Discord integration and revenue sharing")}</p>}
            </>)}
            {panel("revenue", <>
                    {/* Revenue Model Selection */}
                    {!isBundle && <Field label={copy("รูปแบบรายได้", "Revenue model")} className="lg:col-span-2">
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
                                        {copy("สินค้าของร้าน / แบ่งรายได้", "Store product / partnership")}
                                    </p>
                                    <p className="text-[11px] text-text-muted opacity-80">
                                        {copy("ตั้งสัดส่วนรายได้ให้หุ้นส่วนของร้าน", "Allocate revenue to store partners")}
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
                                        {copy("กำหนดเจ้าของสินค้าและค่าธรรมเนียมร้าน", "Set the vendor and store commission")}
                                    </p>
                                </div>
                            </button>
                        </div>
                    </Field>}


                {mode === "edit" && (form.is_consignment && !isBundle ? <ConsignmentManager productId={product.id} initialConsignments={form.consignments} onUpdate={list => set("consignments", list)} productPrice={Number(form.price)} platformCommission={Number(form.commission_pct)} onCommissionChange={value => set("commission_pct", value)} /> : <PartnershipManager productId={product.id} allPartners={allPartners ?? []} initialShares={form.partnership_shares} onUpdate={list => set("partnership_shares", list)} />)}
                {mode === "create" && <p className="text-xs text-text-muted">{copy("สร้างสินค้าก่อน แล้วจึงกำหนดรายชื่อและสัดส่วนรายได้", "Create the product first to configure owners and revenue shares")}</p>}
            </>)}
            {mode === "edit" && <>
                {panel("variants", <VariantManager productId={product.id} variants={product.product_variants} allowPremium={!isBundle} />)}
                {panel("images", <ImageManager productId={product.id} images={product.product_images} />)}
                {panel("features", <FeatureManager productId={product.id} features={product.product_features ?? []} />)}
                {!isBundle && <>
                    {panel("gifts", <GiftManager productId={product.id} gifts={product.product_gifts ?? []} />)}
                    {panel("presets", <PresetManager productId={product.id} presets={product.product_presets ?? []} />)}
                    {supportsGameDefaults ? panel("defaults", <GameDefaultsManager productId={product.id} allGifts={allGifts ?? []} />) : panel("functions", <FunctionManager productId={product.id} functions={product.product_functions ?? []} allGifts={allGifts ?? []} />)}
                </>}
            </>}
        </div>
        {!independent && <div className="sticky bottom-0 z-20 flex flex-wrap items-center justify-end gap-3 rounded-lg border border-border-soft bg-bg-card p-3">
            <span className="mr-auto text-xs text-text-muted">{dirty ? copy("มีข้อมูลที่ยังไม่บันทึก", "Unsaved product changes") : copy("ข้อมูลสินค้า", "Product details")}</span>
            <button type="button" onClick={handleSave} disabled={saving || videoUploading} className="min-h-11 rounded-lg bg-accent px-4 text-sm font-semibold text-white disabled:opacity-50">{saving ? t("saving") : mode === "create" ? copy("สร้างสินค้า", "Create product") : copy("บันทึกข้อมูลสินค้า", "Save product details")}</button>
        </div>}
    </div>
}

function Field({ label, children, required, className = "" }: { label: ReactNode; children: ReactNode; required?: boolean; className?: string }) {
    const generatedId = useId()
    const control = isValidElement(children) && typeof children.type === "string" && ["input", "select", "textarea"].includes(children.type)
    const child = children as ReactElement<{ id?: string; "aria-required"?: boolean }>
    const id = control ? child.props.id ?? generatedId : generatedId
    return <div className={className}>
        {control ? <label htmlFor={id} className="mb-2 block text-xs font-medium text-text-muted">{label}{required && <span className="ml-1 text-red-500">*</span>}</label> : <div id={id} className="mb-2 text-xs font-medium text-text-muted">{label}</div>}
        {control ? cloneElement(child, { id, "aria-required": required }) : <div role="group" aria-labelledby={id}>{children}</div>}
    </div>
}
const input = "w-full min-h-11 bg-bg-input border border-border-soft rounded-lg px-3 py-2.5 text-sm text-text-base placeholder:text-text-dim outline-none focus:border-accent focus:ring-1 focus:ring-accent transition"
