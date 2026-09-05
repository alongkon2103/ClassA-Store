"use client"

// การ์ดเกมตามดีไซน์ใหม่ — ใช้ร่วมกันทั้งหน้าแรกและหน้าสินค้า
// จงใจไม่ใส่ดาว/จำนวนรีวิวแบบในไฟล์ต้นแบบ เพราะระบบยังไม่มีข้อมูลรีวิวจริง
// (ปั้นตัวเลขบนร้านที่ขายจริงจะกลายเป็นหลอกลูกค้า)

import { useRef, useState } from "react"
import { getImageUrl } from "@/lib/getImageUrl"

export type CardBadge = { text: string; kind: "hot" | "new" | "best" | "partner" }

const BADGE_CLASS: Record<CardBadge["kind"], string> = {
  new: "bg-success text-black",
  best: "bg-accent text-white",
  hot: "bg-hot text-white",
  partner: "bg-violet-500 text-white",
}

export default function GameCard({
  name, description, image, previewVideo, platform, badge,
  price, oldPrice, usdRate, buyLabel, onClick,
}: {
  name: string
  description?: string | null
  image?: string | null
  previewVideo?: string | null
  platform?: string
  badge?: CardBadge | null
  price: number
  oldPrice?: number | null
  usdRate?: number | null
  buyLabel: string
  onClick?: () => void
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [videoOn, setVideoOn] = useState(false)

  // วิดีโอโหลดตอน hover เท่านั้น (preload="none") หน้ารวมเลยไม่หนัก
  const enter = () => {
    if (!previewVideo) return
    setVideoOn(true)
    const v = videoRef.current
    if (v) {
      if (!v.src) v.src = getImageUrl(previewVideo)
      v.currentTime = 0
      v.play().catch(() => {})
    }
  }
  const leave = () => {
    if (!previewVideo) return
    videoRef.current?.pause()
    setVideoOn(false)
  }

  const usd = (thb: number) => (usdRate ? ` / $${(thb * usdRate).toFixed(2)}` : "")

  return (
    <article
      onClick={onClick}
      onMouseEnter={enter}
      onMouseLeave={leave}
      className="group bg-bg-card rounded-[14px] overflow-hidden border border-border-soft flex flex-col cursor-pointer transition-all duration-300 hover:-translate-y-1.5 hover:border-accent/40 hover:shadow-[0_0_0_1px_rgba(37,99,235,0.2),0_12px_40px_rgba(37,99,235,0.15),0_4px_16px_rgba(0,0,0,0.3)]"
    >
      <div className="relative aspect-[4/3] overflow-hidden" style={{ background: "linear-gradient(145deg,#141e36,#0d1526)" }}>
        <img
          src={getImageUrl(image || "/placeholder.png")}
          alt={name}
          className={`w-full h-full object-cover transition-transform duration-500 ${videoOn ? "opacity-0" : "group-hover:scale-[1.08]"}`}
        />
        {previewVideo && (
          <video
            ref={videoRef} muted playsInline loop preload="none"
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-200 ${videoOn ? "opacity-100" : "opacity-0 pointer-events-none"}`}
          />
        )}
        {/* ไล่เงาจากล่างขึ้น ให้การ์ดกลืนกับพื้นหลังส่วน info */}
        <div aria-hidden className="absolute inset-0 z-[1] pointer-events-none"
             style={{ background: "linear-gradient(to top,var(--color-bg-card) 0%,transparent 40%)" }} />
        {badge && (
          <span className={`absolute top-2.5 left-2.5 z-[3] px-2.5 py-[3px] rounded-md text-[0.65rem] font-bold tracking-[0.02em] ${BADGE_CLASS[badge.kind]}`}>
            {badge.text}
          </span>
        )}
      </div>

      <div className="px-3.5 pt-3.5 flex-1 flex flex-col">
        {platform && (
          <span className="text-[0.65rem] font-semibold text-accent-light uppercase tracking-[0.05em] mb-1">{platform}</span>
        )}
        <h3 className="text-[0.88rem] font-bold mb-1 leading-[1.3] truncate">{name}</h3>
        {description && <p className="text-[0.7rem] text-text-dim leading-[1.5] mb-2.5 line-clamp-2">{description}</p>}
      </div>

      <div className="mt-auto px-3.5 py-3 border-t border-white/[0.06] flex items-center gap-2">
        <div className="flex-1 min-w-0">
          {oldPrice != null && oldPrice > price && (
            <span className="text-[0.72rem] text-text-dim line-through font-medium mr-1.5">฿{oldPrice.toLocaleString()}</span>
          )}
          <span className="text-[1.05rem] font-extrabold text-text-base tracking-[-0.02em]">
            <span className="text-[0.78rem] font-semibold">฿</span>{price.toLocaleString()}
          </span>
          {usdRate ? <span className="text-[0.68rem] text-text-dim">{usd(price)}</span> : null}
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onClick?.() }}
          className="px-4 py-2.5 rounded-[10px] bg-accent hover:bg-accent-light text-white text-[0.8rem] font-bold flex items-center justify-center gap-[7px] transition-all shadow-[0_2px_12px_rgba(37,99,235,0.2)] hover:shadow-[0_4px_20px_rgba(37,99,235,0.35)] active:scale-95 flex-shrink-0"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" />
            <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
          </svg>
          {buyLabel}
        </button>
      </div>
    </article>
  )
}
