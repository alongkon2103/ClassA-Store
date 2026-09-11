"use client"

// สถานะออเดอร์ Maki: pending = poll /api/maki/orders/<id> (3 วิ นาทีแรก แล้ว 6 วิ) จน paid/expired
// paid = โชว์สิทธิ์ที่ Maki ส่งเข้าบัญชี + วิธีใช้ (Maki Launcher) + preset + AC Points
import { useEffect, useState } from "react"
import { useLocale, useTranslations } from "next-intl"
import { Link } from "@/i18n/routing"
import { getImageUrl } from "@/lib/getImageUrl"
import { fmtDate, variantLabel } from "@/lib/i18n/locale"
import type { MakiOrderView } from "@/lib/makiOrders"

const TONE: Record<string, string> = { pending: "bg-gold/10 text-gold border-gold/25", paid: "bg-success/10 text-success border-success/25", expired: "bg-hot/10 text-hot border-hot/25", failed: "bg-hot/10 text-hot border-hot/25" }

export default function MakiOrderClient({ initial, initialPoints }: { initial: MakiOrderView; initialPoints: number | null }) {
  const t = useTranslations("Orders")
  const locale = useLocale()
  const [order, setOrder] = useState(initial)
  const [points, setPoints] = useState(initialPoints)

  useEffect(() => {
    if (order.status !== "pending") return
    let alive = true, n = 0
    let timer: ReturnType<typeof setTimeout>
    const loop = async () => {
      if (!alive) return
      n++
      try {
        const r = await fetch(`/api/maki/orders/${order.id}`, { cache: "no-store" })
        if (r.ok) { const d = await r.json(); if (alive) { setOrder(d.order); setPoints(d.points) } }
      } catch { /* ลองรอบถัดไป */ }
      if (alive) timer = setTimeout(loop, n < 20 ? 3000 : 6000)
    }
    timer = setTimeout(loop, 3000)
    return () => { alive = false; clearTimeout(timer) }
  }, [order.status, order.id])

  const name = order.product ? (locale === "th" ? order.product.name_th : order.product.name_en) : order.plan_key
  const planLabel = order.plan ? variantLabel(order.plan, locale) : order.plan_key
  const payable = order.status === "pending" && !!order.payment_url && (!order.expires_at || new Date(order.expires_at) > new Date())
  const provider = order.customer_provider === "google" ? "Google" : "Discord"
  const isLifetime = (days: number) => days >= 36500

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <span className={`px-3 py-1 rounded-full text-[0.72rem] font-bold border ${TONE[order.status] ?? TONE.pending}`}>{t(`maki_status_${order.status}`)}</span>
        <span className="text-[0.75rem] text-text-dim font-mono">{t("maki_order_no")} {order.id.slice(0, 8).toUpperCase()}</span>
        <span className="text-[0.75rem] text-text-dim">· {fmtDate(order.created_at, locale, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
      </div>
      <h1 className="text-[1.5rem] md:text-[1.9rem] font-black tracking-[-0.02em] mb-6">{t("maki_title")}</h1>

      {/* สินค้า */}
      <div className="bg-bg-card border border-border-soft rounded-[14px] p-5 flex items-center gap-4 mb-4">
        <div className="w-20 h-20 rounded-xl overflow-hidden shrink-0" style={{ background: "var(--gradient-thumb)" }}>
          {order.product?.image && <img src={getImageUrl(order.product.image)} alt="" className="w-full h-full object-cover" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[0.7rem] font-bold uppercase tracking-[0.1em] text-violet-300 mb-0.5">Partner · Maki</p>
          <h2 className="text-[1.05rem] font-bold truncate">{name}</h2>
          <p className="text-[0.8rem] text-text-muted">{planLabel}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-[0.7rem] text-text-dim">{t("maki_price")}</p>
          <p className="text-[1.2rem] font-black text-accent-lighter">฿{order.price_thb.toLocaleString()}</p>
          {order.discount_amount != null && order.list_price_thb != null && (
            <p className="text-[0.72rem] text-text-dim"><span className="line-through">฿{order.list_price_thb.toLocaleString()}</span> <span className="text-success font-semibold">· {t("saved", { amount: order.discount_amount.toLocaleString() })}</span></p>
          )}
        </div>
      </div>

      {/* บัญชีที่รับสิทธิ์ */}
      <div className="bg-bg-card border border-border-soft rounded-[14px] p-5 mb-4">
        <p className="text-[0.72rem] font-bold uppercase tracking-[0.1em] text-text-dim mb-1">{t("maki_delivered_to")}</p>
        <p className="text-[0.95rem] font-bold">{provider} <span className="font-mono text-text-muted text-[0.85rem]">· ID {order.customer_id}</span></p>
        <p className="text-[0.78rem] text-text-muted mt-1 leading-relaxed">{t("maki_launcher_hint", { provider })}</p>
      </div>

      {order.status === "pending" && (
        <div className="bg-bg-card border border-gold/25 rounded-[14px] p-5 mb-4">
          <div className="flex items-center gap-3 mb-3">
            <span className="w-5 h-5 rounded-full border-2 border-gold/30 border-t-gold animate-spin shrink-0" />
            <p className="text-[0.88rem] font-semibold">{t("maki_waiting")}</p>
          </div>
          {payable ? (
            <a href={order.payment_url!} className="inline-flex items-center justify-center px-6 py-3 rounded-xl bg-accent hover:bg-accent-light text-white text-[0.88rem] font-bold transition-colors">{t("maki_pay_now")}</a>
          ) : (
            <p className="text-[0.8rem] text-text-muted">{t("maki_expired_hint")}</p>
          )}
          <p className="text-[0.72rem] text-text-dim mt-3">{t("maki_no_refund")}</p>
        </div>
      )}

      {order.status === "paid" && (
        <div className="bg-bg-card border border-success/25 rounded-[14px] p-5 mb-4">
          <h3 className="text-[0.95rem] font-bold mb-3 flex items-center gap-2">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-success"><polyline points="20 6 9 17 4 12" /></svg>
            {t("maki_access_title")}
          </h3>
          {order.access && order.access.length > 0 ? (
            <ul className="flex flex-col gap-2 mb-3">
              {order.access.map((a) => (
                <li key={a.key} className="flex items-center justify-between gap-3 rounded-lg bg-bg-base/60 px-4 py-2.5 text-[0.85rem]">
                  <span className="font-semibold">{a.product}</span>
                  <span className="text-text-muted">{isLifetime(a.days) ? t("maki_lifetime") : t("maki_access_until", { date: fmtDate(a.expires_at, locale) })}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[0.8rem] text-text-muted mb-3">{t("maki_access_pending")}</p>
          )}
          <div className="flex flex-wrap gap-2.5 items-center">
            {order.preset_link && (
              <a href={order.preset_link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-accent hover:bg-accent-light text-white text-[0.8rem] font-semibold transition-colors">
                {t("maki_preset")}
              </a>
            )}
            {order.paid_at && <span className="text-[0.75rem] text-text-dim">{t("maki_paid_at", { date: fmtDate(order.paid_at, locale, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) })}</span>}
          </div>
          {points != null && (
            <p className="mt-3 text-[0.8rem] text-gold flex items-center gap-1.5">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10" /></svg>
              {t("maki_points_earned", { points: points.toLocaleString() })}
            </p>
          )}
        </div>
      )}

      {(order.status === "expired" || order.status === "failed") && (
        <div className="bg-bg-card border border-hot/25 rounded-[14px] p-5 mb-4">
          <p className="text-[0.88rem] text-text-muted">{t(order.status === "failed" ? "maki_failed_hint" : "maki_expired_hint")}</p>
        </div>
      )}

      <div className="flex flex-wrap gap-3 mt-6">
        <Link href="/orders" className="px-5 py-2.5 rounded-lg border border-border-soft text-text-muted hover:text-text-base text-[0.82rem] font-semibold transition-colors">{t("back_to_orders")}</Link>
        {order.product && <Link href={`/products/${order.product.slug}`} className="px-5 py-2.5 rounded-lg border border-border-soft text-text-muted hover:text-text-base text-[0.82rem] font-semibold transition-colors">{t("maki_back_product")}</Link>}
      </div>
    </div>
  )
}
