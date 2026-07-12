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

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale, slug } = await params
  const product = await getProduct(slug)
  if (!product) return { title: "Not found" }

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
  if (!product) notFound()

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

  // Product JSON-LD for rich results (server-rendered into initial HTML).
  const isTH = locale === "th"
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
        <ProductPageClient product={safeProduct} related={related} />
      </Suspense>
    </>
  )
}
