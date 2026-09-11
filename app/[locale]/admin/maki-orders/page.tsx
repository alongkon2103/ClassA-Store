import { prisma } from "@/lib/prisma"
import { setRequestLocale } from "next-intl/server"
import MakiOrdersAdminClient from "./MakiOrdersAdminClient"

export const dynamic = "force-dynamic"

// ออเดอร์เกม Maki ที่ขายผ่านเว็บเรา: ยอด/กำไร/สถานะ + เช็คสิทธิ์จริงของลูกค้าใน Maki (support)
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  const rows = await prisma.partner_orders.findMany({
    orderBy: { created_at: "desc" }, take: 200,
    include: { user: { select: { id: true, username: true, email: true } }, partner_product: { select: { name_th: true, external_slug: true } } },
  })
  const paid = rows.filter((r) => r.status === "paid")
  const sum = (xs: typeof rows, f: (r: (typeof rows)[number]) => number) => xs.reduce((n, r) => n + f(r), 0)
  return (
    <MakiOrdersAdminClient
      stats={{
        paid: paid.length,
        pending: rows.filter((r) => r.status === "pending").length,
        revenue: sum(paid, (r) => Number(r.price_thb)),
        margin: sum(paid, (r) => Number(r.price_thb) - Number(r.min_price_thb)),
      }}
      orders={rows.map((r) => ({
        id: r.id, status: r.status, plan_key: r.plan_key, price: Number(r.price_thb), min: Number(r.min_price_thb),
        customer_provider: r.customer_provider, customer_id: r.customer_id, maki_order_id: r.maki_order_id, note: r.note,
        created_at: r.created_at.toISOString(), paid_at: r.paid_at?.toISOString() ?? null,
        user: r.user, product: r.partner_product.name_th, slug: r.partner_product.external_slug,
      }))}
    />
  )
}
