"use client"

// แกลเลอรีรูปสินค้าแบบ carousel: เลื่อนซ้าย/ขวา · จุดบอกตำแหน่ง · ปัดบนมือถือ · เลื่อนเองทุก 5 วิ
// (หยุดตอนเอาเมาส์ชี้ หรือ 8 วิหลังผู้ใช้กดเอง) — thumbnail ข้างนอกคุม index ตัวเดียวกันผ่าน onChange
import { useEffect, useRef, useState } from "react"
import { useTranslations } from "next-intl"

export default function ImageCarousel({ images, alt, index, onChange, autoplayMs = 5000, children }: {
  images: string[]
  alt: string
  index: number
  onChange: (i: number) => void
  autoplayMs?: number
  /** ของที่วางทับรูป เช่น ป้ายส่วนลด / ปุ่มไปดูวิดีโอ */
  children?: React.ReactNode
}) {
  const t = useTranslations("Common")
  const n = images.length
  const [hover, setHover] = useState(false)
  const pausedUntil = useRef(0)
  const startX = useRef<number | null>(null)

  const go = (i: number, byUser = false) => {
    if (n === 0) return
    onChange(((i % n) + n) % n)
    if (byUser) pausedUntil.current = Date.now() + 8000
  }

  useEffect(() => {
    if (n <= 1 || !autoplayMs) return
    const id = setInterval(() => {
      if (hover || Date.now() < pausedUntil.current) return
      onChange((index + 1) % n)
    }, autoplayMs)
    return () => clearInterval(id)
  }, [n, index, hover, autoplayMs, onChange])

  const arrow = "absolute top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-black/45 border border-white/20 text-white flex items-center justify-center backdrop-blur-sm transition hover:bg-black/65 hover:scale-105 opacity-0 group-hover:opacity-100 max-lg:opacity-100"

  return (
    <div
      className="relative aspect-[16/10] rounded-2xl overflow-hidden border border-border-soft group select-none touch-pan-y"
      style={{ background: "var(--gradient-thumb)" }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onPointerDown={(e) => { startX.current = e.clientX }}
      onPointerUp={(e) => {
        if (startX.current == null) return
        const dx = e.clientX - startX.current
        startX.current = null
        if (Math.abs(dx) > 40) go(dx < 0 ? index + 1 : index - 1, true)
      }}
      onPointerCancel={() => { startX.current = null }}
    >
      <div className="flex h-full transition-transform duration-500 ease-out" style={{ transform: `translateX(-${index * 100}%)` }}>
        {images.map((src, i) => (
          <img key={i} src={src} alt={i === index ? alt : ""} draggable={false} loading={i === 0 ? "eager" : "lazy"}
               className="w-full h-full object-cover shrink-0"
               onError={(e) => { e.currentTarget.style.visibility = "hidden" }} />
        ))}
      </div>

      {children}

      {n > 1 && (
        <>
          <button onClick={() => go(index - 1, true)} aria-label={t("prev_image")} className={`${arrow} left-3`}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
          </button>
          <button onClick={() => go(index + 1, true)} aria-label={t("next_image")} className={`${arrow} right-3`}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
          </button>
          <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5 z-10">
            {images.map((_, i) => (
              <button key={i} onClick={() => go(i, true)} aria-label={`image ${i + 1}`}
                      className={`h-1.5 rounded-full transition-all ${i === index ? "w-5 bg-white" : "w-1.5 bg-white/45 hover:bg-white/75"}`} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
