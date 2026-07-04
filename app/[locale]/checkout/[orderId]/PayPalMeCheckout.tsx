"use client"

// Pay page for the paypal_me flow. There is NO slip upload and NO PayPal API
// redirect — the customer pays the exact amount by hand, then this page polls
// the order status until the Gmail worker confirms the matching email and flips
// it to "paid", at which point we bounce to the order page.

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "@/i18n/routing"
import Navbar from "@/components/Navbar"
import { useTranslations, useLocale } from "next-intl"

type PayPalMeOrder = {
  id: string
  expected_amount: number
  expected_currency: string
  amount: number
  expires_at: string | null
  whitelisted_username: string | null
  products: { name_th: string; name_en: string } | null
  product_variants: { label_th: string; label_en: string } | null
}

function fmtTime(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${s.toString().padStart(2, "0")}`
}

export default function PayPalMeCheckout({
  order,
  payUrl,
  paypalMeLink,
}: {
  order: PayPalMeOrder
  payUrl: string
  paypalMeLink: string
}) {
  const router = useRouter()
  const t = useTranslations("PayPalMe")
  const locale = useLocale()

  const amountStr = order.expected_amount.toFixed(2)
  // Symbol matches the frozen currency so THB test orders read "฿594.75", not "$".
  const CURRENCY_SYMBOLS: Record<string, string> = { USD: "$", THB: "฿" }
  const symbol = CURRENCY_SYMBOLS[order.expected_currency] ?? ""
  const expiresMs = order.expires_at ? new Date(order.expires_at).getTime() : 0

  const [copied, setCopied] = useState(false)
  const [now, setNow] = useState<number>(() => Date.now())
  const [status, setStatus] = useState<"awaiting" | "paid">("awaiting")
  const paidHandled = useRef(false)

  const remaining = expiresMs ? expiresMs - now : 0
  const isExpired = expiresMs > 0 && remaining <= 0 && status !== "paid"

  // 1-second ticker for the countdown.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  // Poll the order status until paid. Stops once paid or expired.
  useEffect(() => {
    if (status === "paid" || isExpired) return
    let cancelled = false
    const poll = async () => {
      try {
        const res = await fetch(`/api/orders/${order.id}/status`, { cache: "no-store" })
        if (!res.ok) return
        const data = await res.json()
        if (!cancelled && data.status === "paid") setStatus("paid")
      } catch {
        /* transient — try again next tick */
      }
    }
    poll()
    const id = setInterval(poll, 5000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [order.id, status, isExpired])

  // Once confirmed, give the user a beat to see the success state then redirect.
  useEffect(() => {
    if (status !== "paid" || paidHandled.current) return
    paidHandled.current = true
    const id = setTimeout(() => router.push(`/orders/${order.id}`), 1500)
    return () => clearTimeout(id)
  }, [status, order.id, router])

  const copyAmount = () => {
    navigator.clipboard.writeText(amountStr)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const productName = locale === "th" ? order.products?.name_th : order.products?.name_en
  const variantLabel = locale === "th" ? order.product_variants?.label_th : order.product_variants?.label_en

  const countdown = useMemo(() => fmtTime(remaining), [remaining])

  return (
    <div className="min-h-screen bg-bg-base">
      <Navbar />

      <div className="max-w-3xl mx-auto px-4 py-10">
        {/* Title */}
        <div className="mb-8">
          <p className="text-[11px] tracking-widest text-accent-light uppercase font-medium mb-1">
            {t("step")}
          </p>
          <h1 className="text-[28px] font-bold">{t("title")}</h1>
          <p className="text-text-muted text-[13px] mt-1">{t("subtitle")}</p>
        </div>

        {/* PAID state */}
        {status === "paid" ? (
          <div className="bg-green-500/8 border border-green-500/25 rounded-2xl p-8 text-center">
            <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-green-500/15 flex items-center justify-center">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <p className="text-[18px] font-bold text-green-400">{t("paid_title")}</p>
            <p className="text-[13px] text-text-muted mt-1">{t("paid_desc")}</p>
          </div>
        ) : isExpired ? (
          /* EXPIRED state */
          <div className="bg-red-500/8 border border-red-500/25 rounded-2xl p-8 text-center">
            <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-red-500/15 flex items-center justify-center">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 6v6l4 2" />
              </svg>
            </div>
            <p className="text-[18px] font-bold text-red-400">{t("expired_title")}</p>
            <p className="text-[13px] text-text-muted mt-1 mb-5">{t("expired_desc")}</p>
            <button
              onClick={() => router.push("/products")}
              className="px-5 py-3 rounded-xl bg-accent text-white font-semibold text-[14px] hover:opacity-90 active:scale-95 transition"
            >
              {t("back_to_shop")}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            {/* LEFT — amount + pay */}
            <div className="lg:col-span-3 space-y-4">
              {/* EXACT AMOUNT — the whole flow hinges on paying this to the cent */}
              <div className="bg-bg-card border border-accent/20 rounded-2xl overflow-hidden">
                <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
                  <p className="text-[13px] font-semibold">{t("amount_to_pay")}</p>
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-mono px-2 py-1 rounded-md bg-accent/10 text-accent-light">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="9" />
                      <polyline points="12 7 12 12 15 14" />
                    </svg>
                    {countdown}
                  </span>
                </div>

                <div className="p-5">
                  <div className="flex items-end justify-center gap-2 py-2">
                    <span className="text-[22px] font-bold text-text-muted mb-1">{symbol}</span>
                    <span className="text-[48px] leading-none font-extrabold text-accent-light tracking-tight">
                      {amountStr}
                    </span>
                    <span className="text-[16px] font-semibold text-text-muted mb-1.5">
                      {order.expected_currency}
                    </span>
                  </div>

                  <button
                    onClick={copyAmount}
                    className="mx-auto mt-2 flex items-center gap-2 text-[12px] px-3 py-1.5 rounded-lg border border-accent/20 text-accent-light hover:bg-accent/10 transition"
                  >
                    {copied ? (
                      <>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>
                        {t("copied")}
                      </>
                    ) : (
                      <>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
                        {t("copy_amount")}
                      </>
                    )}
                  </button>

                  {/* The critical warning */}
                  <div className="mt-5 flex items-start gap-2.5 bg-yellow-500/8 border border-yellow-500/25 rounded-xl px-4 py-3">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#eab308" strokeWidth="2" strokeLinecap="round" className="mt-0.5 flex-shrink-0">
                      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                      <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                    </svg>
                    <p className="text-[12.5px] text-yellow-200/90 leading-relaxed">{t("pay_exact_warning")}</p>
                  </div>
                </div>
              </div>

              {/* PAY BUTTON */}
              <div className="bg-bg-card border border-accent/10 rounded-2xl p-5 space-y-3">
                <p className="text-[13px] font-semibold">{t("how_to_pay")}</p>
                <ol className="text-[13px] text-text-muted space-y-1.5 list-decimal list-inside">
                  <li>{t("step_1")}</li>
                  <li>{t("step_2")}</li>
                  <li>{t("step_3")}</li>
                </ol>

                {payUrl ? (
                  <a
                    href={payUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-3.5 rounded-xl bg-[#0070ba] text-white font-semibold text-[14px] hover:opacity-90 active:scale-95 transition flex items-center justify-center gap-2"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M7.4 21.6H4.2l.5-3.2h2.9c3.6 0 6.1-1.8 6.7-5.3.3-1.6 0-2.8-.8-3.6-.9-.9-2.4-1.3-4.4-1.3H5.5L3 21.6" /></svg>
                    {t("pay_button")}
                  </a>
                ) : (
                  <div className="text-[12.5px] text-red-400 bg-red-500/8 border border-red-500/20 rounded-xl px-4 py-3">
                    {t("link_missing")}
                  </div>
                )}

                {paypalMeLink && (
                  <p className="text-center text-[11px] text-text-muted break-all">
                    {t("or_open")}: <span className="text-accent-light">{paypalMeLink}</span>
                  </p>
                )}
              </div>

              {/* WAITING indicator */}
              <div className="flex items-center gap-3 bg-bg-card border border-accent/10 rounded-2xl px-5 py-4">
                <div className="w-4 h-4 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
                <div>
                  <p className="text-[13px] font-medium">{t("waiting_title")}</p>
                  <p className="text-[11px] text-text-muted">{t("waiting_desc")}</p>
                </div>
              </div>
            </div>

            {/* RIGHT — summary */}
            <div className="lg:col-span-2">
              <div className="bg-bg-card border border-accent/10 rounded-2xl overflow-hidden sticky top-24">
                <div className="px-5 py-4 border-b border-white/5">
                  <p className="text-[13px] font-semibold">{t("order_summary")}</p>
                </div>
                <div className="p-5 space-y-4">
                  <div className="space-y-1">
                    <p className="font-semibold text-[15px]">{productName}</p>
                    <p className="text-[12px] text-text-muted">{variantLabel}</p>
                  </div>
                  {order.whitelisted_username && (
                    <>
                      <div className="h-px bg-white/5" />
                      <div className="flex justify-between text-[13px]">
                        <span className="text-text-muted">{t("ign")}</span>
                        <span className="font-medium">{order.whitelisted_username}</span>
                      </div>
                    </>
                  )}
                  <div className="h-px bg-white/5" />
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] font-semibold">{t("total")}</span>
                    <span className="text-[22px] font-bold text-accent-light">
                      {symbol}{amountStr}
                    </span>
                  </div>
                  <div className="bg-bg-base rounded-xl px-3 py-2.5">
                    <p className="text-[10px] text-text-muted uppercase tracking-wide mb-0.5">{t("order_id")}</p>
                    <p className="font-mono text-[11px] text-text-muted break-all">{order.id}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
