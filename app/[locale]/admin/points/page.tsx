import { prisma } from "@/lib/prisma"
import { setRequestLocale } from "next-intl/server"
import { getPointsConfig, pointsActive, POINTS_CONFIG_KEYS } from "@/lib/points"
import PointsAdminClient from "./PointsAdminClient"

export const dynamic = "force-dynamic"

// AC Points (แอดมิน): ผู้ใช้และยอดแต้ม (เพิ่ม/หัก/ตั้งยอด/ยกเลิกรายการ) · ประวัติทั้งหมด · ตั้งค่าเรท
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)

  const [cfg, totals, configRows] = await Promise.all([
    getPointsConfig(),
    prisma.point_ledger.groupBy({ by: ["type"], _sum: { delta: true }, _count: { _all: true } }),
    prisma.system_configs.findMany({ where: { key: { in: Object.values(POINTS_CONFIG_KEYS) } } }),
  ])
  const sum = (type: string) => totals.find((x) => x.type === type)?._sum.delta ?? 0
  const count = (type: string) => totals.find((x) => x.type === type)?._count._all ?? 0

  return (
    <PointsAdminClient
      config={{ active: pointsActive(cfg), perBaht: cfg.perBaht, perReview: cfg.perReview, startAt: cfg.startAt?.toISOString() ?? null }}
      configs={Object.fromEntries(configRows.map((r) => [r.key, r.value]))}
      stats={{
        outstanding: totals.reduce((n, x) => n + (x._sum.delta ?? 0), 0),
        earned: sum("earn_purchase"),
        earnedCount: count("earn_purchase"),
        reversed: sum("reverse_purchase"),
        adjusted: sum("adjust_admin"),
      }}
    />
  )
}
