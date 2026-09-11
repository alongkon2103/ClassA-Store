// Partner storefront sync — pulls a partner's affiliate catalog into our DB.
//
// We resell partner games as an affiliate: the buy button links OUT to the
// partner's site with our ref, so there is NO order/payment/whitelist here. This
// module fetches the partner's public affiliate dashboard and mirrors its
// products into partner_products. The admin's per-product show/hide flag
// (is_visible) and sort_order are PRESERVED across syncs — only catalog content
// (name, price, images, videos, …) is overwritten.

import { prisma } from "@/lib/prisma"
import { youtubeId, youtubeThumb } from "@/lib/video"
import { getMakiCatalog, groupCatalog, planLabel, priceFrom, toPlanRows, asJson, type MakiPlanRow } from "@/lib/maki"

// Per-partner static config. `envKey` names the env var holding that partner's
// affiliate API key (kept out of the DB — it's a secret). Add a row here to
// onboard another partner.
type PartnerConfig = {
  key: string
  display_name: string // brand shown on the "Partner" label (NOT our affiliate name)
  api_base: string
  envKey: string
  // affiliate_link = ลิงก์ออกไปซื้อที่พาร์ทเนอร์ (ค่าเริ่มต้น) · maki_api = ขายในเว็บเราผ่าน Partner API
  integration?: "affiliate_link" | "maki_api"
}

export const PARTNERS: PartnerConfig[] = [
  {
    key: "judygamestudio",
    display_name: "JudyGameStudio",
    api_base: "https://judygamestudio.com",
    envKey: "JUDY_AFFILIATE_KEY",
  },
  {
    key: "maki",
    display_name: "Maki",
    api_base: "https://maki-website.onrender.com/api/partner/v1",
    envKey: "MAKI_PARTNER_KEY",
    integration: "maki_api",
  },
]

const DASHBOARD_PATH = "/api/affiliate/public/v1/dashboard"

// Shapes we read from the partner API (defensive — extra fields ignored).
type ApiPlan = {
  label_en?: string; label_th?: string; duration_days?: number | null; is_lifetime?: boolean
  list_price_thb?: number; list_price_usd?: number; discount_thb?: number
  price_thb?: number; price_usd?: number; commission_pct?: number
  commission_thb?: number; commission_usd?: number
}
type ApiImage = { url?: string; is_thumbnail?: boolean }
type ApiVideo = {
  video_id?: string; youtube_url?: string; embed_url?: string
  thumbnail_url?: string; thumbnail_maxres_url?: string; kind?: string | null
}
type ApiProduct = {
  slug?: string; name_en?: string; name_th?: string
  short_description_en?: string; short_description_th?: string
  description_html_en?: string; description_html_th?: string
  badge?: string | null; coming_soon?: boolean
  ref_url?: string; game_link_url?: string | null
  price_from_thb?: number; price_from_usd?: number
  commission_pct?: number; thumbnail_url?: string
  images?: ApiImage[]; videos?: ApiVideo[]; plans?: ApiPlan[]
}
// Earnings side of the dashboard. Shapes are defensive: the live sales/per_game
// arrays are empty until the partner has sales, so exact keys are read with
// fallbacks and the raw payload is stored verbatim (dashboard_json) so the
// mapping can be corrected later without re-syncing.
type ApiPerGame = {
  slug?: string; product_slug?: string; game?: string; game_slug?: string; name?: string
  sales_count?: number; count?: number
  commission?: number; commission_thb?: number
  pending?: number; pending_thb?: number; commission_pending_thb?: number
  paid?: number; paid_thb?: number; commission_paid_thb?: number
}
type ApiResponse = {
  profile?: { display_name?: string; commission_pct?: number; ref_slug?: string; site_url?: string }
  products?: ApiProduct[]
  totals?: unknown
  per_game?: ApiPerGame[]
  sales?: unknown[]
  payouts?: unknown[]
  fx?: unknown
}

const num = (...vals: Array<number | undefined | null>): number | null => {
  for (const v of vals) if (typeof v === "number" && !Number.isNaN(v)) return v
  return null
}

// Pull the commission this game earned us out of one per_game entry. Kept in one
// place, tolerant of key naming, so it's trivial to fix once real data lands.
function readPerGame(g: ApiPerGame) {
  const slug = g.slug || g.product_slug || g.game_slug || g.game || null
  const pending = num(g.pending_thb, g.commission_pending_thb, g.pending)
  const paid = num(g.paid_thb, g.commission_paid_thb, g.paid)
  // Some APIs report a single lump "commission" instead of pending/paid split.
  const lump = num(g.commission_thb, g.commission)
  return {
    slug,
    pending: pending ?? (paid == null ? lump : null),
    paid,
    count: num(g.sales_count, g.count),
  }
}

export type SyncResult = { ok: true; synced: number; removed: number } | { ok: false; error: string }

/** Fetch + mirror one partner's catalog. Never throws — returns a result. */
export async function syncPartner(key: string): Promise<SyncResult> {
  const makiCfg = PARTNERS.find((p) => p.key === key && p.integration === "maki_api")
  if (makiCfg) return syncMaki(makiCfg)

  const cfg = PARTNERS.find((p) => p.key === key)
  if (!cfg) return { ok: false, error: `unknown partner "${key}"` }

  const apiKey = process.env[cfg.envKey]
  if (!apiKey) return { ok: false, error: `missing env ${cfg.envKey}` }

  // Ensure the store row exists (upsert by key). display_name comes from OUR
  // config (the partner brand), not the API profile (which is our own name).
  const store = await prisma.partner_stores.upsert({
    where: { key: cfg.key },
    create: { key: cfg.key, display_name: cfg.display_name, api_base: cfg.api_base },
    update: { display_name: cfg.display_name, api_base: cfg.api_base },
  })

  let data: ApiResponse
  try {
    const res = await fetch(`${cfg.api_base}${DASHBOARD_PATH}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: "no-store",
    })
    if (!res.ok) {
      const msg = `partner API ${res.status}`
      await prisma.partner_stores.update({ where: { id: store.id }, data: { last_sync_error: msg, updated_at: new Date() } })
      return { ok: false, error: msg }
    }
    data = (await res.json()) as ApiResponse
  } catch (e) {
    const msg = e instanceof Error ? e.message : "fetch failed"
    await prisma.partner_stores.update({ where: { id: store.id }, data: { last_sync_error: msg, updated_at: new Date() } })
    return { ok: false, error: msg }
  }

  // Keep store metadata (ref/commission/site) fresh from the profile, and store
  // the raw earnings payload verbatim for auditing / mapping fixes.
  const profile = data.profile ?? {}
  await prisma.partner_stores.update({
    where: { id: store.id },
    data: {
      site_url: profile.site_url ?? null,
      ref_slug: profile.ref_slug ?? null,
      commission_pct: profile.commission_pct ?? null,
      dashboard_json: {
        totals: data.totals ?? null,
        per_game: data.per_game ?? [],
        sales: data.sales ?? [],
        payouts: data.payouts ?? [],
      } as object,
    },
  })

  // Per-game commission, keyed by slug, from the dashboard's per_game breakdown.
  const perGame = new Map<string, { pending: number | null; paid: number | null; count: number | null }>()
  for (const g of Array.isArray(data.per_game) ? data.per_game : []) {
    const r = readPerGame(g)
    if (r.slug) perGame.set(r.slug, { pending: r.pending, paid: r.paid, count: r.count })
  }

  const products = Array.isArray(data.products) ? data.products : []
  const now = new Date()
  const seenSlugs: string[] = []

  let index = 0
  for (const p of products) {
    const slug = p.slug
    if (!slug) continue
    seenSlugs.push(slug)

    const images = (p.images ?? []).map((i) => i.url).filter((u): u is string => !!u)
    const videos = (p.videos ?? []).filter((v) => v.video_id || v.embed_url)
    const plans = (p.plans ?? []).filter((pl) => pl.price_thb != null || pl.list_price_thb != null)
    const earn = perGame.get(slug)

    const content = {
      name_en: p.name_en ?? slug,
      name_th: p.name_th ?? p.name_en ?? slug,
      short_desc_en: p.short_description_en || null,
      short_desc_th: p.short_description_th || null,
      description_html_en: p.description_html_en || null,
      description_html_th: p.description_html_th || null,
      badge: p.badge || null,
      thumbnail_url: p.thumbnail_url || images[0] || null,
      ref_url: p.ref_url ?? `${cfg.api_base}/products/${slug}`,
      game_link_url: p.game_link_url || null,
      price_from_thb: p.price_from_thb ?? null,
      price_from_usd: p.price_from_usd ?? null,
      plans,
      images,
      videos,
      commission_pct: p.commission_pct ?? null,
      coming_soon: !!p.coming_soon,
      // Earnings for this game (null when the partner reports none yet).
      commission_pending_thb: earn?.pending ?? null,
      commission_paid_thb: earn?.paid ?? null,
      sales_count: earn?.count ?? null,
      synced_at: now,
      updated_at: now,
    }

    // On create, seed is_visible=true and sort_order by API order. On update,
    // DO NOT touch is_visible / sort_order — those are the admin's to control.
    await prisma.partner_products.upsert({
      where: { partner_id_external_slug: { partner_id: store.id, external_slug: slug } },
      create: { partner_id: store.id, external_slug: slug, sort_order: index, ...content },
      update: content,
    })
    index++
  }

  // Drop products the partner no longer lists (they're gone from their store).
  const removed = await prisma.partner_products.deleteMany({
    where: { partner_id: store.id, external_slug: { notIn: seenSlugs.length ? seenSlugs : ["__none__"] } },
  })

  await prisma.partner_stores.update({
    where: { id: store.id },
    data: { last_synced_at: now, last_sync_error: null, updated_at: now },
  })

  return { ok: true, synced: seenSlugs.length, removed: removed.count }
}

/** Sync every configured partner. Used by the daily cron. */
export async function syncAllPartners(): Promise<Record<string, SyncResult>> {
  const out: Record<string, SyncResult> = {}
  for (const p of PARTNERS) out[p.key] = await syncPartner(p.key)
  return out
}

/**
 * Maki: แคตตาล็อกจาก Partner API มีแค่ ชื่อ/แพลน/ขั้นต่ำ/ลิงก์พรีเซ็ต (ไม่มีรูป/คำอธิบาย)
 * รูป คำอธิบาย ชื่อไทย ราคาขาย การแสดง ลำดับ → เป็นของแอดมิน ไม่ถูกทับตอน sync
 * เกมที่หายจากแคตตาล็อกจะถูกซ่อน (ไม่ลบ เพราะรูป/คำอธิบายเป็นของแอดมิน)
 * เกมใหม่เริ่มแบบซ่อนไว้ก่อน ให้แอดมินใส่รูปและตั้งราคาแล้วค่อยเปิด
 */
async function syncMaki(cfg: PartnerConfig): Promise<SyncResult> {
  const now = new Date()
  const store = await prisma.partner_stores.upsert({
    where: { key: cfg.key },
    create: { key: cfg.key, display_name: cfg.display_name, api_base: cfg.api_base, integration: "maki_api" },
    update: { integration: "maki_api", api_base: cfg.api_base },
  })

  let catalog: Awaited<ReturnType<typeof getMakiCatalog>>
  try {
    catalog = await getMakiCatalog({ fresh: true })
  } catch (e) {
    const error = e instanceof Error ? e.message : "maki catalog failed"
    await prisma.partner_stores.update({ where: { id: store.id }, data: { last_sync_error: error, updated_at: now } })
    return { ok: false, error }
  }

  const games = groupCatalog(catalog.products)
  const existing = await prisma.partner_products.findMany({ where: { partner_id: store.id }, select: { id: true, external_slug: true, plans: true } })
  const seen: string[] = []
  let index = 0
  for (const g of games) {
    const prev = existing.find((e) => e.external_slug === g.slug)
    const prevPlans = toPlanRows(prev?.plans)
    const plans: MakiPlanRow[] = g.plans.map((p) => ({
      key: p.key, plan: p.plan,
      label_th: planLabel(p.plan).th, label_en: planLabel(p.plan).en,
      duration_days: p.duration_days, is_lifetime: p.plan === "perma",
      min_price_thb: p.min_price_thb,
      sell_price_thb: prevPlans.find((x) => x.key === p.key)?.sell_price_thb ?? null, // ราคาแอดมิน คงไว้
      preset_link: p.preset_link,
    }))
    const price_from_thb = priceFrom(plans)
    // สื่อจาก Maki (v1.1): แบนเนอร์เป็นปก ไอคอนเป็นรูปที่สอง วิดีโอ YouTube — ทับทุกครั้งที่ sync (Maki เป็นแหล่งจริง ไม่ต้องอัปโหลดเอง)
    const src = g.plans.find((p) => p.banner_url || p.icon_url || p.preview_url)
    const images = [...new Set([src?.banner_url, src?.icon_url].filter((u): u is string => !!u))]
    const ytId = src?.preview_url ? youtubeId(src.preview_url) : null
    const videos = ytId ? [{ video_id: ytId, embed_url: `https://www.youtube.com/embed/${ytId}`, thumbnail_url: youtubeThumb(ytId), youtube_url: src!.preview_url }] : []
    const media = { thumbnail_url: images[0] ?? null, images: asJson(images), videos: asJson(videos) }
    if (prev) {
      await prisma.partner_products.update({
        where: { id: prev.id },
        data: { plans: asJson(plans), price_from_thb, coming_soon: false, synced_at: now, updated_at: now, ...media },
      })
    } else {
      await prisma.partner_products.create({
        data: {
          partner_id: store.id, external_slug: g.slug, name_en: g.name, name_th: g.name,
          ref_url: "", plans: asJson(plans), price_from_thb, ...media,
          is_visible: false, sort_order: index, synced_at: now,
        },
      })
    }
    seen.push(g.slug)
    index++
  }

  const hidden = await prisma.partner_products.updateMany({
    where: { partner_id: store.id, external_slug: { notIn: seen.length ? seen : ["__none__"] }, coming_soon: false },
    data: { is_visible: false, coming_soon: true, updated_at: now },
  })

  await prisma.partner_stores.update({
    where: { id: store.id },
    data: {
      last_synced_at: now, updated_at: now,
      last_sync_error: catalog.source === "mock" ? "ใช้แคตตาล็อกจำลอง — ยังไม่ได้ตั้ง MAKI_PARTNER_KEY" : catalog.source === "test" ? "โหมด sandbox (MAKI_API_MODE=test)" : null,
    },
  })
  return { ok: true, synced: games.length, removed: hidden.count }
}
