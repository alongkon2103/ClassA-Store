import { Suspense } from "react"
import ProductsClient from "./ProductsClient"
import { prisma } from "@/lib/prisma"
import { setRequestLocale } from "next-intl/server";

// ISR cache the catalog page for 60s. Stock counts may be slightly stale, but
// per-variant stock is re-checked on the ProductModal/checkout step.
export const revalidate = 60

export default async function Page({
    params
}: {
    params: Promise<{ locale: string }>;
}) {
    const { locale } = await params;
    setRequestLocale(locale);

    const products = await prisma.products.findMany({
        where: { is_active: true },
        include: {
            product_images: true,
            product_variants: {
                where: { is_active: true },
                orderBy: { sort_order: "asc" },
                include: {
                    _count: {
                        select: {
                            game_keys: { where: { status: "available" } },
                        },
                    },
                },
            },
        },
        orderBy: [
            { is_featured: "desc" }, // This comes first
            { created_at: "desc" },  // Then sort by time
        ],
    })

    // Strikethrough preview prices are computed CLIENT-side (per shopper, via
    // useAutoDiscounts) so each user sees the best code THEY can still use —
    // the server render is shared/ISR-cached and can't be personalised.
    const safeProducts = products.map((p) => ({
        ...p,
        price: Number(p.price),
        commission_pct: Number(p.commission_pct ?? 0),
        is_partner: false,

        product_variants: p.product_variants.map((v) => ({
            ...v,
            price: Number(v.price),
            premium_addon_price: Number(v.premium_addon_price ?? 0),
            discount_pct: Number(v.discount_pct ?? 0),
            stock: v._count.game_keys, // stock per variant
        })),
    }))

    // Partner games (external, synced from a partner's affiliate API). Shown in
    // the SAME grid but they open a separate modal and the buy button links out
    // to the partner site. Only visible rows from active partners.
    const partnerRows = await prisma.partner_products.findMany({
        where: { is_visible: true, partner: { is_active: true } },
        include: { partner: { select: { display_name: true } } },
        orderBy: { sort_order: "asc" },
    })
    const partnerItems = partnerRows.map((pp) => normalizePartner(pp))

    // Merge: partner games sit right after our featured products so they get
    // prominent placement without pushing the rest of the catalog down far.
    const featured = safeProducts.filter((p) => p.is_featured)
    const rest = safeProducts.filter((p) => !p.is_featured)
    const merged = [...featured, ...partnerItems, ...rest]

    // Suspense is required because ProductsClient reads useSearchParams() for
    // the ?slug=… deep link. Without it, prerendering (ISR) bails with an
    // unhandled CSR-bailout error.
    return (
        <Suspense fallback={null}>
            <ProductsClient initialProducts={merged} />
        </Suspense>
    )
}

// Turn a partner_products row into the card/modal shape used by the grid. Plans
// map to "variants" (list price + final price) so the existing strikethrough
// rendering just works; `is_partner` + `partner` carry everything the modal needs.
type PartnerPlan = {
    label_th?: string; label_en?: string; duration_days?: number | null; is_lifetime?: boolean
    list_price_thb?: number; list_price_usd?: number; discount_thb?: number
    price_thb?: number; price_usd?: number
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizePartner(pp: any) {
    const plans: PartnerPlan[] = Array.isArray(pp.plans) ? pp.plans : []
    const images: string[] = Array.isArray(pp.images) ? pp.images : []
    return {
        id: `partner:${pp.id}`,
        slug: pp.external_slug,
        name_th: pp.name_th,
        name_en: pp.name_en,
        price: Number(pp.price_from_thb ?? 0),
        commission_pct: Number(pp.commission_pct ?? 0),
        is_featured: false,
        isLower: false,
        is_partner: true,
        partner_name: pp.partner?.display_name ?? "Partner",
        product_images: pp.thumbnail_url ? [{ url: pp.thumbnail_url }] : images.slice(0, 1).map((url) => ({ url })),
        preview_video_url: null,
        // Card display: full (list) price with the final price as the "deal".
        product_variants: plans.map((pl, idx) => ({
            id: `${pp.id}-plan-${idx}`,
            label_th: pl.label_th ?? pl.label_en ?? "",
            label_en: pl.label_en ?? pl.label_th ?? "",
            price: Number(pl.list_price_thb ?? pl.price_thb ?? 0),
            discounted_price: Number(pl.price_thb ?? pl.list_price_thb ?? 0),
            is_active: true,
            variant_type: "normal",
        })),
        // Everything the PartnerModal renders.
        partner: {
            name_th: pp.name_th,
            name_en: pp.name_en,
            description_html_th: pp.description_html_th,
            description_html_en: pp.description_html_en,
            badge: pp.badge,
            ref_url: pp.ref_url,
            game_link_url: pp.game_link_url,
            price_from_thb: Number(pp.price_from_thb ?? 0),
            price_from_usd: Number(pp.price_from_usd ?? 0),
            images,
            videos: Array.isArray(pp.videos) ? pp.videos : [],
            plans,
        },
    }
}