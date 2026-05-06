"use client"

import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import Navbar from "@/components/Navbar"
import Link from "next/link"

export default function CheckoutClient({ order, bankAccount }: any) {
  const router = useRouter()
  const [file, setFile]           = useState<File | null>(null)
  const [preview, setPreview]     = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const [copied, setCopied]       = useState<string | null>(null)
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
    { label: "Bank",           value: bankAccount.bank_name },
    { label: "Account Name",   value: bankAccount.account_name },
    { label: "Account Number", value: bankAccount.account_number },
    ...(bankAccount.promptpay_no
      ? [{ label: "PromptPay", value: bankAccount.promptpay_no }]
      : []),
  ] : []

  return (
    <div className="min-h-screen bg-bg-base">
      <Navbar />

      <div className="max-w-4xl mx-auto px-4 py-10">

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-[12px] text-text-muted mb-8">
          <Link href="/products" className="hover:text-text-base transition">Shop</Link>
          <span>/</span>
          <span className="text-text-base">Checkout</span>
        </div>

        {/* Page Title */}
        <div className="mb-8">
          <p className="text-[11px] tracking-widest text-accent-light uppercase font-medium mb-1">
            Step 2 of 2
          </p>
          <h1 className="text-[28px] font-bold">Complete Payment</h1>
          <p className="text-text-muted text-[13px] mt-1">
            Transfer the exact amount and upload your slip to confirm your order.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

          {/* LEFT — Payment Info */}
          <div className="lg:col-span-3 space-y-4">

            {/* QR + Bank Info */}
            {bankAccount && (
              <div className="bg-bg-card border border-accent/10 rounded-2xl overflow-hidden">
                <div className="px-5 py-4 border-b border-white/5">
                  <p className="text-[13px] font-semibold">Payment Details</p>
                </div>

                <div className="p-5 flex flex-col sm:flex-row gap-6 items-center sm:items-start">
                  {/* QR Code */}
                  {bankAccount.qr_code_url && (
                    <div className="flex-shrink-0">
                      <div className="bg-white rounded-2xl p-3 shadow-lg">
                        <img
                          src={bankAccount.qr_code_url}
                          alt="PromptPay QR"
                          className="w-40 h-40 object-contain"
                        />
                      </div>
                      <p className="text-[11px] text-text-muted text-center mt-2">Scan to pay</p>
                    </div>
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
                              Copied
                            </>
                          ) : (
                            <>
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                                <rect x="9" y="9" width="13" height="13" rx="2" />
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                              </svg>
                              Copy
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
                <p className="text-[13px] font-semibold">Upload Payment Slip</p>
                <p className="text-[11px] text-text-muted mt-0.5">JPG or PNG, max 5MB</p>
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
                      Drag & drop your slip, or{" "}
                      <span className="text-accent-light underline underline-offset-2">browse files</span>
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
                    <div className="relative rounded-xl overflow-hidden bg-bg-base">
                      <img src={preview} className="w-full object-contain max-h-72" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                    </div>
                    <button
                      onClick={() => { setFile(null); setPreview(null) }}
                      className="flex items-center gap-1.5 text-[12px] text-text-muted hover:text-text-base transition"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <path d="M3 12a9 9 0 1 0 18 0 9 9 0 0 0-18 0" />
                        <path d="m15 9-6 6M9 9l6 6" />
                      </svg>
                      Remove and choose another
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
                      Verifying slip...
                    </>
                  ) : (
                    <>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      Confirm Payment
                    </>
                  )}
                </button>

                <p className="text-center text-[11px] text-text-muted">
                  Your slip will be verified automatically. If there is an issue, please contact support.
                </p>
              </div>
            </div>
          </div>

          {/* RIGHT — Order Summary */}
          <div className="lg:col-span-2">
            <div className="bg-bg-card border border-accent/10 rounded-2xl overflow-hidden sticky top-24">
              <div className="px-5 py-4 border-b border-white/5">
                <p className="text-[13px] font-semibold">Order Summary</p>
              </div>

              <div className="p-5 space-y-4">
                {/* Product Image */}
                {order.products?.product_images?.[0]?.url && (
                  <div className="aspect-video rounded-xl overflow-hidden bg-bg-base">
                    <img
                      src={order.products.product_images[0].url}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}

                {/* Product Info */}
                <div className="space-y-1">
                  <p className="font-semibold text-[15px]">{order.products?.name_en}</p>
                  <p className="text-[12px] text-text-muted">{order.product_variants?.label_en}</p>
                </div>

                <div className="h-px bg-white/5" />

                {/* Price breakdown */}
                <div className="space-y-2 text-[13px]">
                  <div className="flex justify-between text-text-muted">
                    <span>Subtotal</span>
                    <span>฿{Number(order.amount).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-text-muted">
                    <span>Payment method</span>
                    <span>PromptPay</span>
                  </div>
                </div>

                <div className="h-px bg-white/5" />

                {/* Total */}
                <div className="flex items-center justify-between">
                  <span className="text-[13px] font-semibold">Total</span>
                  <span className="text-[22px] font-bold text-accent-light">
                    ฿{Number(order.amount).toLocaleString()}
                  </span>
                </div>

                {/* Order ID */}
                <div className="bg-bg-base rounded-xl px-3 py-2.5">
                  <p className="text-[10px] text-text-muted uppercase tracking-wide mb-0.5">Order ID</p>
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