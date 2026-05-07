"use client"

import { useState, useRef } from "react"
import { Link, useRouter } from "@/i18n/routing"
import Navbar from "@/components/Navbar"
import { motion, AnimatePresence } from "framer-motion"
import { useTranslations, useLocale } from "next-intl"
import { getImageUrl } from "@/lib/getImageUrl"

export default function CheckoutClient({ order, bankAccount }: any) {
  const router = useRouter()
  const t = useTranslations("Checkout")
  const locale = useLocale()
  const [file, setFile]           = useState<File | null>(null)
  const [preview, setPreview]     = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const [copied, setCopied]       = useState<string | null>(null)
  const [isQRExpanded, setIsQRExpanded] = useState(false)
  const [isSlipExpanded, setIsSlipExpanded] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = (f: File) => {
    setFile(f)
    setPreview(URL.createObjectURL(f))
    setError(null)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const f = e.dataTransfer.files[0]
    if (f && f.type.startsWith("image/")) handleFileSelect(f)
  }

  const handleCopy = (value: string, label: string) => {
    navigator.clipboard.writeText(value)
    setCopied(label)
    setTimeout(() => setCopied(null), 2000)
  }

  const handleSubmit = async () => {
    if (!file) return
    setUploading(true)
    setError(null)

    const fd = new FormData()
    fd.append("slip", file)

    const res  = await fetch(`/api/orders/${order.id}/upload-slip`, { method: "POST", body: fd })
    const data = await res.json()
    setUploading(false)

    if (!res.ok) { setError(data.error); return }
    router.push(`/orders/${order.id}`)
  }

  const bankRows = bankAccount ? [
    { label: t("bank"),           value: bankAccount.bank_name },
    { label: t("account_name"),   value: bankAccount.account_name },
    { label: t("account_number"), value: bankAccount.account_number },
    ...(bankAccount.promptpay_no
      ? [{ label: t("promptpay"), value: bankAccount.promptpay_no }]
      : []),
  ] : []

  const productName = locale === "th" ? order.products?.name_th : order.products?.name_en
  const variantLabel = locale === "th" ? order.product_variants?.label_th : order.product_variants?.label_en

  return (
    <div className="min-h-screen bg-bg-base">
      <Navbar />

      <div className="max-w-4xl mx-auto px-4 py-10">

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-[12px] text-text-muted mb-8">
          <Link href="/products" className="hover:text-text-base transition">{t("shop")}</Link>
          <span>/</span>
          <span className="text-text-base">{t("checkout")}</span>
        </div>

        {/* Page Title */}
        <div className="mb-8">
          <p className="text-[11px] tracking-widest text-accent-light uppercase font-medium mb-1">
            {t("step", { current: 2, total: 2 })}
          </p>
          <h1 className="text-[28px] font-bold">{t("complete_payment")}</h1>
          <p className="text-text-muted text-[13px] mt-1">
            {t("payment_desc")}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

          {/* LEFT — Payment Info */}
          <div className="lg:col-span-3 space-y-4">

            {/* QR + Bank Info */}
            {bankAccount && (
              <div className="bg-bg-card border border-accent/10 rounded-2xl overflow-hidden">
                <div className="px-5 py-4 border-b border-white/5">
                  <p className="text-[13px] font-semibold">{t("payment_details")}</p>
                </div>

                <div className="p-5 flex flex-col sm:flex-row gap-6 items-center sm:items-start">
                  {/* QR Code */}
                  {bankAccount.qr_code_url && (
                    <>
                      <div className="flex-shrink-0">
                        <div
                          className="bg-white rounded-2xl p-3 shadow-lg cursor-pointer hover:scale-[1.02] active:scale-[0.98] transition group relative"
                          onClick={() => setIsQRExpanded(true)}
                        >
                          <img
                            src={getImageUrl(bankAccount.qr_code_url)}
                            alt="PromptPay QR"
                            className="w-40 h-40 object-contain"
                          />
                          <div className="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 transition rounded-2xl flex items-center justify-center">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" className="drop-shadow-md">
                              <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
                            </svg>
                          </div>
                        </div>
                        <p className="text-[11px] text-text-muted text-center mt-2 flex items-center justify-center gap-1">
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
                          </svg>
                          {t("click_expand")}
                        </p>
                      </div>

                      <AnimatePresence>
                        {isQRExpanded && (
                          <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 sm:p-8"
                            onClick={() => setIsQRExpanded(false)}
                          >
                            <motion.div
                              initial={{ opacity: 0, scale: 0.9, y: 20 }}
                              animate={{ opacity: 1, scale: 1, y: 0 }}
                              exit={{ opacity: 0, scale: 0.9, y: 20 }}
                              className="relative max-w-full max-h-full bg-white p-6 sm:p-8 rounded-[32px] shadow-2xl"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <img
                                src={getImageUrl(bankAccount.qr_code_url)}
                                alt="PromptPay QR Expanded"
                                className="max-w-[85vw] max-h-[70vh] w-auto h-auto object-contain rounded-xl"
                              />
                              <button
                                className="absolute -top-3 -right-3 w-10 h-10 bg-accent text-white rounded-full flex items-center justify-center shadow-lg hover:scale-110 active:scale-95 transition-transform"
                                onClick={() => setIsQRExpanded(false)}
                              >
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                                  <path d="M18 6L6 18M6 6l12 12" />
                                </svg>
                              </button>
                              <div className="mt-6 text-center">
                                <p className="text-black font-bold text-lg">{t("qr_code_title")}</p>
                                <p className="text-gray-500 text-sm mt-1">{t("qr_code_desc")}</p>
                              </div>
                            </motion.div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </>
                  )}

                  {/* Bank Details */}
                  <div className="flex-1 w-full space-y-2">
                    {bankRows.map(({ label, value }) => (
                      <div key={label}
                        className="flex items-center justify-between py-2.5 px-3 rounded-xl bg-bg-base group">
                        <div>
                          <p className="text-[10px] text-text-muted uppercase tracking-wide">{label}</p>
                          <p className="text-[14px] font-medium mt-0.5">{value}</p>
                        </div>
                        <button
                          onClick={() => handleCopy(value, label)}
                          className="flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-lg border border-accent/20 text-accent-light hover:bg-accent/10 transition opacity-0 group-hover:opacity-100"
                        >
                          {copied === label ? (
                            <>
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                              {t("copied")}
                            </>
                          ) : (
                            <>
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                                <rect x="9" y="9" width="13" height="13" rx="2" />
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                              </svg>
                              {t("copy")}
                            </>
                          )}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Upload Slip */}
            <div className="bg-bg-card border border-accent/10 rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-white/5">
                <p className="text-[13px] font-semibold">{t("upload_slip")}</p>
                <p className="text-[11px] text-text-muted mt-0.5">{t("upload_hint")}</p>
              </div>

              <div className="p-5 space-y-4">
                {!preview ? (
                  <div
                    onClick={() => inputRef.current?.click()}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={handleDrop}
                    className="border-2 border-dashed border-accent/20 hover:border-accent/40 hover:bg-white/[0.02] rounded-xl p-10 text-center cursor-pointer transition group"
                  >
                    <div className="w-10 h-10 mx-auto mb-3 rounded-xl bg-accent/10 flex items-center justify-center group-hover:bg-accent/15 transition">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="text-accent-light">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="17 8 12 3 7 8" />
                        <line x1="12" y1="3" x2="12" y2="15" />
                      </svg>
                    </div>
                    <p className="text-[13px] text-text-muted">
                      {t.rich("drag_drop", {
                        browse: (chunks) => <span className="text-accent-light underline underline-offset-2">{t("browse_files")}</span>
                      })}
                    </p>
                    <input
                      ref={inputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f) }}
                    />
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div
                      className="relative rounded-xl overflow-hidden bg-bg-base cursor-pointer hover:opacity-95 transition group"
                      onClick={() => setIsSlipExpanded(true)}
                    >
                      <img src={getImageUrl(preview)} className="w-full object-contain max-h-72" />
                      <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                        <div className="bg-white/20 backdrop-blur-md rounded-full p-2">
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
                            <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
                          </svg>
                        </div>
                      </div>
                    </div>

                    <AnimatePresence>
                      {isSlipExpanded && (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 sm:p-8"
                          onClick={() => setIsSlipExpanded(false)}
                        >
                          <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            className="relative max-w-full max-h-full"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <img
                              src={getImageUrl(preview)}
                              alt="Payment Slip Preview"
                              className="max-w-[90vw] max-h-[85vh] w-auto h-auto object-contain rounded-2xl shadow-2xl border border-white/10"
                            />
                            <button
                              className="absolute -top-3 -right-3 w-10 h-10 bg-accent text-white rounded-full flex items-center justify-center shadow-lg hover:scale-110 active:scale-95 transition-transform"
                              onClick={() => setIsSlipExpanded(false)}
                            >
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                                <path d="M18 6L6 18M6 6l12 12" />
                              </svg>
                            </button>
                          </motion.div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <button
                      onClick={() => { setFile(null); setPreview(null) }}
                      className="flex items-center gap-1.5 text-[12px] text-text-muted hover:text-text-base transition"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <path d="M3 12a9 9 0 1 0 18 0 9 9 0 0 0-18 0" />
                        <path d="m15 9-6 6M9 9l6 6" />
                      </svg>
                      {t("remove_choose")}
                    </button>
                  </div>
                )}

                {error && (
                  <div className="flex items-start gap-2.5 bg-red-500/8 border border-red-500/20 rounded-xl px-4 py-3">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-red-400 mt-0.5 flex-shrink-0">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    <p className="text-[13px] text-red-400">{error}</p>
                  </div>
                )}

                <button
                  onClick={handleSubmit}
                  disabled={!file || uploading}
                  className="w-full py-3.5 rounded-xl bg-accent text-white font-semibold text-[14px] hover:opacity-90 active:scale-95 transition disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {uploading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      {t("verifying")}
                    </>
                  ) : (
                    <>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      {t("confirm_payment")}
                    </>
                  )}
                </button>

                <p className="text-center text-[11px] text-text-muted">
                  {t("auto_verify_hint")}
                </p>
              </div>
            </div>
          </div>

          {/* RIGHT — Order Summary */}
          <div className="lg:col-span-2">
            <div className="bg-bg-card border border-accent/10 rounded-2xl overflow-hidden sticky top-24">
              <div className="px-5 py-4 border-b border-white/5">
                <p className="text-[13px] font-semibold">{t("order_summary")}</p>
              </div>

              <div className="p-5 space-y-4">
                {/* Product Image */}
                {order.products?.product_images?.[0]?.url && (
                  <div className="aspect-video rounded-xl overflow-hidden bg-bg-base">
                    <img
                      src={getImageUrl(order.products.product_images[0].url)}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}

                {/* Product Info */}
                <div className="space-y-1">
                  <p className="font-semibold text-[15px]">{productName}</p>
                  <p className="text-[12px] text-text-muted">{variantLabel}</p>
                </div>

                <div className="h-px bg-white/5" />

                {/* Price breakdown */}
                <div className="space-y-2 text-[13px]">
                  <div className="flex justify-between text-text-muted">
                    <span>{t("subtotal")}</span>
                    <span>฿{Number(order.amount).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-text-muted">
                    <span>{t("payment_method")}</span>
                    <span>{t("promptpay")}</span>
                  </div>
                </div>

                <div className="h-px bg-white/5" />

                {/* Total */}
                <div className="flex items-center justify-between">
                  <span className="text-[13px] font-semibold">{t("total")}</span>
                  <span className="text-[22px] font-bold text-accent-light">
                    ฿{Number(order.amount).toLocaleString()}
                  </span>
                </div>

                {/* Order ID */}
                <div className="bg-bg-base rounded-xl px-3 py-2.5">
                  <p className="text-[10px] text-text-muted uppercase tracking-wide mb-0.5">{t("order_id")}</p>
                  <p className="font-mono text-[11px] text-text-muted break-all">{order.id}</p>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}