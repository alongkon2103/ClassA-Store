"use client"

// เลย์เอาต์หน้า "ออเดอร์ของฉัน" ตามดีไซน์ NewDesign/orders.html
// ส่วนเนื้อหาฝั่งขวา: หัวเรื่อง + แท็บสถานะ + ตาราง (sidebar อยู่ใน AccountShell ที่หน้า orders ครอบให้)
import { useMemo, useState } from "react"
import { useTranslations } from "next-intl"
import { Link } from "@/i18n/routing"
import OrderListClient from "./OrderListClient"

/* eslint-disable @typescript-eslint/no-explicit-any */
type Order = any

const TABS = ["all", "pending", "paid", "cancelled"] as const
type Tab = (typeof TABS)[number]
// แบ่งหน้าฝั่ง client ตามดีไซน์ (« 1 2 3 … 10 ») — ออเดอร์ทั้งหมดโหลดมาแล้วจาก server อยู่แล้ว
const PAGE_SIZE = 10

function tabOf(o: Order): Exclude<Tab, "all"> {
  if (o.status === "paid") return "paid"
  if (o.status === "pending") return "pending"
  return "cancelled"
}

export default function OrdersDashboard({
  orders, livegenEnabled,
}: { orders: Order[]; livegenEnabled?: boolean }) {
  const t = useTranslations("Orders")
  const [tab, setTab] = useState<Tab>("all")
  const [kind, setKind] = useState<"all" | "rent" | "lifetime">("all")
  const [page, setPage] = useState(1)

  const counts = useMemo(() => {
    const c = { all: orders.length, pending: 0, paid: 0, cancelled: 0 }
    for (const o of orders) c[tabOf(o)]++
    return c
  }, [orders])

  const shown = useMemo(() => {
    return orders.filter((o) => {
      if (tab !== "all" && tabOf(o) !== tab) return false
      if (kind !== "all") {
        // "ถาวร" ดูจากวันหมดอายุปีสูงมาก (sentinel) ที่ระบบใช้แทนสิทธิ์ตลอดชีพ
        const perm = o.expires_at ? new Date(o.expires_at).getFullYear() > 2900 : false
        if (kind === "lifetime" && !perm) return false
        if (kind === "rent" && perm) return false
      }
      return true
    })
  }, [orders, tab, kind])

  // หน้าปัจจุบัน (กันเลยขอบเมื่อสลับแท็บแล้วจำนวนหน้าลดลง)
  const totalPages = Math.max(1, Math.ceil(shown.length / PAGE_SIZE))
  const cur = Math.min(page, totalPages)
  const pageItems = shown.slice((cur - 1) * PAGE_SIZE, cur * PAGE_SIZE)
  // เลขหน้าที่โชว์: หน้าแรก / หน้าสุดท้าย / รอบๆ หน้าปัจจุบัน ที่เหลือเป็น "…"
  const pageList: (number | "dots")[] = []
  for (let p = 1; p <= totalPages; p++) {
    if (p === 1 || p === totalPages || Math.abs(p - cur) <= 1) pageList.push(p)
    else if (pageList[pageList.length - 1] !== "dots") pageList.push("dots")
  }

  // ปุ่มเลขหน้า (36px / 32px จอเล็ก) ตามดีไซน์ .page-btn
  const pageBtn = (active: boolean) =>
    `w-8 h-8 sm:w-9 sm:h-9 rounded-lg border flex items-center justify-center text-[0.72rem] sm:text-[0.8rem] font-semibold transition-colors disabled:opacity-40 disabled:pointer-events-none ${
      active ? "bg-accent border-accent text-white" : "border-border-soft text-text-muted hover:border-border-light hover:text-text-base"}`

  return (
    <div className="min-w-0">
        <h1 className="text-[1.2rem] sm:text-[1.5rem] font-black mb-5">{t("my_orders")}</h1>

        {/* แท็บสถานะ */}
        <div className="flex gap-1 mb-5 border-b border-border-soft overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {TABS.map((k) => (
            <button key={k} onClick={() => { setTab(k); setPage(1) }}
              className={`px-4 sm:px-[18px] py-3 text-[0.82rem] font-semibold whitespace-nowrap relative transition-colors ${
                tab === k ? "text-accent-light" : "text-text-dim hover:text-text-muted"}`}>
              {t(`tab_${k}`)}
              <span className="ml-1.5 text-[0.7rem] opacity-70">{counts[k]}</span>
              {tab === k && <span className="absolute left-0 right-0 -bottom-px h-[2px] bg-accent rounded-full" />}
            </button>
          ))}
        </div>

        {/* แถบเครื่องมือ */}
        <div className="flex items-center justify-between gap-3 mb-4 flex-wrap max-md:flex-col max-md:items-start max-md:gap-2.5">
          <span className="text-[0.82rem] text-text-dim">{t("showing", { shown: pageItems.length, total: shown.length })}</span>
          <select value={kind} onChange={(e) => { setKind(e.target.value as typeof kind); setPage(1) }}
                  className="px-3.5 py-2 rounded-lg border border-border-soft bg-bg-card text-text-muted text-[0.8rem] outline-none focus:border-accent transition-colors max-md:w-full">
            <option value="all">{t("kind_all")}</option>
            <option value="rent">{t("kind_rent")}</option>
            <option value="lifetime">{t("kind_lifetime")}</option>
          </select>
        </div>

        {shown.length === 0 ? (
          <div className="bg-bg-card border border-border-soft rounded-[14px] p-10 text-center">
            <p className="text-text-muted text-sm mb-4">{t("empty_title")}</p>
            <Link href="/products" className="inline-flex px-6 py-2.5 bg-accent hover:bg-accent-light text-white text-[14px] font-bold rounded-xl transition-colors">
              {t("browse_products")}
            </Link>
          </div>
        ) : (
          <>
            <OrderListClient orders={pageItems} livegenEnabled={livegenEnabled} />

            {/* แบ่งหน้า — ปุ่ม 36px (32px บนจอเล็ก) ตามดีไซน์ */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-1 sm:gap-1.5 mt-6">
                <button onClick={() => setPage(Math.max(1, cur - 1))} disabled={cur === 1} aria-label="previous page" className={pageBtn(false)}>«</button>
                {pageList.map((p, i) =>
                  p === "dots" ? (
                    <span key={`dots-${i}`} className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center text-[0.72rem] sm:text-[0.8rem] font-semibold text-text-dim">…</span>
                  ) : (
                    <button key={p} onClick={() => setPage(p)} className={pageBtn(p === cur)}>{p}</button>
                  ),
                )}
                <button onClick={() => setPage(Math.min(totalPages, cur + 1))} disabled={cur === totalPages} aria-label="next page" className={pageBtn(false)}>»</button>
              </div>
            )}
          </>
        )}
    </div>
  )
}
