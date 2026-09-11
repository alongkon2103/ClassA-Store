"use client"

// โครงหน้า "บัญชีของฉัน" ตามดีไซน์ NewDesign/orders.html
// ซ้าย = การ์ดผู้ใช้ + เมนู + การ์ดแนะนำเพื่อน · ขวา = เนื้อหาของแต่ละหน้า
// จอเล็ก (<lg) ซ่อน sidebar แล้วใช้แถบเมนูเลื่อนแนวนอนด้านบนแทน
//
// การ์ดผู้ใช้โชว์ยอด AC Points (AccountFrame ส่งมา) + เมนู "Coins ของฉัน" ตามดีไซน์ — ระบบแลกแต้มเป็นเฟสถัดไป
import { useSession, signOut } from "next-auth/react"
import { useTranslations } from "next-intl"
import { Link } from "@/i18n/routing"

export type AccountSection = "account" | "orders" | "coins" | "coupons" | "reviews" | "favorites"

const ITEMS: { key: AccountSection; href: string }[] = [
  { key: "account", href: "/account" },
  { key: "orders", href: "/orders" },
  { key: "coins", href: "/account/coins" },
  { key: "coupons", href: "/account/coupons" },
  { key: "reviews", href: "/account/reviews" },
  { key: "favorites", href: "/account/favorites" },
]

const svgProps = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const }
const ICONS: Record<AccountSection | "affiliate", React.ReactNode> = {
  account: <svg {...svgProps}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>,
  orders: <svg {...svgProps}><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" /><line x1="3" y1="6" x2="21" y2="6" /><path d="M16 10a4 4 0 0 1-8 0" /></svg>,
  coins: <svg {...svgProps}><circle cx="12" cy="12" r="9" /><path d="M14.5 9.5a2.5 2.5 0 0 0-5 0c0 2.5 5 2.5 5 5a2.5 2.5 0 0 1-5 0" /><path d="M12 6v1.5M12 16.5V18" /></svg>,
  coupons: <svg {...svgProps}><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" /><line x1="7" y1="7" x2="7.01" y2="7" /></svg>,
  reviews: <svg {...svgProps}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>,
  favorites: <svg {...svgProps}><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" /></svg>,
  affiliate: <svg {...svgProps}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /></svg>,
}

export default function AccountShell({ active, children, points }: {
  active: AccountSection
  children: React.ReactNode
  points?: { balance: number; active: boolean } | null
}) {
  const t = useTranslations("Account")
  const { data: session } = useSession()
  const name = session?.user?.name || t("member")
  const initial = (name || "A").trim()[0]?.toUpperCase() ?? "A"
  const isAffiliate = session?.user?.role === "affiliate"

  const item = (key: AccountSection | "affiliate", href: string) => {
    const isActive = key === active
    return (
      <li key={key}>
        <Link href={href}
          className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg text-[0.82rem] transition-colors ${
            isActive ? "bg-accent/10 text-accent-light font-semibold" : "text-text-muted hover:bg-white/[0.03] hover:text-text-base"}`}>
          <span className="shrink-0">{ICONS[key]}</span>{t(`nav_${key}`)}
        </Link>
      </li>
    )
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6 pb-12">
      {/* ── SIDEBAR (จอใหญ่) ── */}
      <aside className="hidden lg:flex flex-col gap-4">
        <div className="bg-bg-card border border-border-soft rounded-[14px] p-6 text-center">
          {session?.user?.image ? (
            <img src={session.user.image} alt="" className="w-16 h-16 rounded-full object-cover mx-auto mb-3" />
          ) : (
            <div className="w-16 h-16 rounded-full mx-auto mb-3 flex items-center justify-center text-[1.2rem] font-extrabold text-white text-on-accent"
                 style={{ background: "linear-gradient(135deg,var(--color-accent),var(--color-accent-lighter))" }}>{initial}</div>
          )}
          <h3 className="text-[0.95rem] font-bold mb-0.5 truncate">{name}</h3>
          <div className="text-[0.72rem] text-accent-light">{t("member")}</div>
          {/* ป้าย AC Points ตามดีไซน์ (.user-points) — กดไปหน้า Coins ของฉัน */}
          {points && (
            <Link href="/account/coins" title={t("coins_title")}
              className="mt-3 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[0.78rem] font-bold text-gold bg-gold/10 border border-gold/20 hover:bg-gold/15 transition-colors">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10" /></svg>
              AC Points <strong>{points.balance.toLocaleString()}</strong>
            </Link>
          )}
        </div>

        <ul className="bg-bg-card border border-border-soft rounded-[14px] p-2 list-none">
          {ITEMS.map((i) => item(i.key, i.href))}
          {isAffiliate && item("affiliate", "/affiliate")}
          <div className="h-px bg-border-soft mx-3.5 my-1.5" />
          <li>
            <button onClick={() => signOut({ callbackUrl: "/" })}
              className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg text-[0.82rem] text-hot hover:bg-hot/10 transition-colors">
              <svg {...svgProps}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
              {t("logout")}
            </button>
          </li>
        </ul>

        {/* การ์ดแนะนำเพื่อน — ลิงก์ไปหน้านายหน้าที่มีจริง */}
        {/* <div className="rounded-[14px] p-5 text-center border border-accent/20"
             style={{ background: "var(--gradient-panel)" }}>
          <h4 className="text-[0.88rem] font-bold mb-1">{t("referral_title")}</h4>
          <div className="text-[1.6rem] font-black text-gold mb-1">{t("referral_amount")}</div>
          <p className="text-[0.7rem] text-text-dim mb-3">{t("referral_sub")}</p>
          <Link href="/affiliate" className="inline-block px-5 py-2 rounded-lg bg-accent hover:bg-accent-light text-white text-[0.78rem] font-semibold transition-colors">
            {t("referral_cta")}
          </Link>
        </div> */}
      </aside>

      {/* ── เมนูจอเล็ก: ชิปเลื่อนแนวนอน ── */}
      <nav className="lg:hidden flex gap-2 overflow-x-auto pb-1 -mb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {ITEMS.map((i) => (
          <Link key={i.key} href={i.href}
            className={`shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[0.78rem] font-semibold border transition-colors ${
              i.key === active ? "bg-accent/10 border-accent/30 text-accent-light" : "border-border-soft text-text-muted hover:text-text-base"}`}>
            <span className="[&>svg]:w-4 [&>svg]:h-4">{ICONS[i.key]}</span>{t(`nav_${i.key}`)}
          </Link>
        ))}
      </nav>

      <main className="min-w-0">{children}</main>
    </div>
  )
}
