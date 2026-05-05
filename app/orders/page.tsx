import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import Navbar from "@/components/Navbar"
import Footer from "@/components/home/Footer"
import Link from "next/link"
import OrderListClient from "@/components/orders/OrderListClient"

export default async function MyOrdersPage() {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    redirect("/login")
  }

  const rawOrders = await prisma.orders.findMany({
    where: { user_id: session.user.id },
    orderBy: { created_at: "desc" },
    include: {
      game_keys: true,
      products: {
        include: {
          product_images: { orderBy: { sort_order: "asc" }, take: 1 },
          product_gifts: { orderBy: { sort_order: "asc" } },
          product_presets: { orderBy: { sort_order: "asc" } },
        }
      },
      product_variants: true
    }
  })

  const orders = rawOrders.map(order => ({
    ...order,
    amount: Number(order.amount),
    created_at: order.created_at?.toISOString() || null,
    paid_at: order.paid_at?.toISOString() || null,
    fulfilled_at: order.fulfilled_at?.toISOString() || null,
    game_keys: order.game_keys ? {
      ...order.game_keys,
      assigned_at: order.game_keys.assigned_at?.toISOString() || null,
      created_at: order.game_keys.created_at?.toISOString() || null,
    } : null,
    products: {
      ...order.products,
      price: Number(order.products.price),
      created_at: order.products.created_at?.toISOString() || null,
      updated_at: order.products.updated_at?.toISOString() || null,
      product_images: order.products.product_images.map(img => ({
        ...img,
        created_at: img.created_at?.toISOString() || null,
      })),
      product_gifts: order.products.product_gifts.map(gift => ({
        ...gift,
        created_at: gift.created_at?.toISOString() || null,
      })),
      product_presets: order.products.product_presets.map(preset => ({
        ...preset,
        created_at: preset.created_at?.toISOString() || null,
      })),
    },
    product_variants: order.product_variants ? {
      ...order.product_variants,
      price: Number(order.product_variants.price),
      created_at: order.product_variants.created_at?.toISOString() || null,
      updated_at: order.product_variants.updated_at?.toISOString() || null,
    } : null,
  }))

  return (
    <div className="min-h-screen bg-bg-base flex flex-col selection:bg-accent/30 selection:text-accent-light">
      <Navbar />

      <main className="flex-1 relative">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-accent/5 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/2"></div>
        </div>

        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 py-8 md:py-16">
          <header className="mb-8 md:mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 text-accent-light text-[10px] md:text-[11px] font-bold uppercase tracking-[0.2em] mb-2">
                <span className="w-6 md:w-8 h-[2px] bg-accent/40"></span>
                Secure Inventory
              </div>
              <h1 className="text-3xl md:text-4xl font-display font-bold text-white mb-1">My Assets</h1>
              <p className="text-text-muted text-[13px] md:text-[14px]">
                Click on any item to view details.
              </p>
            </div>
            
            <div className="bg-white/5 border border-white/10 rounded-2xl px-4 py-2.5 flex items-center gap-4 shrink-0 self-start md:self-auto">
              <div className="text-right border-r border-white/10 pr-4">
                <p className="text-[9px] text-text-muted uppercase font-bold tracking-wider">Total</p>
                <p className="text-lg font-display font-bold text-white">{orders.length}</p>
              </div>
              <div className="text-right">
                <p className="text-[9px] text-text-muted uppercase font-bold tracking-wider">Paid</p>
                <p className="text-lg font-display font-bold text-accent-light">
                  {orders.filter(o => o.status === 'paid').length}
                </p>
              </div>
            </div>
          </header>

          {orders.length === 0 ? (
            <div className="bg-bg-card border border-white/5 rounded-3xl p-10 md:p-16 text-center shadow-xl">
              <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center mx-auto mb-6 opacity-30">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
              <h2 className="text-lg font-bold text-white mb-2">Inventory is empty</h2>
              <Link href="/products" className="inline-flex items-center justify-center px-6 py-2.5 bg-accent hover:opacity-90 text-white text-[14px] font-bold rounded-xl transition">
                Browse Products
              </Link>
            </div>
          ) : (
            <OrderListClient orders={orders} />
          )}
        </div>
      </main>

      <Footer />
    </div>
  )
}
