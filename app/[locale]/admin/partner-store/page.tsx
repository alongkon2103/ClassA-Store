import { prisma } from "@/lib/prisma"
import PartnerStoreClient from "./PartnerStoreClient"
import { setRequestLocale } from "next-intl/server"
import { PARTNERS } from "@/lib/partnerSync"
import { withLiveMinimums, toPlanRows } from "@/lib/maki"

// Admin management for the PARTNER STORE (external reseller games). Separate from
// /admin/partners (internal revenue-share partners). Lets admin sync the catalog
// and show/hide individual games.
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)

  const [stores, partners] = await Promise.all([
    prisma.partner_stores.findMany({
      orderBy: { created_at: "asc" },
      include: {
        products: {
          orderBy: { sort_order: "asc" },
          include: { splits: { select: { partner_id: true, pct: true } } },
        },
      },
    }),
    prisma.partners.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ])

  // ร้าน Maki: ทับขั้นต่ำด้วยค่าสดจาก API (cache 60 วิ) ให้แอดมินเห็นราคาล่าสุด
  const storesLive = await Promise.all(stores.map(async (s) =>
    s.integration === "maki_api" ? { ...s, products: await withLiveMinimums(s.products) } : s,
  ))

  const safe = storesLive.map((s) => ({
    id: s.id,
    key: s.key,
    integration: s.integration,
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
      show_partner_badge: p.show_partner_badge,
      sort_order: p.sort_order,
      preview_video_url: p.preview_video_url ?? null,
      description_html_th: p.description_html_th ?? null,
      description_html_en: p.description_html_en ?? null,
      images: Array.isArray(p.images) ? (p.images as string[]) : [],
      coming_soon: p.coming_soon,
      plans: s.integration === "maki_api"
        ? toPlanRows(p.plans).map((pl) => ({ key: pl.key, plan: pl.plan, label_th: pl.label_th, label_en: pl.label_en, min_price_thb: pl.min_price_thb, sell_price_thb: pl.sell_price_thb, preset_link: pl.preset_link }))
        : [],
      commission_pending_thb: p.commission_pending_thb == null ? 0 : Number(p.commission_pending_thb),
      commission_paid_thb: p.commission_paid_thb == null ? 0 : Number(p.commission_paid_thb),
      sales_count: p.sales_count ?? 0,
      splits: p.splits.map((s) => ({ partner_id: s.partner_id, pct: Number(s.pct) })),
    })),
  }))

  // Partners that are configured in code but not yet synced (no store row / key
  // present) — so the admin knows what env key to set.
  const configuredKeys = PARTNERS.map((p) => ({ key: p.key, display_name: p.display_name, envKey: p.envKey }))

  return <PartnerStoreClient stores={safe} configured={configuredKeys} partners={partners} />
}
