import { notFound } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { setRequestLocale } from "next-intl/server"
import { getFeatureFlags } from "@/lib/featureFlags"
import Navbar from "@/components/Navbar"
import Footer from "@/components/home/Footer"
import LiveGenClient, { type LiveGenConfig } from "../../orders/[id]/livegen/LiveGenClient"

// Public LiveGen builder. No login required to view + use + download. Save
// requires login (the LiveGenClient bounces unauth users to /login on save
// click). The composition is stored against (user_id, product_id) once authed,
// completely separate from order-scoped configs.

export const dynamic = "force-dynamic"

export default async function LiveGenPublicPage({
  params,
}: {
  params: Promise<{ productId: string; locale: string }>
}) {
  const { productId, locale } = await params
  setRequestLocale(locale)

  const flags = await getFeatureFlags()
  if (!flags.livegen_enabled) notFound()

  const session = await getServerSession(authOptions)

  const product = await prisma.products.findUnique({
    where: { id: productId },
    select: { id: true, name_en: true, name_th: true, is_active: true },
  })
  if (!product || !product.is_active) notFound()

  const [functions, gifts, draft, libraryRows] = await Promise.all([
    prisma.product_functions.findMany({
      where: { product_id: productId },
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
    session?.user?.id
      ? prisma.user_livegen_drafts.findUnique({
          where: { user_id_product_id: { user_id: session.user.id, product_id: productId } },
          select: { config: true },
        })
      : Promise.resolve(null),
    prisma.product_functions.findMany({
      where: { image_url: { not: null } },
      select: { image_url: true, name: true, product_id: true },
      take: 200,
    }),
  ])

  if (functions.length === 0) notFound()

  const seenUrls = new Set<string>()
  const characterLibrary = libraryRows
    .filter((r) => {
      if (!r.image_url || seenUrls.has(r.image_url)) return false
      seenUrls.add(r.image_url)
      return true
    })
    .map((r) => ({ url: r.image_url as string, name: r.name }))

  const initialConfig = (draft?.config ?? null) as LiveGenConfig | null

  return (
    <div className="min-h-screen bg-bg-base">
      <Navbar />
      <LiveGenClient
        mode="public"
        productId={product.id}
        isAuthenticated={!!session?.user?.id}
        locale={locale}
        productName={locale === "th" ? product.name_th : product.name_en}
        functions={functions}
        gifts={gifts}
        characterLibrary={characterLibrary}
        initialConfig={initialConfig}
      />
      <Footer />
    </div>
  )
}
