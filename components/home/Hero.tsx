"use client"

// Hero ตามดีไซน์ใหม่: การ์ดโชว์ "เกมเด่น" ทีละเกม พร้อมราคาเช่า/ซื้อขาด
// และจุด carousel ด้านล่าง — ข้อมูลมาจาก products ที่ is_featured จริง
// ไม่ได้ hardcode เหมือนไฟล์ต้นแบบ

import { useCallback, useEffect, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { useLocale, useTranslations } from "next-intl"
import { getImageUrl } from "@/lib/getImageUrl"
import type { Product } from "./BestSeller"

const ROTATE_MS = 7000

/** ตัดแท็ก HTML ออกจาก description (Tiptap เก็บเป็น HTML) แล้วย่อให้พอดีบรรทัด */
function plainText(html: string | null | undefined, max = 130): string {
  if (!html) return ""
  const text = html.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim()
  return text.length > max ? `${text.slice(0, max).trimEnd()}…` : text
}

/** แยกคำสุดท้ายของชื่อเกมออกมาไล่สีตามดีไซน์ (เช่น AC JUMP [EVO]) */
function splitName(name: string): [string, string] {
  const parts = name.trim().split(/\s+/)
  if (parts.length < 2) return [name, ""]
  return [parts.slice(0, -1).join(" "), parts[parts.length - 1]]
}

export default function Hero({
  products,
  onSelect,
}: {
  products: Product[]
  onSelect?: (p: Product) => void
}) {
  const t = useTranslations("Home")
  const locale = useLocale()
  const isTH = locale === "th"
  const slides = products.slice(0, 5)
  const [index, setIndex] = useState(0)

  const go = useCallback((i: number) => setIndex(((i % slides.length) + slides.length) % slides.length), [slides.length])

  // หมุนอัตโนมัติ — หยุดเมื่อมีสไลด์เดียว
  useEffect(() => {
    if (slides.length < 2) return
    const id = setInterval(() => setIndex((i) => (i + 1) % slides.length), ROTATE_MS)
    return () => clearInterval(id)
  }, [slides.length])

  if (slides.length === 0) return null

  const p = slides[index]
  const name = isTH ? p.name_th : p.name_en
  const [head, tail] = splitName(name)
  const desc = plainText(isTH ? p.description_th : p.description_en) || t("hero_subtitle")

  // ราคาเช่า = variant ที่ถูกที่สุดแบบมีวันหมดอายุ, ซื้อขาด = variant ถาวร
  const variants = p.product_variants ?? []
  const timed = variants.filter((v) => v.duration_type !== "permanent")
  const permanent = variants.find((v) => v.duration_type === "permanent")
  const cheapest = timed.length ? timed.reduce((a, b) => (a.price <= b.price ? a : b)) : null
  const baht = (n: number) => `฿${Number(n).toLocaleString()}`

  return (
    <div className="page-container pt-6">
      <section
        className="relative overflow-hidden rounded-2xl min-h-[420px] flex items-center"
        style={{ background: "linear-gradient(135deg,#0c1225 0%,#111d3a 40%,#162550 80%,#1a2d5c 100%)" }}
      >
        {/* แสงเรืองด้านหลัง */}
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse 60% 80% at 75% 40%, rgba(37,99,235,0.12) 0%, transparent 70%)," +
              "radial-gradient(circle at 90% 90%, rgba(96,165,250,0.06) 0%, transparent 40%)",
          }}
        />

        <AnimatePresence mode="wait">
          <motion.div
            key={p.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-[2] w-full px-7 py-9 sm:px-14 sm:py-13 max-w-[560px]"
          >
            <span className="inline-flex items-center gap-1.5 px-4 py-[5px] mb-[22px] rounded-full text-[0.7rem] font-bold uppercase tracking-[0.06em] text-accent-lighter bg-accent/15 border border-accent/30">
              <span className="w-1.5 h-1.5 rounded-full bg-accent-light animate-pulse-dot" />
              {t("hero_badge")}
            </span>

            <h1 className="text-[2rem] sm:text-[2.4rem] lg:text-[3.4rem] font-black leading-[1.05] tracking-[-0.03em] mb-4">
              {head}{" "}
              {tail && (
                <span
                  className="bg-clip-text text-transparent"
                  style={{ backgroundImage: "linear-gradient(135deg,var(--color-accent-light),var(--color-accent-lighter))" }}
                >
                  {tail}
                </span>
              )}
            </h1>

            <p className="text-text-muted text-[0.95rem] leading-[1.8] mb-[30px]">{desc}</p>

            <div className="flex gap-3.5 flex-wrap max-[480px]:flex-col">
              {cheapest && (
                <button
                  onClick={() => onSelect?.(p)}
                  className="px-[34px] py-3.5 rounded-[10px] text-[0.9rem] font-bold text-white transition-all hover:-translate-y-0.5 active:scale-95"
                  style={{
                    background: "linear-gradient(135deg,var(--color-accent),var(--color-accent-light))",
                    boxShadow: "0 4px 24px var(--color-accent-glow)",
                  }}
                >
                  {t("hero_rent")}
                  <span className="block text-[0.7rem] font-normal opacity-60 mt-1">
                    {t("hero_from")} {baht(cheapest.price)} / {isTH ? cheapest.label_th : cheapest.label_en}
                  </span>
                </button>
              )}

              {permanent && (
                <button
                  onClick={() => onSelect?.(p)}
                  className="px-[34px] py-3.5 rounded-[10px] text-[0.9rem] font-bold text-text-base bg-white/[0.06] hover:bg-white/10 border border-border-light transition-all hover:-translate-y-0.5 active:scale-95"
                >
                  {t("hero_buy")}
                  <span className="block text-[0.7rem] font-normal opacity-60 mt-1">{baht(permanent.price)} ∞</span>
                </button>
              )}
            </div>
          </motion.div>
        </AnimatePresence>

        {/* ภาพเกม — ซ่อนบนจอเล็กตามดีไซน์ */}
        <div className="absolute right-12 top-1/2 -translate-y-1/2 w-[360px] h-[300px] rounded-[14px] overflow-hidden hidden lg:block border border-accent-lighter/15">
          <AnimatePresence mode="wait">
            <motion.img
              key={p.id}
              src={getImageUrl(p.product_images?.[0]?.url || "/placeholder.png")}
              alt={name}
              initial={{ opacity: 0, scale: 1.04 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.45 }}
              className="w-full h-full object-cover"
            />
          </AnimatePresence>
        </div>

        {slides.length > 1 && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2 z-[3]">
            {slides.map((s, i) => (
              <button
                key={s.id}
                onClick={() => go(i)}
                aria-label={`slide ${i + 1}`}
                className={`h-2 rounded-full transition-all ${
                  i === index ? "w-7 bg-accent-light opacity-100" : "w-2 bg-text-muted opacity-30 hover:opacity-60"
                }`}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
