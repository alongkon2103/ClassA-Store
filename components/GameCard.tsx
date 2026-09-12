"use client"

// การ์ดเกมตามดีไซน์ใหม่ — ใช้ร่วมกันทั้งหน้าแรกและหน้าสินค้า
// จงใจไม่ใส่ดาว/จำนวนรีวิวแบบในไฟล์ต้นแบบ เพราะระบบยังไม่มีข้อมูลรีวิวจริง
// (ปั้นตัวเลขบนร้านที่ขายจริงจะกลายเป็นหลอกลูกค้า)

import { useRef, useState } from "react"
import { Link } from "@/i18n/routing"
import { useTranslations } from "next-intl"
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
  price, oldPrice, usdRate, buyLabel, onClick, href, layout = "grid",
  rating, reviewCount,
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
  /** ถ้าใส่ href การ์ดจะเป็นลิงก์ไปหน้าสินค้า (ระบบใหม่) — ถ้าไม่ใส่จะ fallback เป็น onClick (เช่นเกม partner ที่ไม่มีหน้าในเว็บเรา) */
  href?: string
  onClick?: () => void
  /** "list" = แถวแนวนอน (รูปซ้าย ข้อมูลกลาง ราคาขวา) ใช้กับปุ่มสลับมุมมองในหน้าสินค้า */
  layout?: "grid" | "list"
  /** คะแนนเฉลี่ยจากรีวิวจริง (null/0 รีวิว = โชว์ "ยังไม่มีรีวิว" แทน เพื่อให้การ์ดสูงเท่ากันทุกใบ) */
  rating?: number | null
  reviewCount?: number | null
}) {
  const tc = useTranslations("Common")
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

  const usd = (thb: number) => (usdRate ? ` / ${(thb * usdRate).toFixed(2)}` : "")
  // ป้ายส่วนลดมุมขวาบน (ตามดีไซน์ .discount-badge) คิดจากราคาเต็ม → ราคาที่ขาย
  const discountPct = oldPrice != null && oldPrice > price ? Math.round((1 - price / oldPrice) * 100) : 0
  const hasRating = (reviewCount ?? 0) > 0 && rating != null

  const isList = layout === "list"

  const Root = (href ? Link : "article") as React.ElementType
  const rootProps = href ? { href } : { onClick }

  return (
    <Root
      {...rootProps}
      onMouseEnter={enter}
      onMouseLeave={leave}
      className={`group bg-bg-card rounded-[14px] overflow-hidden border border-border-soft cursor-pointer transition-all duration-300 hover:border-accent/40 ${
        isList
          ? "flex flex-col sm:flex-row hover:shadow-[0_4px_16px_rgba(0,0,0,0.3)]"
          : "flex flex-col hover:-translate-y-1.5 hover:shadow-[0_0_0_1px_rgba(37,99,235,0.2),0_12px_40px_rgba(37,99,235,0.15),0_4px_16px_rgba(0,0,0,0.3)]"
      }`}
    >
      <div className={`relative overflow-hidden ${isList ? "w-full sm:w-[200px] aspect-[4/3] sm:aspect-auto sm:h-[130px] sm:self-stretch flex-shrink-0" : "aspect-[4/3]"}`}
           style={{ background: "var(--gradient-thumb)" }}>
        <img
          src={getImageUrl(image || "/placeholder.png")}
          alt={name}
          className={`absolute inset-0 w-full h-full object-cover transition-transform duration-500 ${videoOn ? "opacity-0" : "group-hover:scale-[1.08]"}`}
          onError={(e) => { e.currentTarget.style.visibility = "hidden" }}
        />
        {previewVideo && (
          <video
            ref={videoRef} muted playsInline loop preload="none"
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-200 ${videoOn ? "opacity-100" : "opacity-0 pointer-events-none"}`}
          />
        )}
        {/* ไล่เงาบางๆ ตรงรอยต่อกับส่วน info เท่านั้น (list = ขอบขวา 16% สุดท้าย · grid = ขอบล่าง 22%) ไม่ให้บังรูป */}
        <div aria-hidden className="absolute inset-0 z-[1] pointer-events-none"
             style={{ background: isList
               ? "linear-gradient(to right,transparent 84%,color-mix(in srgb,var(--color-bg-card) 55%,transparent))"
               : "linear-gradient(to top,color-mix(in srgb,var(--color-bg-card) 60%,transparent) 0%,transparent 22%)" }} />
        {badge && (
          <span className={`absolute top-2.5 left-2.5 z-[3] px-2.5 py-[3px] rounded-md text-[0.65rem] font-bold tracking-[0.02em] ${BADGE_CLASS[badge.kind]}`}>
            {badge.text}
          </span>
        )}
        {discountPct > 0 && (
          <span className="absolute top-2.5 right-2.5 z-[3] px-2.5 py-[3px] rounded-md text-[0.62rem] font-bold bg-hot text-white">
            -{discountPct}%
          </span>
        )}
      </div>

      <div className={`px-3.5 flex-1 flex flex-col justify-center ${isList ? "py-3.5" : "pt-3.5"}`}>
        {/* จองบรรทัดป้ายหมวดไว้เสมอ (เกมไม่มีหมวด/หมวดถูกซ่อน) ให้การ์ดสูงเท่ากันทุกใบ */}
        <span className={`text-[0.65rem] font-semibold text-accent-light uppercase tracking-[0.05em] mb-1 ${platform ? "" : "invisible"}`}>{platform || "\u00a0"}</span>
        <h3 className="text-[0.88rem] font-bold mb-1 leading-[1.3] truncate">{name}</h3>
        {/* จองที่ 2 บรรทัดเสมอ (แม้คำอธิบายสั้น/ไม่มี) ให้แถวดาวกับราคาอยู่ระดับเดียวกันทุกใบ */}
        <p className="text-[0.7rem] text-text-dim leading-[1.5] mb-2.5 line-clamp-2 min-h-[2.1rem]">{description}</p>
        {/* คะแนนรีวิว (ตามดีไซน์ .game-rating) — โชว์เสมอ + สูงคงที่ (ตัวเลขดาวตัวใหญ่กว่า "ยังไม่มีรีวิว") ให้การ์ดสูงเท่ากัน */}
        <div className={`flex items-center gap-1 h-5 ${isList ? "" : "mb-3"}`}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" className={hasRating ? "text-gold" : "text-border-light"}>
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
          {hasRating ? (
            <>
              <span className="text-[0.78rem] font-bold">{Number(rating).toFixed(1)}</span>
              <span className="text-[0.68rem] text-text-muted">({reviewCount})</span>
            </>
          ) : (
            <span className="text-[0.68rem] text-text-dim">{tc("no_rating")}</span>
          )}
        </div>
      </div>

      <div className={`px-3.5 py-3 flex items-center gap-2 ${isList ? "sm:flex-col sm:items-end sm:justify-center sm:border-l sm:border-t-0 border-t border-white/[0.06]" : "mt-auto border-t border-white/[0.06]"}`}>
        <div className={`leading-tight ${isList ? "flex-1 min-w-0 sm:flex-none sm:text-right" : "flex-1 min-w-0"}`}>
          {/* ราคาเต็มอยู่บรรทัดบนของตัวเอง — ถ้าวางบรรทัดเดียวกับราคา+USD จะยาวเกินการ์ดแล้วตกบรรทัด ทำให้การ์ดสูงไม่เท่ากัน */}
          {oldPrice != null && oldPrice > price && (
            <span className="block text-[0.68rem] text-text-dim line-through font-medium mb-0.5">฿{oldPrice.toLocaleString()}</span>
          )}
          <span className="block whitespace-nowrap text-[1.05rem] font-extrabold text-text-base tracking-[-0.02em]">
            <span className="text-[0.78rem] font-semibold">฿</span>{price.toLocaleString()}
            {usdRate ? <span className="text-[0.66rem] text-text-dim font-medium tracking-normal">{usd(price)}</span> : null}
          </span>
        </div>
        <span
          className="shrink-0 px-4 py-2.5 rounded-[10px] bg-accent hover:bg-accent-light text-white text-[0.8rem] font-bold flex items-center justify-center gap-[7px] transition-all shadow-[0_2px_12px_rgba(37,99,235,0.2)] hover:shadow-[0_4px_20px_rgba(37,99,235,0.35)] active:scale-95 flex-shrink-0"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" />
            <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
          </svg>
          {buyLabel}
        </span>
      </div>
    </Root>
  )
}
