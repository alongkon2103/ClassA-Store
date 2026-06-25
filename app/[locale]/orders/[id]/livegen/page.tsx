import { redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { setRequestLocale, getTranslations } from "next-intl/server"
import Navbar from "@/components/Navbar"
import Footer from "@/components/home/Footer"
import LiveGenClient, { type LiveGenConfig } from "./LiveGenClient"

export const dynamic = "force-dynamic"

export default async function LiveGenPage({
  params,
}: {
  params: Promise<{ id: string; locale: string }>
}) {
  const { id, locale } = await params
  setRequestLocale(locale)

  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect(`/${locale}/login`)

  const t = await getTranslations("LiveGen")

  const order = await prisma.orders.findUnique({
    where: { id },
    include: {
      products: { select: { id: true, name_en: true, name_th: true } },
    },
  })

  if (!order || order.user_id !== session.user.id) {
    return (
      <div className="min-h-screen bg-bg-base">
        <Navbar />
        <div className="flex flex-col items-center justify-center py-20 px-6">
          <h1 className="text-2xl font-bold text-text-base mb-2">{t("not_found_title")}</h1>
          <p className="text-text-muted">{t("not_found_desc")}</p>
        </div>
        <Footer />
      </div>
    )
  }

  if (order.status !== "paid" && order.status !== "Admin Buy") {
    return (
      <div className="min-h-screen bg-bg-base">
        <Navbar />
        <div className="flex flex-col items-center justify-center py-20 px-6">
          <h1 className="text-2xl font-bold text-text-base mb-2">{t("not_paid_title")}</h1>
          <p className="text-text-muted">{t("not_paid_desc")}</p>
        </div>
        <Footer />
      </div>
    )
  }

  const [functions, gifts, saved, libraryRows] = await Promise.all([
    prisma.product_functions.findMany({
      where: { product_id: order.product_id },
      orderBy: { sort_order: "asc" },
      select: {
        id: true,
        name: true,
        label_th: true,
        label_en: true,
        image_url: true,
        default_gift_id: true,
        default_trigger_threshold: true,
      },
    }),
    prisma.gifts.findMany({
      where: { is_active: true },
      orderBy: { sort_order: "asc" },
      select: { id: true, name: true, image_url: true, diamonds: true },
    }),
    prisma.user_livegen_configs.findUnique({
      where: { order_id: id },
      select: { config: true },
    }),
    // Character library — every product_function image across the catalog so
    // users have variety even when their own product only defines a handful.
    prisma.product_functions.findMany({
      where: { image_url: { not: null } },
      select: { image_url: true, name: true, product_id: true },
      take: 200,
    }),
  ])

  const seenUrls = new Set<string>()
  const characterLibrary = libraryRows
    .filter((r) => {
      if (!r.image_url || seenUrls.has(r.image_url)) return false
      seenUrls.add(r.image_url)
      return true
    })
    .map((r) => ({ url: r.image_url as string, name: r.name }))

  const initialConfig = (saved?.config ?? null) as LiveGenConfig | null

  return (
    <div className="min-h-screen bg-bg-base">
      <Navbar />
      <LiveGenClient
        orderId={order.id}
        locale={locale}
        productName={locale === "th" ? order.products.name_th : order.products.name_en}
        functions={functions}
        gifts={gifts}
        characterLibrary={characterLibrary}
        initialConfig={initialConfig}
      />
      <Footer />
    </div>
  )
}
