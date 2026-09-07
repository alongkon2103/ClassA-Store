"use client"

// หน้า "สินค้าทั้งหมด" ตามดีไซน์ใหม่: หัวเรื่อง + แบนเนอร์เกมเด่น + ตัวกรองข้าง + แถบค้นหา/เรียง + กริด
// ตัวกรอง "หมวดหมู่" อิงจาก products.type จริง (Roblox / โปรแกรม PC / Partner)
// ดีไซน์ต้นแบบมีตัวกรอง "ประเภทเกม" (Adventure/RPG/…) ด้วย แต่ฐานข้อมูลยังไม่มีฟิลด์นั้น
// เลยยังไม่ใส่ — ถ้าอยากได้ต้องเพิ่มฟิลด์หมวดในสินค้าก่อน

import { useEffect, useMemo, useState } from "react"
import ProductModal from "@/components/products/ProductModal"
import PartnerModal from "@/components/products/PartnerModal"
import GameCard from "@/components/GameCard"
import Navbar from "@/components/Navbar"
import Footer from "@/components/home/Footer"
import { Link } from "@/i18n/routing"
import { AnimatePresence, motion } from "framer-motion"
import { useLocale, useTranslations } from "next-intl"
import { useSearchParams } from "next/navigation"
import { useAutoDiscounts } from "@/lib/useAutoDiscounts"
import { getImageUrl } from "@/lib/getImageUrl"

/* eslint-disable @typescript-eslint/no-explicit-any */

const TIKKIES_URL = "https://tikkies.aclassstore.com/en"
type Item = any

const RANGES = [
  { key: "all", min: 0, max: Infinity },
  { key: "lt500", min: 0, max: 500 },
  { key: "500_1000", min: 500, max: 1000 },
  { key: "1000_2000", min: 1000, max: 2000 },
  { key: "gt2000", min: 2000, max: Infinity },
] as const

function plain(html: string | null | undefined, max = 90) {
  if (!html) return ""
  const t = html.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim()
  return t.length > max ? `${t.slice(0, max).trimEnd()}…` : t
}

/** ราคาที่ใช้แสดง/กรอง = variant ที่ถูกที่สุด (ราคาหลังลดถ้ามี) */
function itemPrice(it: Item): number {
  const vs: any[] = it.product_variants ?? []
  if (!vs.length) return Number(it.price ?? 0)
  return vs.reduce((min, v) => {
    const p = Number(v.discounted_price ?? v.price ?? 0)
    return p > 0 && p < min ? p : min
  }, Infinity as number) || Number(it.price ?? 0)
}

export default function ProductsClient({ initialProducts }: { initialProducts: Item[] }) {
  const t = useTranslations("Shop")
  const tc = useTranslations("Home")
  const locale = useLocale()
  const isTH = locale === "th"
  const searchParams = useSearchParams()
  const { bestDiscountedPrice } = useAutoDiscounts()

  const [selected, setSelected] = useState<Item | null>(null)
  const [search, setSearch] = useState("")
  const [cat, setCat] = useState<"all" | "roblox" | "pc" | "partner">("all")
  const [range, setRange] = useState<(typeof RANGES)[number]["key"]>("all")
  const [sort, setSort] = useState<"latest" | "price_asc" | "price_desc" | "name">("latest")
  const [view, setView] = useState<"grid" | "list">("grid")

  // เปิด modal อัตโนมัติเมื่อเข้ามาด้วยลิงก์ ?slug=
  useEffect(() => {
    const slug = searchParams?.get("slug")
    if (slug) {
      const found = initialProducts.find((p) => p.slug === slug)
      if (found) setSelected(found)
    }
  }, [searchParams, initialProducts])

  const catOf = (p: Item) => (p.is_partner ? "partner" : p.type === "desktop_program" ? "pc" : "roblox")

  const counts = useMemo(() => {
    const c = { all: initialProducts.length, roblox: 0, pc: 0, partner: 0 }
    for (const p of initialProducts) c[catOf(p) as "roblox" | "pc" | "partner"]++
    return c
  }, [initialProducts])

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase()
    const r = RANGES.find((x) => x.key === range)!
    const list = initialProducts.filter((p) => {
      if (cat !== "all" && catOf(p) !== cat) return false
      const price = itemPrice(p)
      if (price < r.min || price >= r.max) return false
      if (!q) return true
      const name = (isTH ? p.name_th : p.name_en) ?? ""
      return name.toLowerCase().includes(q)
    })

    if (sort === "price_asc") list.sort((a, b) => itemPrice(a) - itemPrice(b))
    else if (sort === "price_desc") list.sort((a, b) => itemPrice(b) - itemPrice(a))
    else if (sort === "name") list.sort((a, b) => ((isTH ? a.name_th : a.name_en) ?? "").localeCompare((isTH ? b.name_th : b.name_en) ?? ""))
    return list
  }, [initialProducts, cat, range, search, sort, isTH])

  const reset = () => { setCat("all"); setRange("all"); setSearch(""); setSort("latest") }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <main className="flex-1">
        <div className="w-full px-5 sm:px-7 lg:px-10">
          {/* หัวเรื่อง + breadcrumb */}
          <div className="pt-10 pb-7 border-b border-border-soft mb-7">
            <div className="flex items-center gap-[18px]">
              <div className="w-[52px] h-[52px] rounded-[14px] flex items-center justify-center flex-shrink-0 shadow-[0_4px_20px_rgba(37,99,235,0.3)]"
                   style={{ background: "linear-gradient(135deg,var(--color-accent),var(--color-accent-lighter))" }}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                </svg>
              </div>
              <div>
                <h1 className="text-[1.4rem] sm:text-[1.8rem] font-black tracking-[-0.02em]">{t("title")}</h1>
                <p className="text-[0.88rem] text-text-muted mt-0.5">{t("subtitle")}</p>
              </div>
            </div>
            <div className="mt-4 text-[0.75rem] text-text-dim flex items-center gap-1.5">
              <Link href="/" className="text-accent-light">{t("home")}</Link>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6" /></svg>
              {t("title")}
            </div>
          </div>

          {/* แบนเนอร์แนะนำ: Tikkies — โปรแกรมเชื่อมของขวัญ TikTok LIVE ของร้านเอง
              ขายบนเว็บแยก (tikkies.aclassstore.com) ปุ่มจึงลิงก์ออกไปที่นั่น */}
          <div className="mb-7">
            <h2 className="text-[1.2rem] font-extrabold mb-1">{t("featured_title")}</h2>
            <p className="text-[0.82rem] text-text-dim mb-[18px]">{t("featured_sub")}</p>
            <a
              href={TIKKIES_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex flex-col sm:flex-row bg-bg-card border border-border-soft rounded-[14px] overflow-hidden hover:border-accent/40 transition-colors"
            >
              <div className="w-full sm:w-[220px] min-h-[160px] flex-shrink-0 relative flex items-center justify-center overflow-hidden"
                   style={{ background: "linear-gradient(135deg,#0c1a3a,#0f1e45)" }}>
                {/* โลโก้จริงของ Tikkies (ไฟล์เดียวกับ favicon บน tikkies.aclassstore.com) */}
                <img
                  src="/tikkies-logo.svg"
                  alt="Tikkies"
                  width={80} height={80}
                  className="w-20 h-20 rounded-2xl shadow-[0_4px_24px_rgba(37,99,235,0.35)] transition-transform group-hover:scale-105"
                />
              </div>

              <div className="flex-1 px-7 py-6 flex flex-col justify-center">
                <div className="flex items-center gap-2.5 mb-2 flex-wrap">
                  <h3 className="text-[1.1rem] font-extrabold">{t("tikkies_name")}</h3>
                  <span className="px-2.5 py-[3px] rounded-md text-[0.6rem] font-bold bg-accent text-white">{t("tikkies_tag")}</span>
                </div>
                <p className="text-[0.82rem] text-text-muted leading-[1.7]">{t("tikkies_desc")}</p>
              </div>

              <div className="px-7 py-6 flex sm:flex-col items-center sm:items-end justify-between gap-3 sm:border-l border-border-soft">
                <div className="sm:text-right">
                  <div className="text-[1.4rem] font-extrabold text-text-base whitespace-nowrap">
                    <span className="text-[0.85rem] font-semibold">฿</span>249
                    <span className="text-[0.75rem] font-medium text-text-dim"> / {t("tikkies_unit")}</span>
                  </div>
                  <div className="text-[0.7rem] text-text-dim">{t("tikkies_price_sub")}</div>
                </div>
                <span className="px-6 py-2.5 rounded-[10px] bg-accent group-hover:bg-accent-light text-white text-[0.85rem] font-bold whitespace-nowrap transition-colors">
                  {t("tikkies_cta")}
                </span>
              </div>
            </a>
          </div>

          {/* เนื้อหา: ตัวกรอง + กริด */}
          <div className="grid gap-6 grid-cols-1 lg:grid-cols-[240px_1fr] mb-12">
            {/* SIDEBAR */}
            <aside className="flex flex-col gap-5">
              <div className="bg-bg-card border border-border-soft rounded-xl p-[18px]">
                <h3 className="text-[0.82rem] font-bold mb-3.5">{t("category")}</h3>
                <ul>
                  {([
                    { k: "all", label: t("cat_all"), n: counts.all },
                    { k: "roblox", label: "Roblox", n: counts.roblox },
                    { k: "pc", label: t("cat_pc"), n: counts.pc },
                    { k: "partner", label: "Partner", n: counts.partner },
                  ] as const).filter((c) => c.k === "all" || c.n > 0).map((c) => {
                    const active = cat === c.k
                    return (
                      <li key={c.k}>
                        <button onClick={() => setCat(c.k)}
                          className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-[0.8rem] transition-colors ${
                            active ? "bg-accent/10 text-accent-light font-semibold" : "text-text-muted hover:bg-white/[0.03] hover:text-text-base"}`}>
                          <span>{c.label}</span>
                          <span className={`text-[0.7rem] px-2 py-0.5 rounded-[10px] font-semibold ${active ? "bg-accent/15 text-accent-light" : "bg-white/[0.06] text-text-dim"}`}>{c.n}</span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </div>

              <div className="bg-bg-card border border-border-soft rounded-xl p-[18px]">
                <h3 className="text-[0.82rem] font-bold mb-3.5">{t("price_range")}</h3>
                <ul className="flex flex-col gap-1">
                  {RANGES.map((r) => {
                    const active = range === r.key
                    return (
                      <li key={r.key}>
                        <button onClick={() => setRange(r.key)}
                          className="w-full flex items-center gap-2.5 px-2.5 py-[7px] rounded-lg text-[0.8rem] text-text-muted hover:bg-white/[0.03] transition-colors">
                          <span className={`w-[18px] h-[18px] rounded-full border-[1.5px] flex items-center justify-center flex-shrink-0 ${active ? "border-accent" : "border-border-light"}`}>
                            {active && <span className="w-2 h-2 rounded-full bg-accent" />}
                          </span>
                          <span className={active ? "text-accent-light" : ""}>{t(`range_${r.key}`)}</span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </div>

              <button onClick={reset}
                className="w-full py-2.5 rounded-lg border border-border-soft text-text-muted text-[0.8rem] font-semibold flex items-center justify-center gap-1.5 hover:border-border-light hover:text-text-base transition-colors">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                </svg>
                {t("reset")}
              </button>
            </aside>

            {/* MAIN */}
            <main>
              <div className="flex gap-2.5 mb-5 h-10">
                <div className="flex-1 flex items-center bg-bg-card border border-border-soft rounded-[10px] overflow-hidden focus-within:border-accent transition-colors">
                  <span className="px-3 text-text-dim flex items-center">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                  </span>
                  <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("search_placeholder")}
                         className="flex-1 h-full bg-transparent border-none outline-none text-[0.85rem] text-text-base placeholder:text-text-dim pr-3" />
                </div>
                <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}
                        className="px-3.5 rounded-[10px] border border-border-soft bg-bg-card text-text-muted text-[0.82rem] outline-none focus:border-accent transition-colors">
                  <option value="latest">{t("sort_latest")}</option>
                  <option value="price_asc">{t("sort_price_asc")}</option>
                  <option value="price_desc">{t("sort_price_desc")}</option>
                  <option value="name">{t("sort_name")}</option>
                </select>

                {/* สลับมุมมองกริด/รายการ */}
                <button
                  onClick={() => setView((v) => (v === "grid" ? "list" : "grid"))}
                  aria-label={view === "grid" ? t("view_list") : t("view_grid")}
                  title={view === "grid" ? t("view_list") : t("view_grid")}
                  className="w-10 flex-shrink-0 rounded-[10px] border border-border-soft text-text-muted hover:text-text-base hover:border-border-light hover:bg-white/[0.03] flex items-center justify-center transition-colors"
                >
                  {view === "grid" ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" />
                      <line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                      <rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" />
                      <rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" />
                    </svg>
                  )}
                </button>
              </div>

              <p className="text-[0.78rem] text-text-dim mb-4">{t("result_count", { count: shown.length })}</p>

              <motion.div initial="hidden" animate="show"
                          variants={{ hidden: {}, show: { transition: { staggerChildren: 0.04 } } }}
                          className={view === "grid" ? "grid grid-cols-1 min-[480px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4" : "flex flex-col gap-3"}>
                {shown.map((p) => {
                  const vs: any[] = p.product_variants ?? []
                  const cheapest = vs.length ? vs.reduce((a, b) => (Number(a.price) <= Number(b.price) ? a : b)) : null
                  const base = cheapest ? Number(cheapest.price) : Number(p.price ?? 0)
                  // partner มีราคาลดมากับข้อมูลอยู่แล้ว ส่วนสินค้าเราคิดจากโค้ดลดอัตโนมัติ
                  const deal = p.is_partner
                    ? (cheapest ? Number(cheapest.discounted_price) : null)
                    : (cheapest ? bestDiscountedPrice(p.id, base) : null)
                  const hasDeal = deal != null && deal < base

                  return (
                    <motion.div key={p.id} variants={{ hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0 } }}>
                      <GameCard
                        name={isTH ? p.name_th : p.name_en}
                        description={plain(isTH ? p.description_th : p.description_en)}
                        image={p.product_images?.[0]?.url}
                        previewVideo={p.preview_video_url}
                        platform={p.is_partner ? p.partner_name : p.type === "desktop_program" ? "PC" : "Roblox"}
                        badge={p.is_partner ? { text: "PARTNER", kind: "partner" } : p.is_featured ? { text: "HOT", kind: "hot" } : null}
                        price={hasDeal ? (deal as number) : base}
                        oldPrice={hasDeal ? base : null}
                        usdRate={cheapest?.usd_rate}
                        buyLabel={tc("buy_short")}
                        layout={view}
                        {...(p.is_partner
                          ? { onClick: () => setSelected(p) }
                          : { href: `/products/${p.slug}` })}
                      />
                    </motion.div>
                  )
                })}
              </motion.div>

              {shown.length === 0 && <p className="text-center text-text-muted text-sm py-16">{t("no_result")}</p>}
            </main>
          </div>
        </div>
      </main>

      <Footer />

      <AnimatePresence>
        {selected && (
          selected.is_partner
            ? <PartnerModal product={selected} onClose={() => setSelected(null)} />
            : <ProductModal product={selected} onClose={() => setSelected(null)} />
        )}
      </AnimatePresence>
    </div>
  )
}
