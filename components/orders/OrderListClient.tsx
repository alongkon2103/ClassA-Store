"use client"

import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { format } from "date-fns"
import { th as thLocale, enUS } from "date-fns/locale"
import Image from "next/image"
import { Link, useRouter } from "@/i18n/routing"
import { motion, AnimatePresence } from "framer-motion"
import { useTranslations, useLocale } from "next-intl"
import { getImageUrl } from "@/lib/getImageUrl"

type ProductGift = { id: string; url: string; filename: string | null }
type ProductPreset = { id: string; url: string; filename: string | null }

interface Order {
  id: string
  status: string
  payment_method: string | null
  product_id: string
  variant_id: string | null
  whitelisted_username: string | null
  whitelist_status: string | null
  products: {
    name_th: string
    name_en: string
    type: string
    download_url: string | null
    info_page_url: string | null
    product_images: { url: string | null }[]
    product_gifts: ProductGift[]
    product_presets: ProductPreset[]
    product_functions: unknown[]
  }
  product_variants: { label_th: string | null; label_en: string | null } | null
}

interface OrderListClientProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  orders: any[]
  livegenEnabled?: boolean
}

export default function OrderListClient({ orders, livegenEnabled = true }: OrderListClientProps) {
  const router = useRouter()
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [payingId, setPayingId] = useState<string | null>(null)
  // เวลาอ้างอิงสำหรับนับวันที่เหลือ — อ่านครั้งเดียวตอน mount (กัน render ไม่ pure)
  const [now] = useState(() => Date.now())
  // Modal renders through a portal to document.body so it escapes the
  // `relative z-10` wrapper in orders/page.tsx. Without the portal, the modal's
  // z-[100] is capped by the parent's z-10 stacking context, which lets the
  // sticky Navbar (z-50, but at root) draw on top of the modal.
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const t = useTranslations("Orders")
  const tLive = useTranslations("LiveGen")
  const locale = useLocale()

  const handlePay = async (e: React.MouseEvent, order: Order) => {
    e.stopPropagation()

    // paypal_me is paid on OUR own page against the amount frozen at creation —
    // the customer pays that exact figure and the worker matches on it, so just
    // return to that page. Never re-hit an API here that could change the amount.
    if (order.payment_method === "paypal_me") {
      router.push(`/checkout/${order.id}`)
      return
    }

    setPayingId(order.id)
    try {
      // Resume the SAME provider the order was created with — a PayPal pending
      // order must re-enter the PayPal flow (via /retry which reuses the row),
      // a Stripe pending order goes back through /api/checkout. Without this
      // split, all "Pay again" clicks fell through to Stripe and paypal-tagged
      // orders silently created a Stripe Card session.
      const isPaypal = order.payment_method === "paypal"
      const endpoint = isPaypal ? "/api/checkout/paypal/retry" : "/api/checkout"
      const body = isPaypal
        ? { orderId: order.id, locale }
        : {
            productId: order.product_id,
            variantId: order.variant_id,
            paymentMethod: order.payment_method ?? "promptpay",
            locale,
            whitelistUsername: order.whitelisted_username ?? "",
          }

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error("Checkout failed")
      const data = await res.json()
      if (data.url) window.location.href = data.url
    } catch (err) {
      console.error(err)
      alert("Failed to resume payment")
    } finally {
      setPayingId(null)
    }
  }

  return (
    <>
      {/* ตารางออเดอร์ตามดีไซน์ NewDesign/orders.html
          จอใหญ่ = ตาราง 7 คอลัมน์ · จอเล็ก (<md) = แต่ละแถวกลายเป็นการ์ดซ้อนกัน (ตามต้นแบบ)
          ปุ่มทั้งหมดของเดิมยังอยู่: ชำระเงิน / เล่นเกม / ดาวน์โหลด / ตั้งค่า / ดูรายละเอียด */}
      <table className="w-full max-md:block border-separate [border-spacing:0_8px] max-md:[border-spacing:0]">
        <thead className="max-md:hidden">
          <tr className="text-left text-[0.72rem] font-semibold text-text-dim uppercase tracking-[0.04em]">
            {[t("col_order"), t("col_product"), t("col_type"), t("col_price"), t("col_status"), t("col_date"), t("col_manage")].map((h) => (
              <th key={h} className="px-3 pb-2 font-semibold">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="max-md:block">
          {orders.map((order) => {
            const imageUrl = order.products.product_images[0]?.url || "/placeholder.png"
            const isPaid = order.status === "paid" || order.status === "Admin Buy"
            const isPending = order.status === "pending"
            const isTrial = order.order_type === "TRIAL"
            const isPaying = payingId === order.id
            const isDesktop = order.products?.type === "desktop_program"
            const name = locale === "th" ? order.products.name_th : order.products.name_en
            const variantLabel = locale === "th"
              ? (order.product_variants?.label_th || t("standard_version"))
              : (order.product_variants?.label_en || t("standard_version"))

            // ประเภท: ถาวร ดูจาก variant ก่อน ไม่มีค่อยดูวันหมดอายุ (ปี 9999 = ถาวร)
            const expiresAt = order.expires_at ? new Date(order.expires_at) : null
            const isLifetime = order.product_variants?.duration_type === "permanent" || (expiresAt ? expiresAt.getFullYear() > 2900 : false)
            const durationDays: number | null = order.product_variants?.duration_days ?? null
            const daysLeft = expiresAt && !isLifetime ? Math.ceil((expiresAt.getTime() - now) / 86400000) : null

            // ราคา: amount = ยอดที่จ่ายจริง (หักส่วนลดแล้ว) · ราคาเต็ม = amount + ส่วนลด
            const amount = Number(order.amount)
            const discount = Number(order.discount_amount ?? 0)
            const created = order.created_at ? new Date(order.created_at) : null
            const dateLocale = locale === "th" ? thLocale : enUS

            const statusKind = isTrial ? "trial" : isPaid ? "paid" : isPending ? "pending" : "cancelled"
            const badgeCls = {
              paid: "bg-success/10 text-success border-success/15",
              pending: "bg-accent/[0.12] text-accent-lighter border-accent/15",
              cancelled: "bg-hot/10 text-hot border-hot/15",
              trial: "bg-violet-500/10 text-violet-400 border-violet-500/20",
            }[statusKind]
            const statusLabel = { paid: t("status_paid"), pending: t("status_pending"), cancelled: order.status === "expired" ? t("status_expired") : t("status_cancelled"), trial: t("free_trial") }[statusKind]
            const statusSub = isPaid
              ? (daysLeft != null && daysLeft >= 0 && !isLifetime ? t("sub_days_left", { days: daysLeft }) : t("sub_received"))
              : isPending ? t("sub_pending_pay") : isTrial ? t("trial_badge") : t("sub_expired")

            // จอเล็ก: ช่องส่วนใหญ่เป็น block เต็มแถว ยกเว้น "ประเภท" กับ "ราคา" ที่วางเรียงกันในบรรทัดเดียว (ตามดีไซน์)
            const tdBase = "px-3 py-3.5 bg-bg-card border-y border-border-soft max-md:bg-transparent max-md:border-0 max-md:py-1 max-md:px-0"
            const td = `${tdBase} max-md:block max-md:w-full`
            const tdInline = `${tdBase} max-md:inline-block max-md:w-auto max-md:align-top`
            const btn = "px-3.5 py-[7px] rounded-lg text-[0.72rem] font-semibold text-center transition-colors max-md:flex-1"

            return (
              <tr key={order.id}
                  className="max-md:block max-md:bg-bg-card max-md:border max-md:border-border-soft max-md:rounded-xl max-md:p-4 max-md:mb-3">
                {/* ออเดอร์ */}
                <td className={`${td} border-l rounded-l-[10px] max-md:rounded-none max-md:pb-3 max-md:mb-3 max-md:border-b max-md:border-border-soft`}>
                  <span className="block text-[0.75rem] font-bold text-accent-light mb-0.5">#{order.id.slice(0, 8).toUpperCase()}</span>
                  <Link href={`/orders/${order.id}`} className="text-[0.65rem] text-accent-light hover:underline">{t("order_details_link")} ›</Link>
                </td>

                {/* สินค้า */}
                <td className={`${td} max-md:mb-2.5`}>
                  <div className="flex items-center gap-3">
                    <div className="w-14 h-14 rounded-lg overflow-hidden shrink-0 relative" style={{ background: "linear-gradient(135deg,#141e36,#0d1526)" }}>
                      <OrderThumb src={getImageUrl(imageUrl)} alt={name} />
                      {isTrial && <span className="absolute bottom-1 left-1 bg-violet-500 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full uppercase">{t("trial_badge")}</span>}
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-[0.82rem] font-bold mb-0.5 truncate">{name}</h4>
                      <div className="text-[0.68rem] text-text-dim truncate">{isDesktop ? "PC" : "Roblox"} · {isTrial ? t("free_trial") : variantLabel}</div>
                    </div>
                  </div>
                </td>

                {/* ประเภท */}
                <td className={`${tdInline} max-md:mr-3`}>
                  <span className={`inline-block px-2.5 py-[3px] rounded-md text-[0.65rem] font-bold border ${
                    isTrial ? "bg-violet-500/10 text-violet-400 border-violet-500/20"
                      : isLifetime ? "bg-success/10 text-success border-success/15"
                        : "bg-accent/[0.12] text-accent-lighter border-accent/15"}`}>
                    {isTrial ? t("free_trial") : isLifetime ? t("type_lifetime") : t("type_rent")}
                  </span>
                  <div className="text-[0.68rem] text-text-dim mt-[3px]">
                    {isTrial ? "—" : isLifetime ? "Lifetime" : durationDays ? t("days", { days: durationDays }) : variantLabel}
                  </div>
                </td>

                {/* ราคา */}
                <td className={tdInline}>
                  <div className="text-[0.88rem] font-extrabold">
                    {isTrial ? "FREE" : `฿${amount.toLocaleString()}`}
                    {!isTrial && discount > 0 && <span className="line-through text-text-dim text-[0.72rem] font-medium ml-1">฿{(amount + discount).toLocaleString()}</span>}
                    {!isTrial && discount > 0 && <span className="block text-[0.65rem] text-success font-medium mt-0.5">{t("saved", { amount: discount.toLocaleString() })}</span>}
                  </div>
                </td>

                {/* สถานะ */}
                <td className={`${td} max-md:mt-2.5`}>
                  <span className={`inline-block px-3 py-1 rounded-md text-[0.68rem] font-bold border ${badgeCls}`}>{statusLabel}</span>
                  <span className="block text-[0.62rem] text-text-dim mt-[3px]">{statusSub}</span>
                </td>

                {/* วันที่ */}
                <td className={`${td} max-md:mt-1`}>
                  <div className="text-[0.75rem] text-text-muted whitespace-nowrap">
                    {created ? format(created, "d MMM yyyy", { locale: dateLocale }) : "—"}
                    <span className="block text-[0.68rem] text-text-dim">{created ? format(created, "HH:mm", { locale: dateLocale }) : ""}{created && locale === "th" ? " น." : ""}</span>
                  </div>
                </td>

                {/* จัดการ */}
                <td className={`${td} border-r rounded-r-[10px] max-md:rounded-none max-md:mt-3 max-md:pt-3 max-md:border-t max-md:border-border-soft`}>
                  <div className="flex flex-col gap-1.5 min-w-[120px] max-md:flex-row max-md:flex-wrap">
                    {isPending && (
                      <button onClick={(e) => handlePay(e, order)} disabled={isPaying}
                        className={`${btn} bg-accent hover:bg-accent-light text-white disabled:opacity-60 flex items-center justify-center gap-1.5`}>
                        {isPaying && <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                        {isPaying ? t("wait") : t("pay_now")}
                      </button>
                    )}
                    {isPaid && isDesktop && order.products.download_url && (
                      <a href={order.products.download_url} target="_blank" rel="noopener noreferrer"
                         className={`${btn} bg-success/[0.12] hover:bg-success/20 text-success border border-success/15`}>
                        {t("act_download")}
                      </a>
                    )}
                    {isPaid && !isDesktop && (
                      order.products.info_page_url ? (
                        <a href={order.products.info_page_url.startsWith("http") ? order.products.info_page_url : `https://${order.products.info_page_url}`}
                           target="_blank" rel="noopener noreferrer" className={`${btn} bg-accent hover:bg-accent-light text-white`}>
                          {t("act_play")}
                        </a>
                      ) : (
                        <button onClick={() => setSelectedOrder(order)} className={`${btn} bg-accent hover:bg-accent-light text-white`}>{t("act_play")}</button>
                      )
                    )}
                    {isPaid ? (
                      <button onClick={() => setSelectedOrder(order)} className={`${btn} border border-border-soft text-text-muted hover:bg-white/[0.03] hover:text-text-base`}>
                        {t("act_view")}
                      </button>
                    ) : (
                      <Link href={`/orders/${order.id}`} className={`${btn} border border-border-soft text-text-muted hover:bg-white/[0.03] hover:text-text-base`}>
                        {t("act_view")}
                      </Link>
                    )}
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {/* ── Order Detail Modal — portaled to body, see mounted state above ── */}
      {mounted && createPortal(
        <AnimatePresence>
          {selectedOrder && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 md:p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setSelectedOrder(null)}
              style={{ background: "var(--color-overlay)" }}
              className="absolute inset-0 backdrop-blur-sm"
            />

            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              className="relative bg-bg-card border border-accent/20 rounded-2xl md:rounded-[32px] w-full max-w-xl overflow-hidden shadow-2xl overflow-y-auto max-h-[95vh] custom-scrollbar"
            >
              {/* Modal Header */}
              <div className="relative h-24 md:h-40 flex items-end p-4 md:p-8">
                <Image
                  src={getImageUrl(selectedOrder.products.product_images[0]?.url || "/next.svg")}
                  alt="" fill className="object-cover opacity-30"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-bg-card via-bg-card/20 to-transparent" />
                <button
                  onClick={() => setSelectedOrder(null)}
                  className="absolute top-3 right-3 w-8 h-8 md:w-10 md:h-10 bg-black/30 hover:bg-black/50 text-white rounded-full flex items-center justify-center transition backdrop-blur-md z-20"
                >
                  <CloseIcon size={16} />
                </button>
                <div className="relative z-10">
                  <h2 className="text-[17px] md:text-2xl font-display font-bold text-text-base leading-tight truncate max-w-[240px] md:max-w-none">
                    {locale === "th" ? selectedOrder.products.name_th : selectedOrder.products.name_en}
                  </h2>
                  <p className="text-accent-light text-[11px] md:text-[14px] font-medium">
                    {locale === "th"
                      ? (selectedOrder.product_variants?.label_th || t("standard_version"))
                      : (selectedOrder.product_variants?.label_en || t("standard_version"))}
                  </p>
                </div>
              </div>

              {/* Modal Body */}
              <div className="p-4 md:p-6 space-y-4 md:space-y-5">

                {/* Whitelist Status */}
                <div className="bg-bg-base/60 border border-accent/10 rounded-xl md:rounded-2xl p-4 md:p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] text-text-muted uppercase tracking-widest font-bold">
                      {t("ingame_username")}
                    </p>
                    <div className="flex items-center gap-1.5">
                      <div className={`w-2 h-2 rounded-full ${
                        selectedOrder.whitelist_status === "whitelisted" ? "bg-green-400" :
                        selectedOrder.whitelist_status === "removed" ? "bg-red-400" :
                        "bg-orange-400 animate-pulse"
                      }`} />
                      <span className={`text-[11px] font-medium capitalize ${
                        selectedOrder.whitelist_status === "whitelisted" ? "text-green-400" :
                        selectedOrder.whitelist_status === "removed" ? "text-red-400" :
                        "text-orange-400"
                      }`}>
                        {selectedOrder.whitelist_status === "whitelisted" ? t("whitelisted") :
                          selectedOrder.whitelist_status === "removed" ? t("removed") :
                          t("pending")}
                      </span>
                    </div>
                  </div>

                  <p className="font-mono text-[16px] md:text-[20px] text-text-base font-bold">
                    {selectedOrder.whitelisted_username ?? "—"}
                  </p>

                  {selectedOrder.whitelist_status === "pending" && (
                    <div className="bg-orange-500/8 border border-orange-500/20 rounded-xl px-3 py-2.5">
                      <p className="text-[12px] text-orange-400">{t("pending_hint")}</p>
                    </div>
                  )}
                  {selectedOrder.whitelist_status === "whitelisted" && (
                    <div className="bg-green-500/8 border border-green-500/20 rounded-xl px-3 py-2.5">
                      <p className="text-[12px] text-green-400">{t("whitelisted_hint")}</p>
                    </div>
                  )}
                  {selectedOrder.whitelist_status === "removed" && (
                    <div className="bg-red-500/8 border border-red-500/20 rounded-xl px-3 py-2.5">
                      <p className="text-[12px] text-red-400">{t("removed_hint")}</p>
                    </div>
                  )}
                </div>

                {/* Try Demo — opens the in-game preview tab if product set info_page_url */}
                {selectedOrder.products?.info_page_url && (
                  <a
                    href={
                      selectedOrder.products.info_page_url.startsWith("http")
                        ? selectedOrder.products.info_page_url
                        : `https://${selectedOrder.products.info_page_url}`
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group w-full flex items-center justify-between gap-3 bg-emerald-500/5 hover:bg-emerald-500/10 border border-emerald-500/30 hover:border-emerald-500/50 text-text-base px-4 py-3.5 rounded-xl transition active:scale-[0.98]"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 bg-emerald-500/15 rounded-lg flex items-center justify-center flex-shrink-0">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400">
                          <line x1="6" y1="11" x2="10" y2="11" />
                          <line x1="8" y1="9" x2="8" y2="13" />
                          <line x1="15" y1="12" x2="15.01" y2="12" />
                          <line x1="18" y1="10" x2="18.01" y2="10" />
                          <path d="M17.32 5H6.68a4 4 0 0 0-3.978 3.59c-.006.052-.01.101-.017.152C2.604 9.416 2 14.456 2 16a3 3 0 0 0 3 3c1 0 1.5-.5 2-1l1.414-1.414A2 2 0 0 1 9.828 16h4.344a2 2 0 0 1 1.414.586L17 18c.5.5 1 1 2 1a3 3 0 0 0 3-3c0-1.545-.604-6.584-.685-7.258-.007-.05-.011-.1-.017-.151A4 4 0 0 0 17.32 5z" />
                        </svg>
                      </div>
                      <div className="text-left min-w-0">
                        <p className="text-[13px] font-semibold text-emerald-400 truncate">{t("join_game_btn")}</p>
                        <p className="text-[11px] text-text-muted truncate">{t("join_game_desc")}</p>
                      </div>
                    </div>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400 flex-shrink-0 group-hover:translate-x-0.5 transition-transform">
                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                      <polyline points="15 3 21 3 21 9" />
                      <line x1="10" y1="14" x2="21" y2="3" />
                    </svg>
                  </a>
                )}

                {/* Download installer — desktop_program products only */}
                {selectedOrder.products?.type === "desktop_program" && selectedOrder.products?.download_url && (
                  <a
                    href={selectedOrder.products.download_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group w-full flex items-center justify-between gap-3 bg-accent/8 hover:bg-accent/12 border border-accent/30 hover:border-accent/50 text-text-base px-4 py-3.5 rounded-xl transition active:scale-[0.98]"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 bg-accent/15 rounded-lg flex items-center justify-center flex-shrink-0">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-accent-light">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                          <polyline points="7 10 12 15 17 10" />
                          <line x1="12" y1="15" x2="12" y2="3" />
                        </svg>
                      </div>
                      <div className="text-left min-w-0">
                        <p className="text-[13px] font-semibold text-accent-light truncate">{locale === "th" ? "ดาวน์โหลดตัวติดตั้ง" : "Download installer"}</p>
                        <p className="text-[11px] text-text-muted truncate">{locale === "th" ? "ติดตั้งแล้วล็อกอินด้วยบัญชีนี้" : "Install, then sign in with this account"}</p>
                      </div>
                    </div>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-accent-light flex-shrink-0 group-hover:translate-y-0.5 transition-transform">
                      <line x1="12" y1="5" x2="12" y2="19" />
                      <polyline points="19 12 12 19 5 12" />
                    </svg>
                  </a>
                )}

                {/* LiveGen Button — แสดงเมื่อ paid + มี product_functions + feature เปิด */}
                {livegenEnabled && (selectedOrder.status === "paid" || selectedOrder.status === "Admin Buy") &&
                  (selectedOrder.products?.product_functions?.length ?? 0) > 0 && (
                  <Link
                    href={`/orders/${selectedOrder.id}/livegen`}
                    onClick={() => setSelectedOrder(null)}
                    className="group w-full flex items-center justify-between gap-3 bg-accent/5 hover:bg-accent/10 border border-accent/20 hover:border-accent/40 text-text-base px-4 py-3.5 rounded-xl transition active:scale-[0.98]"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 bg-accent/15 rounded-lg flex items-center justify-center flex-shrink-0">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-accent-light">
                          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                          <circle cx="8.5" cy="8.5" r="1.5" />
                          <polyline points="21 15 16 10 5 21" />
                        </svg>
                      </div>
                      <div className="text-left min-w-0">
                        <p className="text-[13px] font-semibold text-accent-light truncate">{tLive("open_livegen")}</p>
                        <p className="text-[11px] text-text-muted truncate">{tLive("open_livegen_sub")}</p>
                      </div>
                    </div>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-accent-light flex-shrink-0 group-hover:translate-x-0.5 transition-transform">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </Link>
                )}

                {/* Game Settings Button — แสดงเมื่อ product มี functions */}
                {/* {(selectedOrder.products?.product_functions?.length ?? 0) > 0 && (
                  <button
                    onClick={() => router.push(`/orders/${selectedOrder.id}/settings`)}
                    className="w-full flex items-center justify-between gap-3 bg-accent/8 hover:bg-accent/15 border border-accent/20 hover:border-accent/40 text-text-base px-4 py-3.5 rounded-xl transition group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-accent/15 rounded-lg flex items-center justify-center">
                        <SettingsIcon size={16} className="text-accent-light" />
                      </div>
                      <div className="text-left">
                        <p className="text-[13px] font-semibold text-text-base">{t("game_settings_title")}</p>
                        <p className="text-[11px] text-text-muted">{t("game_settings_subtitle")}</p>
                      </div>
                    </div>
                    <ChevronRightIcon size={16} className="text-text-muted group-hover:text-accent-light transition" />
                  </button>
                )} */}

                {/* Assets & Presets */}
                <div className="grid grid-cols-1 gap-4 md:gap-6">
                  {/* Image Assets */}
                  <div className="space-y-2 md:space-y-3">
                    <h4 className="text-[9px] md:text-[11px] font-bold text-text-muted uppercase tracking-widest flex items-center gap-2">
                      <ImageIcon size={12} /> {t("image_assets")}
                    </h4>
                    {/* flex-wrap + fixed-width cards so a typical 2-asset order
                        renders as two small thumbnails left-aligned, not two huge
                        stretched columns of a 4-col grid. Cards retain their shape
                        regardless of count. */}
                    <div className="flex flex-wrap gap-2">
                      {selectedOrder.products.product_gifts.map((g, idx: number) => {
                        const assetUrl = g.url.startsWith("http") ? g.url : g.url.startsWith("/") ? g.url : `/${g.url}`
                        const filename = g.filename || `Asset_${idx + 1}`
                        return (
                          <div key={g.id} className="group relative flex flex-col w-32 md:w-36 bg-accent/5 border border-accent/10 hover:border-accent/30 rounded-xl overflow-hidden transition-colors">
                            {/* Thumbnail = view action. aspect-[4/3] keeps cards low
                                so a 4-up grid stays dense; onError swaps in a file
                                icon instead of the browser's broken-image glyph. */}
                            <a href={assetUrl} target="_blank" rel="noopener noreferrer"
                              className="relative block aspect-[4/3] bg-white/5 overflow-hidden">
                              <img
                                src={assetUrl}
                                alt=""
                                loading="lazy"
                                onError={(e) => {
                                  const img = e.currentTarget;
                                  img.style.display = "none";
                                  const fallback = img.nextElementSibling as HTMLElement | null;
                                  if (fallback) fallback.style.display = "flex";
                                }}
                                className="absolute inset-0 w-full h-full object-contain p-2"
                              />
                              <div
                                style={{ display: "none" }}
                                className="absolute inset-0 flex-col items-center justify-center gap-1 text-text-muted"
                              >
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                  <polyline points="14 2 14 8 20 8" />
                                </svg>
                              </div>
                            </a>
                            {/* Filename + download merged into one footer row to halve
                                the card's vertical footprint vs. the previous stacked
                                layout. Download is icon-only since the row is tight. */}
                            <div className="flex items-center gap-1.5 px-2 py-1.5 border-t border-accent/10">
                              <span className="text-[10px] md:text-[11px] font-medium truncate flex-1" title={filename}>
                                {filename}
                              </span>
                              <a href={assetUrl} download={filename}
                                title={t("download")}
                                className="shrink-0 w-6 h-6 flex items-center justify-center bg-accent hover:bg-accent-light text-white rounded-md transition-colors">
                                <DownloadIcon size={11} />
                              </a>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                    {selectedOrder.products.product_gifts.length === 0 && (
                      <p className="text-[11px] text-text-muted italic px-1">{t("no_image_assets")}</p>
                    )}
                  </div>

                  {/* Config Presets */}
                  <div className="space-y-2 md:space-y-3">
                    <h4 className="text-[9px] md:text-[11px] font-bold text-text-muted uppercase tracking-widest flex items-center gap-2">
                      <PresetIcon size={12} /> {t("config_presets")}
                    </h4>
                    <div className="flex flex-wrap gap-1.5 md:gap-2">
                      {selectedOrder.products.product_presets.map((p, idx: number) => {
                        const assetUrl = p.url.startsWith("http") ? p.url : p.url.startsWith("/") ? p.url : `/${p.url}`
                        return (
                          <a key={p.id} href={assetUrl} download={p.filename || `Preset_${idx + 1}`}
                            className="flex items-center justify-center gap-2 bg-accent hover:bg-accent-light text-white px-3 py-2 rounded-lg md:rounded-xl transition-all">
                            <DownloadIcon size={14} />
                            <span className="text-[11px] md:text-[12px] font-bold truncate max-w-[160px]">
                              {p.filename || `Preset_${idx + 1}`}
                            </span>
                          </a>
                        )
                      })}
                    </div>
                    {selectedOrder.products.product_presets.length === 0 && (
                      <p className="text-[11px] text-text-muted italic px-1">{t("no_presets")}</p>
                    )}
                  </div>
                </div>

                {/* Footer */}
                <div className="flex flex-col sm:flex-row justify-between items-center pt-3 border-t border-accent/10 gap-2">
                  <p className="text-[10px] text-text-muted">
                    ID: <span className="font-mono">{selectedOrder.id.slice(0, 8)}...</span>
                  </p>
                  <Link href={`/orders/${selectedOrder.id}`}
                    className="text-[11px] md:text-[12px] font-bold text-accent-light hover:underline">
                    {t("view_full_details")}
                  </Link>
                </div>
              </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  )
}

// ── Icons ─────────────────────────────────────────────────────────

function CloseIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}


function ImageIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" />
    </svg>
  )
}

function PresetIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.1a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function DownloadIcon({ size = 20, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  )
}

// รูปย่อสินค้าในตาราง — ถ้ารูปพัง/ไม่มีไฟล์ ให้แสดงไอคอนกรอบตามดีไซน์แทน alt text
function OrderThumb({ src, alt }: { src: string; alt: string }) {
  const [broken, setBroken] = useState(!src)
  if (broken) {
    return (
      <div className="absolute inset-0 flex items-center justify-center text-border-light">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2"><rect x="3" y="3" width="18" height="18" rx="2" /></svg>
      </div>
    )
  }
  return <Image src={src} alt={alt} fill sizes="56px" className="object-cover" onError={() => setBroken(true)} />
}
