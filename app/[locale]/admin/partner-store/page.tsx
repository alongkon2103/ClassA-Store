import { prisma } from "@/lib/prisma"
import PartnerStoreClient from "./PartnerStoreClient"
import { setRequestLocale } from "next-intl/server"
import { PARTNERS } from "@/lib/partnerSync"

// Admin management for the PARTNER STORE (external reseller games). Separate from
// /admin/partners (internal revenue-share partners). Lets admin sync the catalog
// and show/hide individual games.
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)

  const stores = await prisma.partner_stores.findMany({
    orderBy: { created_at: "asc" },
    include: { products: { orderBy: { sort_order: "asc" } } },
  })

  const safe = stores.map((s) => ({
    id: s.id,
    key: s.key,
    display_name: s.display_name,
    site_url: s.site_url,
    ref_slug: s.ref_slug,
    commission_pct: s.commission_pct == null ? null : Number(s.commission_pct),
    is_active: s.is_active,
    last_synced_at: s.last_synced_at ? s.last_synced_at.toISOString() : null,
    last_sync_error: s.last_sync_error,
    products: s.products.map((p) => ({
      id: p.id,
      external_slug: p.external_slug,
      name_th: p.name_th,
      name_en: p.name_en,
      badge: p.badge,
      thumbnail_url: p.thumbnail_url,
      ref_url: p.ref_url,
      price_from_thb: p.price_from_thb == null ? null : Number(p.price_from_thb),
      plans_count: Array.isArray(p.plans) ? p.plans.length : 0,
      is_visible: p.is_visible,
      sort_order: p.sort_order,
    })),
  }))

  // Partners that are configured in code but not yet synced (no store row / key
  // present) — so the admin knows what env key to set.
  const configuredKeys = PARTNERS.map((p) => ({ key: p.key, display_name: p.display_name, envKey: p.envKey }))

  return <PartnerStoreClient stores={safe} configured={configuredKeys} />
}
