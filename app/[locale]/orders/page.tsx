import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getFeatureFlags } from "@/lib/featureFlags"
import { redirect } from "next/navigation"  // ✅ ใช้ next/navigation แทน i18n/routing
import { Link } from "@/i18n/routing"        // ✅ Link ยังใช้ i18n ได้
import Navbar from "@/components/Navbar"
import Footer from "@/components/home/Footer"
import OrdersDashboard from "@/components/orders/OrdersDashboard"
import { setRequestLocale, getTranslations } from "next-intl/server"

// Skip the static cache — admin feature toggles must reflect immediately.
export const dynamic = "force-dynamic"

export default async function MyOrdersPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations("Orders")
  const tShop = await getTranslations("Shop")

  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    redirect(`/${locale}/login`)
  }

  const featureFlags = await getFeatureFlags()

  const rawOrders = await prisma.orders.findMany({
    where: {
      user_id: session.user.id,
      OR: [
        { order_type: { not: "TRIAL" } },
        {
          order_type: "TRIAL",
          expires_at: { gt: new Date() }
        }
      ],
      NOT: {
        OR: [
          {
            AND: [
              { status: "pending" },
              { expires_at: { lt: new Date() } },
            ]
          },
          { status: "expired" }
        ]
      }
    },

    orderBy: [
      {
        status: "asc",
      },
      {
        created_at: "desc",
      },
    ],
    include: {
      game_keys: true,
      products: {
        include: {
          product_images: {
            orderBy: { sort_order: "asc" },
            take: 1,
          },
          product_gifts: {
            orderBy: { sort_order: "asc" },
          },
          product_presets: {
            orderBy: { sort_order: "asc" },
          },
          product_functions: {
            orderBy: { sort_order: "asc" },
          },
        },
      },
      product_variants: true,
    },
  })
  const orders = rawOrders.map(order => ({
    ...order,
    amount: Number(order.amount),
    discount_amount: order.discount_amount === null ? null : Number(order.discount_amount),
    expected_amount: order.expected_amount === null ? null : Number(order.expected_amount),

    created_at: order.created_at?.toISOString() || null,
    paid_at: order.paid_at?.toISOString() || null,
    fulfilled_at: order.fulfilled_at?.toISOString() || null,

    game_keys: order.game_keys ? {
      ...order.game_keys,
      assigned_at: order.game_keys.assigned_at?.toISOString() || null,
      created_at: order.game_keys.created_at?.toISOString() || null,
    } : null,

    products: order.products ? {
      ...order.products,
      price: Number(order.products.price),
      commission_pct: Number(order.products.commission_pct ?? 0),

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
    } : null,

    product_variants: order.product_variants ? {
      ...order.product_variants,
      price: Number(order.product_variants.price),
      premium_addon_price: Number(order.product_variants.premium_addon_price ?? 0),
      discount_pct: Number(order.product_variants.discount_pct ?? 0),
      created_at: order.product_variants.created_at?.toISOString() || null,
      updated_at: order.product_variants.updated_at?.toISOString() || null,
    } : null
  }))

  return (
    <div className="min-h-screen bg-bg-base flex flex-col selection:bg-accent/30 selection:text-accent-light">
      <Navbar />

      <main className="flex-1 relative">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-accent/5 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/2"></div>
        </div>

        <div className="relative z-10 w-full px-5 sm:px-7 lg:px-10 py-8 md:py-12">
          <OrdersDashboard orders={orders} livegenEnabled={featureFlags.livegen_enabled} />
        </div>
      </main>

      <Footer />
    </div>
  )
}
