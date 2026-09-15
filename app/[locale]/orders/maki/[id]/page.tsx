import { notFound } from "next/navigation"
import { setRequestLocale } from "next-intl/server"
import { prisma } from "@/lib/prisma"
import { requireUser } from "@/lib/requireUser"
import { syncMakiOrder, toMakiOrderView } from "@/lib/makiOrders"
import Navbar from "@/components/Navbar"
import Footer from "@/components/home/Footer"
import MakiOrderClient from "./MakiOrderClient"

export const dynamic = "force-dynamic"

// หน้าออเดอร์เกม Maki — Maki เด้งลูกค้ากลับมาที่นี่หลังจ่าย (redirect_link) · เช็คสถานะกับ Maki ก่อนแสดงทุกครั้ง
export default async function Page({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params
  setRequestLocale(locale)
  const { userId, session } = await requireUser(locale)
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound()
  const row = await syncMakiOrder(id)
  if (!row || (row.user_id !== userId && session.user.role !== "admin")) notFound()
  const [product, points] = await Promise.all([
    prisma.partner_products.findUnique({ where: { id: row.partner_product_id }, select: { external_slug: true, name_th: true, name_en: true, thumbnail_url: true, images: true, plans: true, downloads: true } }),
    prisma.point_ledger.findFirst({ where: { partner_order_id: id, type: "earn_purchase" }, select: { delta: true } }),
  ])
  return (
    <div className="min-h-screen bg-bg-base flex flex-col">
      <Navbar />
      <main className="flex-1 page-container py-8 md:py-12">
        <MakiOrderClient initial={toMakiOrderView(row, product)} initialPoints={points?.delta ?? null} />
      </main>
      <Footer />
    </div>
  )
}
