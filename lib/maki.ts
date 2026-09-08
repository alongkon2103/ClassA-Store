// Maki Partner API (ขายเกมของ Maki ในเว็บเรา) — ใช้ฝั่ง server เท่านั้น key อยู่ใน env
//   MAKI_PARTNER_KEY  = key ที่ Maki ออกให้ (ห้ามหลุดไป client/log)
//   MAKI_API_MODE     = "test" → ใช้ sandbox /test ของเขา (ไม่มีเงินจริง) · ไม่ตั้ง = ของจริง
// dev ที่ยังไม่มี key จะได้แคตตาล็อกจำลอง (ตัวอย่างจากเอกสาร) เพื่อทำ UI ได้ก่อน — production ไม่มี key = error
import type { Prisma } from "@prisma/client"

export const MAKI_BASE = process.env.MAKI_API_BASE || "https://maki-website.onrender.com/api/partner/v1"
export type MakiPlan = "1m" | "perma"
export type MakiProduct = { key: string; name: string; plan: MakiPlan; duration_days: number; min_price_thb: number; preset_link: string | null }
export type MakiSource = "live" | "test" | "mock"

export class MakiError extends Error {
  constructor(public status: number, message: string) { super(message); this.name = "MakiError" }
}

export function makiConfigured() {
  return !!process.env.MAKI_PARTNER_KEY
}
const modePrefix = () => (process.env.MAKI_API_MODE === "test" ? "/test" : "")

export async function makiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const key = process.env.MAKI_PARTNER_KEY
  if (!key) throw new MakiError(0, "MAKI_PARTNER_KEY missing")
  const r = await fetch(`${MAKI_BASE}${modePrefix()}${path}`, {
    ...init,
    headers: { "X-Partner-Key": key, "Content-Type": "application/json", ...(init?.headers ?? {}) },
    cache: "no-store",
  })
  const data = await r.json().catch(() => null)
  if (!r.ok || data?.success === false) throw new MakiError(r.status, data?.message || `HTTP ${r.status}`)
  return data.data as T
}

// แคตตาล็อกจำลองสำหรับ dev (ค่าจากตัวอย่างในเอกสาร)
const MOCK_CATALOG: MakiProduct[] = [
  { key: "maki_boxing_1m", name: "Maki Boxing", plan: "1m", duration_days: 30, min_price_thb: 550, preset_link: "https://drive.google.com/drive/folders/17vFNNUPQr1OGbQZt_IPtEseYJfxb5kzb" },
  { key: "maki_boxing_perma", name: "Maki Boxing", plan: "perma", duration_days: 36500, min_price_thb: 1250, preset_link: "https://drive.google.com/drive/folders/17vFNNUPQr1OGbQZt_IPtEseYJfxb5kzb" },
  { key: "maki_block_1m", name: "Maki Block", plan: "1m", duration_days: 30, min_price_thb: 500, preset_link: null },
]

function normalizeProduct(p: Partial<MakiProduct> & { key?: string }): MakiProduct | null {
  if (!p.key || !p.name) return null
  const plan: MakiPlan = p.plan === "perma" || /_perma$/.test(p.key) ? "perma" : "1m"
  return {
    key: p.key, name: String(p.name).trim(), plan,
    duration_days: Number(p.duration_days ?? (plan === "perma" ? 36500 : 30)),
    min_price_thb: Number(p.min_price_thb ?? 0),
    preset_link: p.preset_link ? String(p.preset_link) : null,
  }
}

// cache 60 วิ ในโปรเซส — หน้าร้าน/หน้าสินค้าเรียกได้ทุกครั้งโดยไม่ยิง API ถี่เกิน
let cache: { at: number; products: MakiProduct[]; source: MakiSource } | null = null
const CACHE_MS = 60_000

export async function getMakiCatalog(opts?: { fresh?: boolean }): Promise<{ products: MakiProduct[]; source: MakiSource }> {
  if (!makiConfigured()) {
    if (process.env.NODE_ENV === "production") throw new MakiError(0, "MAKI_PARTNER_KEY missing")
    return { products: MOCK_CATALOG, source: "mock" }
  }
  if (!opts?.fresh && cache && Date.now() - cache.at < CACHE_MS) return { products: cache.products, source: cache.source }
  const d = await makiFetch<{ products?: Partial<MakiProduct>[] }>("/products")
  const products = (d.products ?? []).map(normalizeProduct).filter((x): x is MakiProduct => !!x)
  const source: MakiSource = process.env.MAKI_API_MODE === "test" ? "test" : "live"
  cache = { at: Date.now(), products, source }
  return { products, source }
}

export function slugifyName(name: string) {
  return name.toLowerCase().normalize("NFKD").replace(/[^a-z0-9ก-๙]+/g, "-").replace(/^-+|-+$/g, "") || "game"
}

export type MakiGame = { slug: string; name: string; plans: MakiProduct[] }
/** รวม key `<game>_1m` / `<game>_perma` ของเกมเดียวกันเป็น 1 เกม (เรียง 1m ก่อน perma) */
export function groupCatalog(products: MakiProduct[]): MakiGame[] {
  const map = new Map<string, MakiGame>()
  for (const p of products) {
    const slug = slugifyName(p.name)
    const g = map.get(slug) ?? { slug, name: p.name, plans: [] }
    g.plans.push(p)
    map.set(slug, g)
  }
  for (const g of map.values()) g.plans.sort((a, b) => (a.plan === b.plan ? 0 : a.plan === "1m" ? -1 : 1))
  return [...map.values()]
}

// รูปแบบ plans JSON ที่เก็บใน partner_products ของร้าน Maki
export type MakiPlanRow = {
  key: string
  plan: MakiPlan
  label_th: string
  label_en: string
  duration_days: number
  is_lifetime: boolean
  min_price_thb: number      // ขั้นต่ำจาก Maki (sync/สดทับ)
  sell_price_thb: number | null // ราคาที่แอดมินตั้ง — ต้อง ≥ ขั้นต่ำถึงจะขายได้
  preset_link: string | null
}
export const planLabel = (plan: MakiPlan) => (plan === "perma" ? { th: "ถาวร", en: "Lifetime" } : { th: "เช่า 30 วัน", en: "30 days" })
export function planAvailable(p: MakiPlanRow) {
  return p.sell_price_thb != null && p.sell_price_thb >= p.min_price_thb
}
export function toPlanRows(plans: unknown): MakiPlanRow[] {
  return Array.isArray(plans) ? (plans as MakiPlanRow[]) : []
}
export function priceFrom(plans: MakiPlanRow[]): number | null {
  const ok = plans.filter(planAvailable).map((p) => p.sell_price_thb as number)
  return ok.length ? Math.min(...ok) : null
}
export function asJson(v: unknown) {
  return v as Prisma.InputJsonValue
}

/**
 * ทับขั้นต่ำด้วยค่าสดจาก API (cache 60 วิ) ให้ "realtime" — ถ้าเรียกไม่ได้ก็ใช้ค่าที่ sync ไว้ใน DB
 * คืน plans ใหม่ + available ต่อแพลน
 */
export async function withLiveMinimums<T extends { plans: unknown }>(rows: T[]): Promise<(T & { plans: MakiPlanRow[] })[]> {
  let live = new Map<string, MakiProduct>()
  try {
    const { products } = await getMakiCatalog()
    live = new Map(products.map((p) => [p.key, p]))
  } catch { /* ใช้ค่าจาก DB */ }
  return rows.map((r) => ({
    ...r,
    plans: toPlanRows(r.plans).map((pl) => {
      const l = live.get(pl.key)
      return l ? { ...pl, min_price_thb: l.min_price_thb, duration_days: l.duration_days, preset_link: l.preset_link ?? pl.preset_link } : pl
    }),
  }))
}
