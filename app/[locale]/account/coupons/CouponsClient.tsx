"use client"

import { useState } from "react"
import { useLocale, useTranslations } from "next-intl"
import { Link } from "@/i18n/routing"

export type Coupon = {
  id: string; code: string; type: "fixed" | "percent"; value: number
  min_amount: number | null
  product: { slug: string; name_th: string; name_en: string } | null
  expires_at: string | null
  remaining: number | null
  used_by_me: number
  per_user_limit: number | null
}
export type Redemption = { id: string; code: string; amount_off: number; redeemed_at: string; status: string; product_th: string; product_en: string }

export default function CouponsClient({ coupons, history }: { coupons: Coupon[]; history: Redemption[] }) {
  const t = useTranslations("Account")
  const locale = useLocale()
  const isTH = locale === "th"
  const [copied, setCopied] = useState<string | null>(null)

  const fmt = (s: string | null) =>
    s ? new Date(s).toLocaleDateString(isTH ? "th-TH" : "en-US", { day: "numeric", month: "short", year: "numeric" }) : "—"
  const copy = async (code: string) => {
    try { await navigator.clipboard.writeText(code) } catch { /* คลิปบอร์ดไม่พร้อม (เช่น http) — ผู้ใช้เลือกก๊อปเองได้ */ }
    setCopied(code)
    setTimeout(() => setCopied((c) => (c === code ? null : c)), 1500)
  }

  const statusOf = (c: Coupon): "ok" | "used" | "full" => {
    if (c.remaining === 0) return "full"
    if (c.per_user_limit != null && c.used_by_me >= c.per_user_limit) return "used"
    return "ok"
  }
  const chip = {
    ok: "bg-success/10 text-success border-success/15",
    used: "bg-accent/[0.12] text-accent-lighter border-accent/15",
    full: "bg-hot/10 text-hot border-hot/15",
  }

  return (
    <div>
      <h1 className="text-[1.2rem] sm:text-[1.5rem] font-black mb-1">{t("cp_title")}</h1>
      <p className="text-[0.82rem] text-text-dim mb-5">{t("cp_sub")}</p>

      {coupons.length === 0 ? (
        <div className="bg-bg-card border border-border-soft rounded-[14px] p-10 text-center mb-8">
          <p className="text-text-muted text-sm">{t("cp_empty")}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-8">
          {coupons.map((c) => {
            const st = statusOf(c)
            const usable = st === "ok"
            return (
              <div key={c.id} className={`flex bg-bg-card border border-border-soft rounded-[14px] overflow-hidden ${usable ? "" : "opacity-70"}`}>
                {/* ฝั่งซ้าย: มูลค่า */}
                <div className="w-[118px] shrink-0 flex flex-col items-center justify-center text-center px-3 py-5 border-r border-dashed border-border-light"
                     style={{ background: "var(--gradient-panel)" }}>
                  <div className="text-[1.5rem] font-black text-gold leading-none">
                    {c.type === "percent" ? `${c.value}%` : `฿${c.value.toLocaleString()}`}
                  </div>
                  <div className="text-[0.65rem] text-text-dim mt-1.5 uppercase tracking-[0.05em]">{t("cp_discount")}</div>
                </div>

                {/* ฝั่งขวา: โค้ด + เงื่อนไข */}
                <div className="flex-1 min-w-0 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <code className="font-mono text-[0.95rem] font-bold tracking-[0.06em] text-text-base truncate">{c.code}</code>
                    <button onClick={() => copy(c.code)} disabled={!usable}
                            className="ml-auto shrink-0 px-3 py-[5px] rounded-lg text-[0.68rem] font-semibold border border-border-soft text-text-muted hover:text-text-base hover:border-border-light transition-colors disabled:opacity-40">
                      {copied === c.code ? t("cp_copied") : t("cp_copy")}
                    </button>
                  </div>
                  <ul className="text-[0.7rem] text-text-dim space-y-0.5">
                    <li>{c.product ? t("cp_product_only", { name: isTH ? c.product.name_th : c.product.name_en }) : t("cp_all_products")}</li>
                    {c.min_amount != null && c.min_amount > 0 && <li>{t("cp_min", { amount: c.min_amount.toLocaleString() })}</li>}
                    <li>{c.expires_at ? t("cp_expires", { date: fmt(c.expires_at) }) : t("cp_no_expiry")}</li>
                    {c.remaining != null && <li>{t("cp_left", { n: c.remaining })}</li>}
                  </ul>
                  <div className="flex items-center gap-2 mt-2.5">
                    <span className={`inline-block px-2.5 py-[3px] rounded-md text-[0.65rem] font-bold border ${chip[st]}`}>{t(`cp_status_${st}`)}</span>
                    {usable && (
                      <Link href={c.product ? `/products/${c.product.slug}` : "/products"} className="text-[0.7rem] text-accent-light hover:underline">
                        {t("cp_use_now")} ›
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ประวัติการใช้โค้ด */}
      <h2 className="text-[1rem] font-bold mb-3">{t("cp_history")}</h2>
      {history.length === 0 ? (
        <p className="text-[0.82rem] text-text-dim bg-bg-card border border-border-soft rounded-[14px] p-5">{t("cp_history_empty")}</p>
      ) : (
        <div className="flex flex-col gap-2">
          {history.map((h) => (
            <div key={h.id} className="flex items-center gap-3 bg-bg-card border border-border-soft rounded-[10px] px-4 py-3 text-[0.78rem]">
              <code className="font-mono font-bold tracking-[0.04em]">{h.code}</code>
              <span className="text-text-dim truncate">{isTH ? h.product_th : h.product_en}</span>
              <span className="ml-auto shrink-0 text-success font-semibold">{t("cp_saved", { amount: h.amount_off.toLocaleString() })}</span>
              <span className="shrink-0 text-text-dim">{fmt(h.redeemed_at)}</span>
              {h.status !== "paid" && <span className="shrink-0 text-[0.65rem] px-2 py-0.5 rounded-md bg-hot/10 text-hot border border-hot/15">{h.status}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
