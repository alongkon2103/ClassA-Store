"use client"

// กล่องค้นหาใน navbar: กดไอคอน → กล่องพิมพ์เลื่อนออกมา + รายชื่อเกมที่ตรงให้กดได้เลย
// ดึงจาก /api/search (debounce 200ms) · Esc หรือคลิกข้างนอกเพื่อปิด
import { useEffect, useRef, useState } from "react"
import { useLocale, useTranslations } from "next-intl"
import { categoryName, type CategoryLabel } from "@/lib/gameCategories"
import { Link } from "@/i18n/routing"
import { getImageUrl } from "@/lib/getImageUrl"

type Item = {
  slug: string; name_th: string; name_en: string
  image: string | null; price: number | null; partner: boolean; category: CategoryLabel | null; href: string
}

export default function NavSearch() {
  const t = useTranslations("Shop")
  const locale = useLocale()
  const isTH = locale === "th"
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState("")
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(false)
  const boxRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // เปิดแล้วโฟกัสช่องพิมพ์ทันที
  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 30) }, [open])

  // ปิดเมื่อคลิกข้างนอก / กด Esc
  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => { if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false) }
    document.addEventListener("mousedown", onDoc); document.addEventListener("keydown", onKey)
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey) }
  }, [open])

  // ค้นหาแบบหน่วงเวลา จะได้ไม่ยิงทุกตัวอักษร
  useEffect(() => {
    const term = q.trim()
    if (!term) { setItems([]); return }
    setLoading(true)
    const id = setTimeout(async () => {
      try {
        const r = await fetch(`/api/search?q=${encodeURIComponent(term)}`)
        const d = r.ok ? await r.json() : { items: [] }
        setItems(d.items ?? [])
      } catch { setItems([]) }
      finally { setLoading(false) }
    }, 200)
    return () => clearTimeout(id)
  }, [q])

  const close = () => { setOpen(false); setQ("") }

  return (
    <div ref={boxRef} className="relative flex items-center">
      {/* กล่องพิมพ์ — ขยายออกทางซ้ายของไอคอนเมื่อเปิด */}
      <div className={`flex items-center overflow-hidden rounded-[10px] border transition-all duration-200 ${
        open ? "w-[200px] sm:w-[260px] border-accent bg-bg-card opacity-100 mr-2" : "w-0 border-transparent opacity-0 pointer-events-none"}`}>
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("search_placeholder")}
          className="w-full h-[38px] px-3 bg-transparent text-[0.85rem] text-text-base outline-none placeholder:text-text-dim"
        />
      </div>

      <button
        onClick={() => (open ? close() : setOpen(true))}
        aria-label={t("search_placeholder")}
        className={`w-[38px] h-[38px] flex items-center justify-center rounded-[10px] border transition-all ${
          open ? "border-accent text-accent-light bg-accent/[0.08]" : "border-border-soft text-text-muted hover:text-text-base hover:border-border-light hover:bg-white/[0.03]"}`}
      >
        {open ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
        )}
      </button>

      {/* รายชื่อเกมที่ตรง */}
      {open && q.trim() && (
        <div className="absolute right-0 top-[calc(100%+8px)] w-[300px] sm:w-[340px] max-h-[380px] overflow-y-auto rounded-xl bg-bg-card border border-border-soft shadow-[0_12px_40px_rgba(0,0,0,0.5)] p-1.5 z-[60]">
          {loading && items.length === 0 && <p className="px-3 py-3 text-[0.8rem] text-text-dim">…</p>}
          {!loading && items.length === 0 && <p className="px-3 py-3 text-[0.8rem] text-text-dim">{t("no_result")}</p>}
          {items.map((it) => (
            <Link key={`${it.partner ? "p" : "o"}-${it.slug}`} href={it.href} onClick={close}
              className="flex items-center gap-3 px-2.5 py-2 rounded-lg hover:bg-white/[0.04] transition-colors">
              <div className="w-11 h-11 rounded-lg overflow-hidden shrink-0" style={{ background: "var(--gradient-thumb)" }}>
                {it.image && <img src={it.partner ? it.image : getImageUrl(it.image)} alt="" className="w-full h-full object-cover" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[0.82rem] font-semibold truncate">{isTH ? it.name_th : it.name_en}</p>
                <p className="text-[0.68rem] text-text-dim">{categoryName(it.category, isTH)}</p>
              </div>
              {it.price != null && <span className="text-[0.82rem] font-bold text-accent-lighter shrink-0">฿{it.price.toLocaleString()}</span>}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
