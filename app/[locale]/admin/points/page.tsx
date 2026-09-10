import { prisma } from "@/lib/prisma"
import { setRequestLocale } from "next-intl/server"
import { getPointsConfig, pointsActive } from "@/lib/points"
import PointsAdminClient from "./PointsAdminClient"

export const dynamic = "force-dynamic"

// AC Points (แอดมิน): ภาพรวม · ค้นหาลูกค้า/ปรับแต้ม · รายการล่าสุด · กวาดออเดอร์ที่ยังไม่ได้แต้ม
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)

  const [cfg, totals, entries] = await Promise.all([
    getPointsConfig(),
    prisma.point_ledger.groupBy({ by: ["type"], _sum: { delta: true }, _count: { _all: true } }),
    prisma.point_ledger.findMany({
      orderBy: { created_at: "desc" },
      take: 100,
      include: {
        user: { select: { id: true, username: true, email: true } },
        order: { select: { id: true, products: { select: { name_th: true } } } },
      },
    }),
  ])
  const sum = (type: string) => totals.find((x) => x.type === type)?._sum.delta ?? 0
  const count = (type: string) => totals.find((x) => x.type === type)?._count._all ?? 0

  return (
    <PointsAdminClient
      config={{ active: pointsActive(cfg), perBaht: cfg.perBaht, startAt: cfg.startAt?.toISOString() ?? null }}
      stats={{
        outstanding: totals.reduce((n, x) => n + (x._sum.delta ?? 0), 0),
        earned: sum("earn_purchase"),
        earnedCount: count("earn_purchase"),
        reversed: sum("reverse_purchase"),
        adjusted: sum("adjust_admin"),
      }}
      entries={entries.map((e) => ({
        id: e.id, delta: e.delta, type: e.type, note: e.note, created_at: e.created_at.toISOString(),
        user: e.user, order_id: e.order?.id ?? null, product: e.order?.products.name_th ?? null,
      }))}
    />
  )
}
