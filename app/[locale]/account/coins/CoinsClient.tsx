"use client"

// หน้า "Coins ของฉัน": การ์ดยอดคงเหลือ + กติกา (ย้ำว่าไม่รวมค่าธรรมเนียม) + ประวัติแต้ม
import { useLocale, useTranslations } from "next-intl"
import { Link } from "@/i18n/routing"
import { localeTag } from "@/lib/i18n/locale"
import type { PointsSummary } from "@/lib/points"
import DailyClaim from "@/components/points/DailyClaim"

export default function CoinsClient({ summary }: { summary: PointsSummary }) {
  const t = useTranslations("Account")
  const locale = useLocale()
  const fmtDate = (s: string) => new Date(s).toLocaleString(localeTag(locale), { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
  const per100 = (summary.perBaht * 100).toLocaleString()

  const describe = (e: PointsSummary["entries"][number]) => {
    const product = e.order ? (locale === "th" ? e.order.product_th : e.order.product_en) : ""
    switch (e.type) {
      case "earn_purchase": return { title: t("coins_type_earn_purchase"), sub: product ? t("coins_order", { product }) : null }
      case "reverse_purchase": return { title: t("coins_type_reverse_purchase"), sub: product ? t("coins_order", { product }) : null }
      case "earn_review": return { title: t("coins_type_earn_review"), sub: product || null }
      case "reverse_review": return { title: t("coins_type_reverse_review"), sub: product || null }
      case "earn_daily": return { title: t("coins_type_earn_daily"), sub: null }
      case "adjust_admin": return { title: t("coins_type_adjust_admin"), sub: e.note }
      default: return { title: e.type, sub: e.note }
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-[1.4rem] md:text-[1.7rem] font-black tracking-[-0.02em]">{t("coins_title")}</h1>
        <p className="text-text-muted text-[0.85rem] mt-1">{t("coins_sub")}</p>
      </div>

      {/* แต้มรายวัน (โชว์เฉพาะตอนระบบแต้มเปิดและตั้งแต้มรายวันไว้) */}
      <DailyClaim variant="card" />

      {/* ยอดคงเหลือ + กติกา */}
      <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] gap-4">
        <div className="rounded-[14px] p-6 border border-gold/25 relative overflow-hidden" style={{ background: "var(--gradient-panel)" }}>
          <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-gold/10 blur-2xl pointer-events-none" />
          <div className="flex items-center gap-2 text-[0.72rem] font-bold uppercase tracking-[0.18em] text-gold mb-3">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10" /></svg>
            {t("coins_balance_label")}
          </div>
          <div className="text-[2.6rem] md:text-[3rem] font-black leading-none tracking-[-0.03em] text-gold">{summary.balance.toLocaleString()}</div>
          <div className="text-[0.82rem] text-text-muted mt-2">AC Points</div>
          {!summary.active && <p className="mt-4 text-[0.75rem] text-text-dim">{t("coins_disabled")}</p>}
        </div>

        <div className="bg-bg-card border border-border-soft rounded-[14px] p-6 flex flex-col gap-3">
          <div className="flex items-start gap-3">
            <span className="w-9 h-9 rounded-lg bg-gold/10 text-gold flex items-center justify-center shrink-0">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" /><line x1="3" y1="6" x2="21" y2="6" /><path d="M16 10a4 4 0 0 1-8 0" /></svg>
            </span>
            <div>
              <p className="text-[0.9rem] font-bold">{t("coins_rule", { points: per100 })}</p>
              <p className="text-[0.78rem] text-text-muted leading-[1.6] mt-1">{t("coins_rule_note")}</p>
            </div>
          </div>
          {summary.perReview > 0 && (
            <div className="flex items-start gap-3">
              <span className="w-9 h-9 rounded-lg bg-gold/10 text-gold flex items-center justify-center shrink-0">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
              </span>
              <div>
                <p className="text-[0.9rem] font-bold">{t("coins_rule_review", { points: summary.perReview.toLocaleString() })}</p>
                <Link href="/account/reviews" className="text-[0.75rem] text-accent-light hover:underline">{t("coins_go_review")} →</Link>
              </div>
            </div>
          )}
          <div className="rounded-lg border border-accent/20 bg-accent/[0.06] px-4 py-3">
            <p className="text-[0.8rem] font-bold text-accent-light">{t("coins_soon_title")}</p>
            <p className="text-[0.75rem] text-text-muted leading-[1.6] mt-0.5">{t("coins_soon_body")}</p>
          </div>
          <Link href="/products" className="self-start text-[0.78rem] font-semibold text-accent-light hover:underline">{t("browse")} →</Link>
        </div>
      </div>

      {/* ประวัติ */}
      <div className="bg-bg-card border border-border-soft rounded-[14px] overflow-hidden">
        <div className="px-5 py-4 border-b border-border-soft flex items-center justify-between">
          <h2 className="text-[0.95rem] font-bold">{t("coins_history")}</h2>
          <span className="text-[0.72rem] text-text-dim">{t("fav_count", { count: summary.entries.length })}</span>
        </div>
        {summary.entries.length === 0 ? (
          <p className="px-5 py-10 text-center text-[0.82rem] text-text-muted">{t("coins_history_empty")}</p>
        ) : (
          <ul className="divide-y divide-border-soft">
            {summary.entries.map((e) => {
              const d = describe(e)
              const positive = e.delta > 0
              return (
                <li key={e.id} className="px-5 py-3.5 flex items-center gap-4">
                  <span className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${positive ? "bg-success/10 text-success" : "bg-hot/10 text-hot"}`}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                      {positive ? <path d="M12 5v14M5 12h14" /> : <path d="M5 12h14" />}
                    </svg>
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[0.85rem] font-semibold truncate">{d.title}</p>
                    <p className="text-[0.72rem] text-text-dim truncate">
                      {fmtDate(e.created_at)}{d.sub ? ` · ${d.sub}` : ""}
                    </p>
                  </div>
                  <div className={`text-[0.95rem] font-black shrink-0 ${positive ? "text-success" : "text-hot"}`}>
                    {positive ? "+" : ""}{e.delta.toLocaleString()}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
