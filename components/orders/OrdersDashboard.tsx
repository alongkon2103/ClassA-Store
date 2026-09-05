"use client"

// เลย์เอาต์หน้า "ออเดอร์ของฉัน" ตามดีไซน์ NewDesign/orders.html
// ซ้าย = การ์ดผู้ใช้ + เมนู + การ์ดแนะนำเพื่อน · ขวา = หัวเรื่อง + แท็บสถานะ + รายการ
//
// เมนูข้างใส่เฉพาะหน้าที่มีจริงในระบบ (ออเดอร์ / นายหน้า / ออกจากระบบ)
// ของในดีไซน์อย่าง AC Points, Coins, คูปองของฉัน ยังไม่มีระบบรองรับ เลยไม่ใส่
import { useMemo, useState } from "react"
import { useSession, signOut } from "next-auth/react"
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
  const { data: session } = useSession()
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

  const name = session?.user?.name || t("member")
  const initial = (name || "A").trim()[0]?.toUpperCase() ?? "A"

  const pageBtn = (active: boolean) =>
    `w-8 h-8 sm:w-9 sm:h-9 rounded-lg border flex items-center justify-center text-[0.72rem] sm:text-[0.8rem] font-semibold transition-colors disabled:opacity-40 disabled:pointer-events-none ${
      active ? "bg-accent border-accent text-white" : "border-border-soft text-text-muted hover:border-border-light hover:text-text-base"}`

  const navItem = (href: string, label: string, icon: React.ReactNode, active = false) => (
    <li>
      <Link href={href}
        className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg text-[0.82rem] transition-colors ${
          active ? "bg-accent/10 text-accent-light font-semibold" : "text-text-muted hover:bg-white/[0.03] hover:text-text-base"}`}>
        <span className="shrink-0">{icon}</span>{label}
      </Link>
    </li>
  )

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6 pb-12">
      {/* ── SIDEBAR ── */}
      <aside className="hidden lg:flex flex-col gap-4">
        <div className="bg-bg-card border border-border-soft rounded-[14px] p-6 text-center">
          {session?.user?.image ? (
            <img src={session.user.image} alt="" className="w-16 h-16 rounded-full object-cover mx-auto mb-3" />
          ) : (
            <div className="w-16 h-16 rounded-full mx-auto mb-3 flex items-center justify-center text-[1.2rem] font-extrabold text-white"
                 style={{ background: "linear-gradient(135deg,var(--color-accent),var(--color-accent-lighter))" }}>{initial}</div>
          )}
          <h3 className="text-[0.95rem] font-bold mb-0.5 truncate">{name}</h3>
          <div className="text-[0.72rem] text-accent-light">{t("member")}</div>
        </div>

        <ul className="bg-bg-card border border-border-soft rounded-[14px] p-2 list-none">
          {navItem("/orders", t("my_orders"), (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" /><line x1="3" y1="6" x2="21" y2="6" /><path d="M16 10a4 4 0 0 1-8 0" />
            </svg>), true)}
          {navItem("/products", t("browse_products"), (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
            </svg>))}
          {navItem("/affiliate", t("affiliate"), (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            </svg>))}
          <div className="h-px bg-border-soft mx-3.5 my-1.5" />
          <li>
            <button onClick={() => signOut({ callbackUrl: "/" })}
              className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg text-[0.82rem] text-hot hover:bg-hot/10 transition-colors">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              {t("logout")}
            </button>
          </li>
        </ul>

        {/* การ์ดแนะนำเพื่อน — ลิงก์ไปหน้านายหน้าที่มีจริง */}
        <div className="rounded-[14px] p-5 text-center border border-accent/20"
             style={{ background: "linear-gradient(135deg,#0f1a3a,#162550)" }}>
          <h4 className="text-[0.88rem] font-bold mb-1">{t("referral_title")}</h4>
          <div className="text-[1.6rem] font-black text-gold mb-1">{t("referral_amount")}</div>
          <p className="text-[0.7rem] text-text-dim mb-3">{t("referral_sub")}</p>
          <Link href="/affiliate" className="inline-block px-5 py-2 rounded-lg bg-accent hover:bg-accent-light text-white text-[0.78rem] font-semibold transition-colors">
            {t("referral_cta")}
          </Link>
        </div>
      </aside>

      {/* ── MAIN ── */}
      <main className="min-w-0">
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
      </main>
    </div>
  )
}
