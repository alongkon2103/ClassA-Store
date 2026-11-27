import type { Metadata } from "next"
import { setRequestLocale } from "next-intl/server"
import { prisma } from "@/lib/prisma"
import { buildBundleCatalog } from "@/lib/bundleCatalog"
import BundleStorefront from "./BundleStorefront"
import { getThbToUsdRate } from "@/lib/paypal"

// Public membership catalog; payment creation still requires an active customer.
export const dynamic = "force-dynamic"

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  return {
    title: locale === "th" ? "สมาชิกเกมรายเดือน | A Class Store" : "Monthly game membership | A Class Store",
    description: locale === "th" ? "สมัครสมาชิก A Class Games รับสิทธิ์เกมในแพ็กเกจ 30 วัน พร้อมดาวน์โหลดโปรแกรมสำหรับ Windows" : "Join A Class Games for 30 days of access to every included game. Download the companion Windows app for free.",
    robots: { index: true, follow: true },
  }
}

export default async function BundlesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  const products = await prisma.products.findMany({
    where: { is_active: true, OR: [{ type: "bundle", slug: "ac-games-membership" }, { type: { in: ["roblox_whitelist", "desktop_program"] } }], AND: [{ OR: [{ is_consignment: false }, { is_consignment: null }] }] },
    include: {
      product_images: { orderBy: { sort_order: "asc" } },
      product_variants: { where: { is_active: true }, orderBy: { sort_order: "asc" } },
    },
    orderBy: [{ display_order: "asc" }, { created_at: "desc" }],
  })
  const bundles = buildBundleCatalog(products.filter(product => product.type === "bundle"), products)
  return <BundleStorefront bundles={bundles} locale={locale} usdRate={await getThbToUsdRate()} />
}
