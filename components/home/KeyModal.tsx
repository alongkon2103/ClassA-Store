"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"

import { useTranslations, useLocale } from "next-intl"

interface Key {
  label: string
  value: string
}

interface Order {
  orderId: string
  date: string
  product: {
    name: string
    image: string
    platform: string
    price: string
  }
  keys: Key[]
}

interface KeyModalProps {
  order: Order | null
  isOpen: boolean
  onClose: () => void
}

export default function KeyModal({ order, isOpen, onClose }: KeyModalProps) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const t = useTranslations("Orders")
  const locale = useLocale()

  
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = ""
    }
    return () => {
      document.body.style.overflow = ""
    }
  }, [isOpen])

  const fmtDate = (iso: string) => {
    return new Date(iso).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedKey(text)
      setTimeout(() => setCopiedKey(null), 2000)
    })
  }

  return (
    <AnimatePresence>
      {isOpen && order && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="overlay fixed inset-0 z-50 flex items-center justify-center px-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="popup-card rounded-3xl w-full max-w-[480px] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Image header */}
            <div
              className="relative h-[130px] flex items-end px-6 pb-4"
              style={{ background: "linear-gradient(135deg,#0d1e35,#1a3a6a)" }}
            >
              <img
                src={order.product.image}
                alt={order.product.name}
                className="absolute inset-0 w-full h-full object-cover opacity-60"
              />
              <div
                className="absolute inset-0"
                style={{
                  background:
                    "linear-gradient(to top,rgba(13,30,46,.95) 0%,transparent 60%)",
                }}
              ></div>
              <button
                onClick={onClose}
                className="btn-close absolute top-3 right-3 p-1.5 flex items-center justify-center"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
              <div className="relative z-10">
                <p className="font-display font-bold text-[22px] text-white leading-tight">
                  {order.product.name}
                </p>
                <p className="text-[12px] text-text-muted">{order.product.platform}</p>
              </div>
            </div>

            {/* Body */}
            <div className="p-6">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <p className="text-[11px] uppercase tracking-widest mb-0.5 text-text-muted">
                    {t("order_id")}
                  </p>
                  <p className="text-[13px] font-medium text-accent-light">
                    {order.orderId}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] uppercase tracking-widest mb-0.5 text-text-muted">
                    Date
                  </p>
                  <p className="text-[13px]">{fmtDate(order.date)}</p>
                </div>
              </div>

              <hr className="soft-divider mb-5" />

              <div className="key-warning rounded-xl px-4 py-3 mb-5 flex items-start gap-2.5">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  className="mt-0.5 shrink-0"
                >
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
                <p className="text-[12px] leading-relaxed">
                  {t("key_safe_warning")}
                </p>
              </div>

              <div className="flex flex-col gap-3 mb-6">
                {order.keys.map((k, idx) => (
                  <div key={idx}>
                    <p className="text-[11px] uppercase tracking-widest mb-1.5 text-text-muted">
                      {k.label}
                    </p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={k.value}
                        readOnly
                        className="key-field flex-1 rounded-xl px-4 py-2.5 text-[13px] outline-none"
                      />
                      <button
                        onClick={() => copyToClipboard(k.value)}
                        className={`btn-copy text-[12px] font-medium px-3 py-2 rounded-xl flex items-center gap-1.5 ${
                          copiedKey === k.value ? "copied" : ""
                        }`}
                      >
                        {copiedKey === k.value ? (
                          <>
                            <svg
                              width="13"
                              height="13"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2.5"
                              strokeLinecap="round"
                            >
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                            {t("copied")}
                          </>
                        ) : (
                          <>
                            <svg
                              width="13"
                              height="13"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                            >
                              <rect x="9" y="9" width="13" height="13" rx="2" />
                              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                            </svg>
                            {t("copy")}
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <button
                onClick={onClose}
                className="w-full py-3 rounded-xl text-[14px] font-medium bg-[rgba(66,122,181,.12)] border border-[var(--color-border-soft)] text-text-muted transition-colors hover:bg-[rgba(66,122,181,.18)]"
              >
                {t("close")}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
