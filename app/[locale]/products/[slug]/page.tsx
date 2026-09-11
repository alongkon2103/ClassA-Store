// Dedicated product page (PDP) — a beautiful, shareable, SEO-friendly page for
// a single product, used mainly as the destination for affiliate links
// (/products/<slug>?ref=CODE). The shop grid (/products) is intentionally left
// untouched: this is an ADDITIVE entry point.
//
// Buying reuses the existing ProductModal (read-only) — no duplication of the
// money-critical checkout logic. Personalised discount strikethrough + the
// affiliate ref are handled client-side by the same useAutoDiscounts hook the
// shop cards use.

import type { Metadata } from "next"
import { Suspense } from "react"
import { notFound } from "next/navigation"
import { setRequestLocale } from "next-intl/server"
import { prisma } from "@/lib/prisma"
import { getImageUrl } from "@/lib/getImageUrl"
import ProductPageClient from "./ProductPageClient"
import { getPointsConfig, pointsActive } from "@/lib/points"
import { withLiveMinimums, planAvailable } from "@/lib/maki"

export const revalidate = 60

type Params = { params: Promise<{ locale: string; slug: string }> }

// Absolute URL for OG/JSON-LD images (social crawlers need absolute URLs).
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_BASE_URL || ""
function absUrl(path: string): string {
  if (!path) return ""
  const withBase = getImageUrl(path)
  if (withBase.startsWith("http")) return withBase
  return APP_URL ? `${APP_URL}${withBase.startsWith("/") ? "" : "/"}${withBase}` : withBase
}

// Strip HTML → short plain-text for meta description.
function toPlainText(html: string | null | undefined, max = 155): string {
  if (!html) return ""
  const text = html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim()
  return text.length > max ? text.slice(0, max - 1).trimEnd() + "…" : text
}

// Pre-render every active product at build; new/unknown slugs still render
// on-demand (dynamicParams defaults to true) and get cached by ISR.
export async function generateStaticParams() {
  const products = await prisma.products.findMany({ where: { is_active: true }, select: { slug: true } })
  return products.map((p) => ({ slug: p.slug }))
}

async function getProduct(slug: string) {
  return prisma.products.findFirst({
    where: { slug, is_active: true },
    include: {
      product_images: { orderBy: { sort_order: "asc" } },
      product_videos: { orderBy: { sort_order: "asc" } },
      product_variants: {
        where: { is_active: true },
        orderBy: { sort_order: "asc" },
        include: { _count: { select: { game_keys: { where: { status: "available" } } } } },
      },
    },
  })
}

// เกมพาร์ทเนอร์แบบขายในเว็บเรา (Maki) ใช้ slug เดียวกัน /products/<slug> — ถ้าไม่ใช่สินค้าเราค่อยหาในนี้
async function getMakiProduct(slug: string) {
  const row = await prisma.partner_products.findFirst({
    where: { external_slug: slug, is_visible: true, coming_soon: false, partner: { is_active: true, integration: "maki_api" } },
    include: { partner: { select: { display_name: true } } },
  })
  if (!row) return null
  const [live] = await withLiveMinimums([row])
  return live
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale, slug } = await params
  const product = await getProduct(slug)
  if (!product) {
    const pp = await getMakiProduct(slug)
    if (!pp) return { title: "Not found" }
    const isTH = locale === "th"
    const name = isTH ? pp.name_th : pp.name_en
    const desc = toPlainText(isTH ? (pp.description_html_th || pp.description_html_en) : (pp.description_html_en || pp.description_html_th))
    const first = Array.isArray(pp.images) ? (pp.images as string[])[0] : undefined
    const img = pp.thumbnail_url || first
    return {
      title: `${name} — ${pp.partner.display_name}`,
      description: desc || undefined,
      openGraph: { type: "website", title: name, description: desc || undefined, ...(img ? { images: [{ url: absUrl(img), alt: name }] } : {}) },
    }
  }

  const isTH = locale === "th"
  const name = isTH ? product.name_th : product.name_en
  const desc = toPlainText(isTH ? (product.description_th || product.description_en) : (product.description_en || product.description_th))
  const img = product.product_images[0]?.url ? absUrl(product.product_images[0].url) : undefined
  const url = `${APP_URL}${isTH ? "/th" : ""}/products/${slug}`

  return {
    title: name,
    description: desc || undefined,
    ...(APP_URL ? { metadataBase: new URL(APP_URL) } : {}),
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      title: name,
      description: desc || undefined,
      url,
      ...(img ? { images: [{ url: img, alt: name }] } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: name,
      description: desc || undefined,
      ...(img ? { images: [img] } : {}),
    },
  }
}

export default async function Page({ params }: Params) {
  const { locale, slug } = await params
  setRequestLocale(locale)

  const product = await getProduct(slug)
  if (!product) {
    // ── เกม Maki ──
    const pp = await getMakiProduct(slug)
    if (!pp) notFound()
    const [relatedRaw, pointsCfgMaki, ratingAgg] = await Promise.all([
      prisma.products.findMany({
        where: { is_active: true },
        orderBy: [{ is_featured: "desc" }, { created_at: "desc" }],
        take: 4,
        include: {
          product_images: { orderBy: { sort_order: "asc" }, take: 1 },
          product_variants: { where: { is_active: true }, select: { price: true, variant_type: true } },
        },
      }),
      getPointsConfig(),
      prisma.product_reviews.aggregate({ where: { partner_product_id: pp.id }, _avg: { rating: true }, _count: { _all: true } }),
    ])
    const related = relatedRaw.map((p) => {
      const prices = p.product_variants.filter((v) => v.variant_type !== "premium").map((v) => Number(v.price))
      return { slug: p.slug, name_th: p.name_th, name_en: p.name_en, image: p.product_images[0]?.url ?? null, min_price: prices.length ? Math.min(...prices) : Number(p.price) }
    })
    // หน้าเกม Maki = คอมโพเนนต์เดียวกับเกมเรา (รีวิว กดใจ รายการโปรด แชร์ FAQ สินค้าอื่น) + โหมด maki ตอนซื้อ
    const images = Array.isArray(pp.images) ? (pp.images as string[]) : []
    const gallery = pp.thumbnail_url && !images.includes(pp.thumbnail_url) ? [pp.thumbnail_url, ...images] : images
    const plans = pp.plans.filter(planAvailable)
    const videos = (Array.isArray(pp.videos) ? (pp.videos as { youtube_url?: string | null; embed_url?: string | null }[]) : [])
      .map((v) => v.youtube_url || v.embed_url || "").filter(Boolean)
    return (
      <ProductPageClient
        product={{
          id: pp.id, slug: pp.external_slug, name_th: pp.name_th, name_en: pp.name_en,
          description_th: pp.description_html_th, description_en: pp.description_html_en,
          videos, preview_video_url: pp.preview_video_url ?? null,
          price: plans.length ? Math.min(...plans.map((x) => x.sell_price_thb as number)) : 0,
          product_images: gallery.map((url) => ({ url })),
          product_variants: plans.map((x) => ({
            id: x.key, label_th: x.label_th, label_en: x.label_en, price: x.sell_price_thb as number,
            variant_type: "normal", is_active: true, stock: 999,
            duration_type: x.is_lifetime ? "permanent" : "rental", duration_days: x.duration_days,
          })),
        }}
        related={related}
        reviewSummary={{ average: Math.round((ratingAgg._avg.rating ?? 0) * 10) / 10, count: ratingAgg._count._all }}
        pointsPerBaht={pointsActive(pointsCfgMaki) ? pointsCfgMaki.perBaht : null}
        maki={{
          partnerName: pp.partner.display_name,
          hasPreset: plans.some((x) => !!x.preset_link),
          plans: plans.map((x) => ({ key: x.key, label_th: x.label_th, label_en: x.label_en, price: x.sell_price_thb as number, min: x.min_price_thb, duration_days: x.duration_days, is_lifetime: x.is_lifetime })),
        }}
      />
    )
  }

  // Related: other active products, featured first then newest, take 4.
  const relatedRaw = await prisma.products.findMany({
    where: { is_active: true, NOT: { id: product.id } },
    orderBy: [{ is_featured: "desc" }, { created_at: "desc" }],
    take: 4,
    include: {
      product_images: { orderBy: { sort_order: "asc" }, take: 1 },
      product_variants: { where: { is_active: true }, select: { price: true, variant_type: true } },
    },
  })

  // Number-convert every Decimal before it crosses to the Client Component.
  const safeProduct = {
    ...product,
    videos: product.product_videos.map((v) => v.url),
    price: Number(product.price),
    commission_pct: Number(product.commission_pct ?? 0),
    created_at: product.created_at?.toISOString() ?? null,
    updated_at: product.updated_at?.toISOString() ?? null,
    product_variants: product.product_variants.map((v) => ({
      ...v,
      price: Number(v.price),
      premium_addon_price: Number(v.premium_addon_price ?? 0),
      discount_pct: Number(v.discount_pct ?? 0),
      stock: v._count.game_keys,
      created_at: v.created_at?.toISOString() ?? null,
      updated_at: v.updated_at?.toISOString() ?? null,
    })),
  }

  const related = relatedRaw.map((p) => {
    const prices = p.product_variants.filter((v) => v.variant_type !== "premium").map((v) => Number(v.price))
    return {
      slug: p.slug,
      name_th: p.name_th,
      name_en: p.name_en,
      image: p.product_images[0]?.url ?? null,
      min_price: prices.length ? Math.min(...prices) : Number(p.price),
    }
  })

  // สรุปคะแนนรีวิว (ค่าเฉลี่ย + จำนวน) — แสดงใต้ชื่อสินค้าและบนแท็บรีวิว
  const ratingAgg = await prisma.product_reviews.aggregate({
    where: { product_id: product.id },
    _avg: { rating: true },
    _count: { _all: true },
  })
  // จุดเด่นที่แอดมินพิมพ์เอง (แท็บ Feature ใน admin) — โชว์ในแท็บรายละเอียด
  const features = await prisma.product_features.findMany({
    where: { product_id: product.id },
    orderBy: { sort_order: "asc" },
    select: { id: true, text_th: true, text_en: true },
  })

  const functions = await prisma.product_functions.findMany({
    where: { product_id: product.id },
    orderBy: { sort_order: "asc" },
    select: { id: true, name: true, label_th: true, label_en: true },
  })

  const reviewSummary = {
    average: Math.round((ratingAgg._avg.rating ?? 0) * 10) / 10,
    count: ratingAgg._count._all,
  }

  // Product JSON-LD for rich results (server-rendered into initial HTML).
  const isTH = locale === "th"
  // AC Points: อัตราแต้มตอนนี้ (null = ระบบปิด) ให้หน้าเกมโชว์ "รับ x แต้ม" ต่อแพ็กเกจ
  const pointsCfg = await getPointsConfig()
  const pointsPerBaht = pointsActive(pointsCfg) ? pointsCfg.perBaht : null
  const name = isTH ? product.name_th : product.name_en
  const variantPrices = safeProduct.product_variants.filter((v) => v.variant_type !== "premium").map((v) => v.price)
  const lowPrice = variantPrices.length ? Math.min(...variantPrices) : safeProduct.price
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name,
    description: toPlainText(isTH ? (product.description_th || product.description_en) : (product.description_en || product.description_th), 300),
    ...(product.product_images[0]?.url ? { image: absUrl(product.product_images[0].url) } : {}),
    offers: {
      "@type": "Offer",
      priceCurrency: "THB",
      price: lowPrice,
      availability: "https://schema.org/InStock",
      url: `${APP_URL}${isTH ? "/th" : ""}/products/${product.slug}`,
    },
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      {/* Suspense: ProductPageClient reads useSearchParams() for ?ref=CODE.
          Without it, ISR prerender bails with a CSR-bailout error. */}
      <Suspense fallback={null}>
        <ProductPageClient product={safeProduct} related={related} reviewSummary={reviewSummary} functions={functions} features={features} pointsPerBaht={pointsPerBaht} />
      </Suspense>
    </>
  )
}
