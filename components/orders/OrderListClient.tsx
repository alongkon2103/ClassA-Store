// app/orders/page.tsx — No need to edit, already good

// components/orders/OrderListClient.tsx
"use client"

import { useState } from "react"
import { format } from "date-fns"
import Image from "next/image"
import Link from "next/link"
import { motion, AnimatePresence } from "framer-motion"
import CopyButton from "./CopyButton"

interface OrderListClientProps {
  orders: any[]
}

export default function OrderListClient({ orders }: OrderListClientProps) {
  const [selectedOrder, setSelectedOrder] = useState<any>(null)
  const [payingId, setPayingId] = useState<string | null>(null)

  const handlePay = async (e: React.MouseEvent, order: any) => {
    e.stopPropagation()
    setPayingId(order.id)

    try {
      if (order.payment_method === "promptpay" || !order.payment_method) {
        // PromptPay → Go to existing checkout page, no need to create new session
        window.location.href = `/checkout/${order.id}`
      } else {
        // Stripe → Create new session
        const res = await fetch("/api/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            productId: order.product_id,
            variantId: order.variant_id,
          }),
        })
        if (!res.ok) throw new Error("Checkout failed")
        const data = await res.json()
        if (data.url) window.location.href = data.url
      }
    } catch (err) {
      console.error(err)
      alert("Failed to resume payment")
    } finally {
      setPayingId(null)
    }
  }

  return (
    <>
      <div className="space-y-2">
        {orders.map((order) => {
          const imageUrl = order.products.product_images[0]?.url || "/next.svg"
          const isPaid    = order.status === "paid"
          const isPending = order.status === "pending"
          const isPaying  = payingId === order.id

          return (
            <div
              key={order.id}
              onClick={() => isPaid && setSelectedOrder(order)}
              className={`group bg-bg-card border border-white/5 rounded-xl p-2.5 md:p-4 transition-all duration-300 flex items-center gap-3 md:gap-4 ${
                isPaid ? "cursor-pointer hover:border-accent/30 hover:shadow-xl hover:shadow-accent/5" : "cursor-default"
              } ${!isPaid && !isPending ? "opacity-70" : ""}`}
            >
              <div className="w-10 h-10 md:w-16 md:h-16 relative rounded-lg overflow-hidden shrink-0 shadow-lg">
                <Image src={imageUrl} alt={order.products.name_en} fill className="object-cover" />
              </div>

              <div className="flex-1 min-w-0">
                <h3 className="text-[13px] md:text-[15px] font-bold text-white group-hover:text-accent-light transition-colors truncate mb-0.5">
                  {order.products.name_en}
                </h3>
                <div className="flex items-center gap-2 md:gap-3 text-[10px] md:text-[12px] text-text-muted">
                  <span className="font-medium text-white/60 truncate max-w-[70px] sm:max-w-none">
                    {order.product_variants?.label_en || "Standard"}
                  </span>
                  <span>•</span>
                  <span>{order.created_at ? format(new Date(order.created_at), "dd MMM yy") : "—"}</span>
                  {order.payment_method && (
                    <>
                      <span>•</span>
                      <span className="capitalize">{order.payment_method === "promptpay" ? "PromptPay" : "Card"}</span>
                    </>
                  )}
                </div>
              </div>

              <div className="flex flex-col items-end shrink-0 ml-auto gap-2">
                <div className="text-right">
                  <p className="text-[13px] md:text-[15px] font-bold text-white mb-0.5">
                    ฿{Number(order.amount).toLocaleString()}
                  </p>
                  <span className={`text-[7px] md:text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${
                    isPaid
                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                      : order.status === "expired"
                      ? "bg-red-500/10 text-red-400 border-red-500/20"
                      : "bg-yellow-500/10 text-yellow-500 border-yellow-500/20"
                  }`}>
                    {order.status}
                  </span>
                </div>

                {isPending && (
                  <button
                    onClick={(e) => handlePay(e, order)}
                    disabled={isPaying}
                    className="text-[10px] md:text-[11px] font-bold bg-accent hover:bg-accent-light text-white px-3 py-1.5 rounded-lg transition-all flex items-center gap-2"
                  >
                    {isPaying && (
                      <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    )}
                    {isPaying ? "Wait..." : "Pay Now"}
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Order Detail Modal */}
      <AnimatePresence>
        {selectedOrder && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 md:p-4">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setSelectedOrder(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />

            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              className="relative bg-bg-card border border-white/10 rounded-2xl md:rounded-[32px] w-full max-w-lg overflow-hidden shadow-2xl overflow-y-auto max-h-[95vh]"
            >
              {/* Modal Header */}
              <div className="relative h-24 md:h-40 flex items-end p-4 md:p-8">
                <Image
                  src={selectedOrder.products.product_images[0]?.url || "/next.svg"}
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
                  <h2 className="text-[17px] md:text-2xl font-display font-bold text-white leading-tight truncate max-w-[240px] md:max-w-none">
                    {selectedOrder.products.name_en}
                  </h2>
                  <p className="text-accent-light text-[11px] md:text-[14px] font-medium">
                    {selectedOrder.product_variants?.label_en || "Standard Version"}
                  </p>
                </div>
              </div>

              {/* Modal Body */}
              <div className="p-4 md:p-8 space-y-4 md:space-y-6">
                {/* Key Section */}
                <div className="bg-bg-base/60 border border-white/5 rounded-xl md:rounded-2xl p-3 md:p-5 flex flex-col sm:flex-row items-start sm:items-center gap-3 md:gap-5">
                  <div className="w-9 h-9 md:w-12 md:h-12 rounded-lg md:rounded-xl bg-accent/10 flex items-center justify-center text-accent-light shrink-0">
                    <KeyIcon size={18} />
                    <KeyIconDesktop mdSize={24} />
                  </div>
                  <div className="flex-1 min-w-0 w-full">
                    <p className="text-[8px] md:text-[10px] text-text-muted uppercase tracking-widest mb-0.5 font-bold">License Key</p>
                    <p className="font-mono text-[13px] md:text-[18px] text-white font-bold tracking-wider truncate">
                      {selectedOrder.game_keys?.key_value || "PROVISIONING..."}
                    </p>
                  </div>
                  <div className="w-full sm:w-auto">
                    <CopyButton value={selectedOrder.game_keys?.key_value || ""} />
                  </div>
                </div>

                {/* Assets & Presets */}
                <div className="grid grid-cols-1 gap-4 md:gap-6">
                  {/* Image Assets */}
                  <div className="space-y-2 md:space-y-3">
                    <h4 className="text-[9px] md:text-[11px] font-bold text-text-muted uppercase tracking-widest flex items-center gap-2">
                      <ImageIcon size={12} /> Image Assets
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 md:gap-2">
                      {selectedOrder.products.product_gifts.map((g: any, idx: number) => (
                        <a key={g.id} href={g.url} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-2.5 bg-white/5 hover:bg-violet-500/20 border border-white/5 text-white/80 p-2.5 rounded-lg md:rounded-xl transition-all">
                          <DownloadIcon size={12} className="text-violet-400" />
                          <span className="text-[11px] md:text-[12px] font-medium truncate flex-1">
                            {g.filename || `Asset_${idx + 1}`}
                          </span>
                        </a>
                      ))}
                    </div>
                    {selectedOrder.products.product_gifts.length === 0 && (
                      <p className="text-[11px] text-text-muted italic px-1">No image assets</p>
                    )}
                  </div>

                  {/* Config Presets */}
                  <div className="space-y-2 md:space-y-3">
                    <h4 className="text-[9px] md:text-[11px] font-bold text-text-muted uppercase tracking-widest flex items-center gap-2">
                      <PresetIcon size={12} /> Config Presets
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 md:gap-2">
                      {selectedOrder.products.product_presets.map((p: any, idx: number) => (
                        <a key={p.id} href={p.url} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-2.5 bg-white/5 hover:bg-blue-500/20 border border-white/5 text-white/80 p-2.5 rounded-lg md:rounded-xl transition-all">
                          <DownloadIcon size={12} className="text-blue-400" />
                          <span className="text-[11px] md:text-[12px] font-medium truncate flex-1">
                            {p.filename || `Preset_${idx + 1}`}
                          </span>
                        </a>
                      ))}
                    </div>
                    {selectedOrder.products.product_presets.length === 0 && (
                      <p className="text-[11px] text-text-muted italic px-1">No presets</p>
                    )}
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row justify-between items-center pt-3 border-t border-white/5 gap-2">
                  <p className="text-[10px] text-text-muted">
                    ID: <span className="font-mono">{selectedOrder.id.slice(0, 8)}...</span>
                  </p>
                  <Link
                    href={`/orders/${selectedOrder.id}`}
                    className="text-[11px] md:text-[12px] font-bold text-accent-light hover:underline"
                  >
                    View Full Details
                  </Link>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
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

function KeyIcon({ size = 20 }: { size?: number }) {
  return (
    <svg className="md:hidden" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
    </svg>
  )
}

function KeyIconDesktop({ mdSize = 24 }: { mdSize?: number }) {
  return (
    <svg className="hidden md:block" width={mdSize} height={mdSize} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
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
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.1a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" /><circle cx="12" cy="12" r="3" />
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