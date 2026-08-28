import { prisma } from "@/lib/prisma"
import StorefrontOrderClient from "./StorefrontOrderClient"
import { setRequestLocale } from "next-intl/server"

// Drag-to-reorder page for the whole storefront grid: our products + partner
// games in one list. Save writes display_order to both tables.
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)

  const [products, partners] = await Promise.all([
    prisma.products.findMany({
      where: { is_active: true },
      select: {
        id: true, name_th: true, name_en: true, is_featured: true, created_at: true, display_order: true,
        product_images: { orderBy: { sort_order: "asc" }, take: 1, select: { url: true } },
      },
    }),
    prisma.partner_products.findMany({
      where: { is_visible: true, partner: { is_active: true } },
      select: { id: true, name_th: true, name_en: true, thumbnail_url: true, display_order: true, sort_order: true },
    }),
  ])

  type Item = {
    key: string; type: "product" | "partner"; id: string
    name_th: string; name_en: string; thumb: string | null; is_partner: boolean
    display_order: number | null; is_featured: boolean; created_at: string | null; sort_order: number
  }

  const items: Item[] = [
    ...products.map((p): Item => ({
      key: `product:${p.id}`, type: "product", id: p.id,
      name_th: p.name_th, name_en: p.name_en, thumb: p.product_images[0]?.url ?? null, is_partner: false,
      display_order: p.display_order, is_featured: !!p.is_featured,
      created_at: p.created_at ? p.created_at.toISOString() : null, sort_order: 0,
    })),
    ...partners.map((p): Item => ({
      key: `partner:${p.id}`, type: "partner", id: p.id,
      name_th: p.name_th, name_en: p.name_en, thumb: p.thumbnail_url, is_partner: true,
      display_order: p.display_order, is_featured: false, created_at: null, sort_order: p.sort_order,
    })),
  ]

  // Same order the storefront renders (ordered first, then the default fallback).
  const ordered = items.filter((x) => x.display_order != null).sort((a, b) => (a.display_order as number) - (b.display_order as number))
  const unordered = items.filter((x) => x.display_order == null).sort((a, b) => {
    if (a.is_partner !== b.is_partner) return a.is_partner ? 1 : -1
    if (!a.is_partner) {
      if (a.is_featured !== b.is_featured) return a.is_featured ? -1 : 1
      return new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime()
    }
    return a.sort_order - b.sort_order
  })

  return <StorefrontOrderClient items={[...ordered, ...unordered]} />
}
