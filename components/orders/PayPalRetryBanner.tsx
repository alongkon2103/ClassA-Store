"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"

// Surfaced on the order detail page when PayPal redirects the user back with
// ?paypal=cancelled (user backed out), ?paypal=failed (capture failed —
// insufficient funds, declined card, etc.), or ?paypal=mismatch (defensive:
// the returned token doesn't match the one we stored).
//
// "Pay again" calls /api/checkout/paypal/retry which mints a fresh PayPal
// approval session against the same pending order and redirects the browser
// to it. No discount re-reservation or amount recomputation — we re-use the
// row exactly as it was.

type Props = {
  orderId: string
  status: string // cancelled | failed | mismatch | (anything else)
  locale: string
}

export default function PayPalRetryBanner({ orderId, status, locale }: Props) {
  const t = useTranslations("Orders")
  const [busy, setBusy] = useState(false)

  const isFailed = status === "failed"
  const isCancelled = status === "cancelled"
  const isMismatch = status === "mismatch"

  const handleRetry = async () => {
    setBusy(true)
    try {
      const res = await fetch("/api/checkout/paypal/retry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, locale }),
      })
      const data = await res.json()
      if (res.ok && data.url) {
        window.location.href = data.url
        return
      }
      alert(data?.error || "Failed to start PayPal session")
    } catch {
      alert("Failed to start PayPal session")
    } finally {
      setBusy(false)
    }
  }

  // Colour scheme: yellow for cancelled (recoverable, user choice),
  // red for failed/mismatch (something actually went wrong)
  const tone = isCancelled
    ? "bg-yellow-500/10 border-yellow-500/30 text-yellow-200"
    : "bg-red-500/10 border-red-500/30 text-red-200"

  const title = isCancelled
    ? t("paypal_cancelled_title")
    : isFailed
      ? t("paypal_failed_title")
      : isMismatch
        ? t("paypal_mismatch_title")
        : t("paypal_failed_title")

  const desc = isCancelled
    ? t("paypal_cancelled_desc")
    : isFailed
      ? t("paypal_failed_desc")
      : isMismatch
        ? t("paypal_mismatch_desc")
        : t("paypal_failed_desc")

  return (
    <div className={`mb-6 border rounded-2xl p-5 ${tone}`}>
      <div className="flex items-start gap-3">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-bold">{title}</p>
          <p className="text-[12.5px] mt-1 opacity-90 leading-relaxed">{desc}</p>
          <div className="flex flex-wrap gap-2 mt-3">
            <button
              onClick={handleRetry}
              disabled={busy}
              className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/20 text-[12px] font-semibold transition disabled:opacity-50 flex items-center gap-2"
            >
              {busy && <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
              {t("paypal_try_again")}
            </button>
            <a
              href={`/${locale}/products`}
              className="px-4 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-[12px] font-medium transition"
            >
              {t("paypal_back_to_products")}
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
