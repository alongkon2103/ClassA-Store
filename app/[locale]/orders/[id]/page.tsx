import { prisma } from "@/lib/prisma"
import Navbar from "@/components/Navbar"
import Footer from "@/components/home/Footer"
import { format } from "date-fns"
import Image from "next/image"
import { Link } from "@/i18n/routing"
import { setRequestLocale, getTranslations } from "next-intl/server"
import OrderStatusPoller from "@/components/orders/OrderStatusPoller"

export default async function OrderPage({ params }: { params: Promise<{ id: string, locale: string }> }) {
    const { id, locale } = await params
    setRequestLocale(locale)
    const t = await getTranslations("Orders")

    const order = await prisma.orders.findUnique({
        where: { id },
        include: {
            game_keys: true,
            product_variants: true,
            products: {
                include: {
                    product_images: { orderBy: { sort_order: "asc" }, take: 1 },
                    product_gifts: { orderBy: { sort_order: "asc" } },
                    product_presets: { orderBy: { sort_order: "asc" } },
                },
            },
        },
    })

    if (!order) {
        return (
            <div className="min-h-screen bg-bg-base">
                <Navbar />
                <div className="flex flex-col items-center justify-center py-20 px-6">
                    <div className="text-[64px] mb-4">🔍</div>
                    <h1 className="text-2xl font-bold text-text-base mb-2">{t("order_not_found")}</h1>
                    <p className="text-text-muted mb-8 text-center">{t("order_not_found_desc")}</p>
                    <Link href="/orders" className="bg-accent hover:opacity-90 text-white px-6 py-3 rounded-xl font-semibold transition">
                        {t("back_to_orders")}
                    </Link>
                </div>
                <Footer />
            </div>
        )
    }

    const mainImage = order.products.product_images[0]?.url || "/next.svg"

    return (
        <div className="min-h-screen bg-bg-base selection:bg-accent/30 selection:text-accent-light">
            <Navbar />
            <OrderStatusPoller orderId={order.id} currentStatus={order.status} hasKey={!!order.game_keys} />

            <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 md:py-12">
                {/* Header Section */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8 md:mb-10">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <span className="text-[10px] md:text-[12px] font-bold uppercase tracking-[0.2em] text-accent-light bg-accent/10 px-3 py-1 rounded-full border border-accent/20">
                                {t("order_successful")}
                            </span>
                            <span className="text-text-muted text-[12px]">
                                {order.created_at ? format(new Date(order.created_at), "dd MMM yy") : "—"}
                            </span>
                        </div>
                        <h1 className="text-2xl md:text-4xl font-display font-bold text-text-base leading-tight">
                            {t("order_log")}
                        </h1>
                    </div>
                    <div className="md:text-right self-start md:self-auto">
                        <p className="text-text-muted text-[10px] md:text-[11px] uppercase tracking-wider mb-1">{t("transaction_id")}</p>
                        <p className="font-mono text-[12px] text-text-muted/80 bg-bg-card px-3 py-1.5 rounded-lg border border-accent/10 break-all">
                            {order.id}
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8">
                    {/* Main Content (Left) */}
                    <div className="lg:col-span-8 space-y-6 md:space-y-8">

                        {/* 🔑 THE KEY SECTION */}
                        <div className="relative group">
                            <div className="absolute -inset-0.5 bg-gradient-to-r from-accent to-accent-light opacity-10 rounded-2xl md:rounded-3xl blur transition duration-1000"></div>
                            <div className="relative bg-bg-card border border-accent/10 rounded-2xl md:rounded-3xl p-5 md:p-8 overflow-hidden">
                                <h2 className="text-lg font-bold text-text-base mb-6 flex items-center gap-2">
                                    <span className="w-8 h-8 md:w-10 md:h-10 rounded-lg bg-accent/20 flex items-center justify-center text-accent-light">
                                        <KeyIcon />
                                    </span>
                                    {t("license_details")}
                                </h2>

                                {order.status === "paid" ? (
                                    <div className="space-y-4">
                                        <div className="bg-bg-base/50 border border-accent/10 rounded-xl md:rounded-2xl p-4 md:p-6 text-center group/key relative overflow-hidden">
                                            <p className="font-mono text-lg md:text-2xl font-bold tracking-wider text-accent-light break-all relative z-10">
                                                {order.game_keys?.key_value || t("processing_key")}
                                            </p>
                                        </div>
                                        <p className="text-[12px] text-text-muted text-center italic">
                                            {t("activation_hint")}
                                        </p>
                                    </div>
                                ) : (
                                    <div className="py-10 text-center">
                                        <div className="animate-spin w-8 h-8 border-2 border-accent border-t-transparent rounded-full mx-auto mb-4"></div>
                                        <p className="text-text-muted text-[14px]">{t("waiting_confirmation")}</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* 🎁 ASSETS SECTION */}
                        {order.status === "paid" && (order.products.product_gifts.length > 0 || order.products.product_presets.length > 0) && (
                            <div className="bg-bg-card border border-accent/10 rounded-2xl md:rounded-3xl p-5 md:p-8">
                                <h2 className="text-lg font-bold text-text-base mb-6 md:mb-8 flex items-center gap-2">
                                    <span className="w-8 h-8 rounded-lg bg-violet-500/20 flex items-center justify-center text-violet-400 text-[14px]">
                                        <DownloadIcon />
                                    </span>
                                    {t("digital_assets")}
                                </h2>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {/* Assets */}
                                    {order.products.product_gifts.map((gift) => (
                                        <div key={gift.id} className="flex flex-col bg-bg-base/30 border border-accent/10 rounded-xl p-4 transition-colors hover:border-violet-500/30">
                                            <div className="flex items-center gap-4 mb-4">
                                                <div className="w-10 h-10 rounded-lg bg-violet-500/10 flex items-center justify-center text-[18px]">
                                                    <ImageIcon />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-[13px] font-bold text-text-base truncate">{gift.filename || t("media_asset")}</p>
                                                    <p className="text-[10px] text-text-muted uppercase tracking-wider">{t("image_asset")}</p>
                                                </div>
                                            </div>
                                            <a href={gift.url} target="_blank" rel="noopener noreferrer" className="mt-auto w-full py-2 bg-accent/5 hover:bg-violet-600 text-text-base text-[12px] font-semibold rounded-lg text-center transition">
                                                {t("download")}
                                            </a>
                                        </div>
                                    ))}

                                    {/* Presets */}
                                    {order.products.product_presets.map((preset) => (
                                        <div key={preset.id} className="flex flex-col bg-bg-base/30 border border-accent/10 rounded-xl p-4 transition-colors hover:border-blue-500/30">
                                            <div className="flex items-center gap-4 mb-4">
                                                <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center text-[18px]">
                                                    ⚙️
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-[13px] font-bold text-text-base truncate">{preset.filename || "Config"}</p>
                                                    <p className="text-[10px] text-text-muted uppercase tracking-wider">{t("config_preset")}</p>
                                                </div>
                                            </div>
                                            <a href={preset.url} target="_blank" rel="noopener noreferrer" className="mt-auto w-full py-2 bg-accent/5 hover:bg-blue-600 text-text-base text-[12px] font-semibold rounded-lg text-center transition">
                                                {t("download")}
                                            </a>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Sidebar (Right) */}
                    <div className="lg:col-span-4 space-y-4 md:space-y-6">
                        <div className="bg-bg-card border border-accent/10 rounded-2xl md:rounded-3xl overflow-hidden shadow-2xl">
                            <div className="relative aspect-[21/9] lg:aspect-video">
                                <Image src={mainImage} alt={locale === 'th' ? order.products.name_th : order.products.name_en} fill className="object-cover" />
                                <div className="absolute inset-0 bg-gradient-to-t from-bg-card via-transparent to-transparent"></div>
                            </div>
                            <div className="p-5 md:p-6">
                                <h3 className="text-[16px] md:text-[18px] font-bold text-text-base mb-1">
                                    {locale === 'th' ? order.products.name_th : order.products.name_en}
                                </h3>
                                <p className="text-accent-light text-[13px] font-medium mb-4">
                                    {locale === 'th' ? (order.product_variants?.label_th || t("standard_version")) : (order.product_variants?.label_en || t("standard_version"))}
                                </p>

                                <div className="space-y-3 pt-4 border-t border-accent/10">
                                    <div className="flex justify-between text-[12px]">
                                        <span className="text-text-muted">{t("paid_amount")}</span>
                                        <span className="text-text-base font-bold text-[15px]">
                                            ฿{Number(order.amount).toLocaleString()}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <Link href="/orders" className="flex items-center justify-center gap-2 w-full py-3 border border-accent/10 text-text-muted hover:text-text-base text-[12px] font-medium rounded-xl transition">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" /></svg>
                            {t("back_to_inventory")}
                        </Link>
                    </div>
                </div>
            </main>

            <Footer />
        </div>
    )
}


function ExternalIcon({ size = 20 }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
            <polyline points="15 3 21 3 21 9" />
            <line x1="10" y1="14" x2="21" y2="3" />
        </svg>
    )
}

function CloseIcon({ size = 20 }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
        </svg>
    )
}

function KeyIcon({ size = 20 }: { size?: number }) {
    return (
        <svg
            width={size}
            height={size}
            className="w-4 h-4 md:w-6 md:h-6" 
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
        </svg>
    )
}

function KeyIconDesktop({ mdSize = 24 }: { mdSize?: number }) {
    return (
        <svg
            className="hidden md:block" width={mdSize} height={mdSize} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        >
            <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
        </svg>
    )
}

function ImageIcon({ size = 20 }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" />
        </svg>
    )
}

function PresetIcon({ size = 20 }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.1a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" /><circle cx="12" cy="12" r="3" />
        </svg>
    )
}

function DownloadIcon({ size = 20, className = "" }: { size?: number, className?: string }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
        </svg>
    )
}
