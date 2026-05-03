"use client"
import Link from "next/link"

import { useState, useEffect } from "react"
import Navbar from "@/components/Navbar"
import Footer from "@/components/home/Footer"
import KeyModal from "@/components/home/KeyModal"

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
    tags: string[]
    price: string
  }
  keys: Key[]
}

export default function MyOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const res = await fetch('/Histories.json')
        if (res.ok) {
          const data = await res.json()
          setOrders(data)
        } else {
          // Fallback mock data if json doesn't exist
          setOrders([
            {
              orderId: "ORD-92831-772",
              date: new Date().toISOString(),
              product: {
                name: "Cyberpunk 2077: Ultimate Edition",
                image: "https://images.gog-statics.com/393710776b9148d488e0ec5370d04085420e6f7902d84713c2f0f49f430f8983.jpg",
                platform: "GOG.com",
                tags: ["Open World", "RPG", "Sci-fi"],
                price: "$44.99",
              },
              keys: [
                { label: "GOG Game Key", value: "ABCD-1234-EFGH-5678" },
                { label: "Bonus Content Key", value: "BONUS-9988-7766" },
              ],
            }
          ])
        }
      } catch (error) {
        console.error("Failed to fetch orders:", error)
      } finally {
        setIsLoading(false)
      }
    }
    fetchOrders()
  }, [])

  const fmtDate = (iso: string) => {
    return new Date(iso).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  return (
    <div className="flex flex-col min-h-screen font-body bg-bg-base text-text-base">
      <Navbar />

      <main className="relative flex-1">
        <div className="grid-bg absolute inset-0 pointer-events-none"></div>

        <div className="relative z-10 max-w-4xl mx-auto px-6 py-12">
          <div className="mb-8 anim-up">
            <p className="text-[11px] tracking-widest uppercase font-medium mb-1" style={{ color: 'var(--color-accent-light)' }}>
              Account
            </p>
            <h1 className="font-display font-bold" style={{ fontSize: 'clamp(28px, 5vw, 42px)' }}>
              My Orders
            </h1>
            <p className="text-[13px] mt-1" style={{ color: 'var(--color-text-muted)' }}>
              Your purchase history — click <em>View Keys</em> to reveal your game keys
            </p>
          </div>

          {!isLoading && orders.length > 0 ? (
            <div className="flex flex-col gap-4">
              {orders.map((order, i) => (
                <div
                  key={order.orderId}
                  className="order-card rounded-2xl overflow-hidden anim-up"
                  style={{ animationDelay: `${(i * 0.08).toFixed(2)}s` }}
                >
                  <div className="flex flex-col sm:flex-row">
                    <div className="sm:w-[140px] h-[90px] sm:h-auto shrink-0 relative overflow-hidden"
                      style={{ background: 'linear-gradient(135deg,#0d1e35,#1a3a6a)' }}>
                      <img src={order.product.image} alt={order.product.name}
                        className="w-full h-full object-cover opacity-70" />
                    </div>
                    <div className="flex-1 p-5 flex flex-col sm:flex-row sm:items-center gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <p className="font-display font-bold text-[18px] leading-tight truncate">{order.product.name}</p>
                          <span className="badge-completed text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">✓ Completed</span>
                        </div>
                        <span className="platform-chip inline-block text-[11px] px-2.5 py-0.5 rounded-full mb-2">{order.product.platform}</span>
                        <div className="flex flex-wrap gap-1 mb-3">
                          {order.product.tags.map((t, idx) => (
                            <span key={idx} className="tag-pill px-2 py-0.5 rounded-full">{t}</span>
                          ))}
                        </div>
                        <div className="flex items-center gap-3 text-[12px]" style={{ color: 'var(--color-text-muted)' }}>
                          <span>{order.orderId}</span>
                          <span>·</span>
                          <span>{fmtDate(order.date)}</span>
                        </div>
                      </div>
                      <div className="flex sm:flex-col items-center sm:items-end gap-3 sm:gap-2 shrink-0">
                        <span className="font-display font-bold text-[22px]" style={{ color: 'var(--color-accent-light)' }}>{order.product.price}</span>
                        <button onClick={() => { setSelectedOrder(order); setIsModalOpen(true); }}
                          className="btn-key flex items-center gap-2 text-[13px] font-medium px-4 py-2 rounded-xl">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                            <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
                          </svg>
                          View Keys
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : !isLoading && (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <svg className="empty-icon mb-4" width="56" height="56" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="1.2">
                <rect x="2" y="3" width="20" height="14" rx="2" />
                <path d="M8 21h8M12 17v4" />
              </svg>
              <p className="font-display font-bold text-[20px] mb-1">No orders yet</p>
              <p className="text-[13px]" style={{ color: 'var(--color-text-muted)' }}>Head to the shop and grab your first key!</p>
              <Link href="/products" className="mt-5 inline-block text-[13px] px-5 py-2.5 rounded-lg no-underline bg-accent text-white">
                Browse Shop
              </Link>
            </div>
          )}
        </div>
      </main>

      <Footer />
      <KeyModal order={selectedOrder} isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </div>
  )
}
