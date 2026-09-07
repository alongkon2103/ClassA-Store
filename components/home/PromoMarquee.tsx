"use client"

// แถบโปรโมชั่นเลื่อนไม่มีที่สิ้นสุด — เรนเดอร์รายการซ้ำ 2 ชุดแล้วเลื่อน -50%
// พอครบรอบตำแหน่งจะตรงกับจุดเริ่ม เลยดูต่อเนื่องไม่มีสะดุด (hover = หยุด)
import { useTranslations } from "next-intl"

export default function PromoMarquee() {
  const t = useTranslations("Home")
  const items = [
    { hot: false, text: t("promo_1") },
    { hot: false, text: t("promo_2") },
    { hot: true, text: t("promo_3") },
  ]
  const loop = [...items, ...items]

  return (
    <div className="page-container">
      <div
        className="promo-wrap relative overflow-hidden rounded-xl border border-border-soft mb-8"
        style={{ background: "linear-gradient(90deg,var(--color-bg-surface),#0f1830,var(--color-bg-surface))" }}
      >
        {/* ไล่จางซ้าย/ขวา ให้ข้อความค่อย ๆ หายไปที่ขอบแทนการตัดกึก */}
        <div aria-hidden className="absolute inset-y-0 left-0 w-[60px] z-[2] pointer-events-none"
             style={{ background: "linear-gradient(90deg,var(--color-bg-surface),transparent)" }} />
        <div aria-hidden className="absolute inset-y-0 right-0 w-[60px] z-[2] pointer-events-none"
             style={{ background: "linear-gradient(-90deg,var(--color-bg-surface),transparent)" }} />

        <div className="flex items-center w-max animate-promo">
          {loop.map((it, i) => (
            <div key={i} className="flex items-center">
              <div className="flex items-center gap-3.5 px-10 py-3.5 whitespace-nowrap">
                <span className={`px-3.5 py-1 rounded-full text-[0.7rem] font-bold ${it.hot ? "bg-hot text-white" : "bg-success text-black"}`}>
                  {it.hot ? "HOT" : "NEW"}
                </span>
                <p className="text-[0.92rem] font-bold">{it.text}</p>
              </div>
              <span className="text-accent-light opacity-30 px-1 text-[0.6rem]">✦</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
