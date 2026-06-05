import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import VisitorsClient from "./VisitorsClient"

export const dynamic = "force-dynamic"

export default async function VisitorsPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user || session.user.role !== "admin") redirect("/")

  const now = new Date()
  const todayStart = new Date(now)
  todayStart.setUTCHours(0, 0, 0, 0)
  const thirtyDaysAgo = new Date(todayStart)
  thirtyDaysAgo.setUTCDate(thirtyDaysAgo.getUTCDate() - 29)

  const [
    dailyStats,
    todayLive,
    todayTopPaths,
    last30TopPaths,
    deviceBreakdown,
    countryBreakdown,
    last24hHourly,
  ] = await Promise.all([
    prisma.daily_stats.findMany({
      where: { date: { gte: thirtyDaysAgo, lte: todayStart } },
      orderBy: { date: "asc" },
    }),

    prisma.$queryRaw<{
      total_views: number
      unique_visitors: number
      logged_in_views: number
    }[]>`
      SELECT
        COUNT(*)::int                                    AS total_views,
        COUNT(DISTINCT visitor_id)::int                  AS unique_visitors,
        COUNT(*) FILTER (WHERE user_id IS NOT NULL)::int AS logged_in_views
      FROM page_views
      WHERE created_at >= ${todayStart}
    `,

    prisma.$queryRaw<{ path: string; views: number; visitors: number }[]>`
      SELECT path,
             COUNT(*)::int                  AS views,
             COUNT(DISTINCT visitor_id)::int AS visitors
      FROM page_views
      WHERE created_at >= ${todayStart}
      GROUP BY path
      ORDER BY views DESC
      LIMIT 10
    `,

    prisma.$queryRaw<{ path: string; views: number; visitors: number }[]>`
      SELECT path,
             COUNT(*)::int                  AS views,
             COUNT(DISTINCT visitor_id)::int AS visitors
      FROM page_views
      WHERE created_at >= ${thirtyDaysAgo}
      GROUP BY path
      ORDER BY views DESC
      LIMIT 10
    `,

    prisma.$queryRaw<{ device: string | null; count: number }[]>`
      SELECT device, COUNT(*)::int AS count
      FROM page_views
      WHERE created_at >= ${thirtyDaysAgo}
      GROUP BY device
      ORDER BY count DESC
    `,

    prisma.$queryRaw<{ country: string | null; count: number }[]>`
      SELECT country, COUNT(*)::int AS count
      FROM page_views
      WHERE created_at >= ${thirtyDaysAgo} AND country IS NOT NULL
      GROUP BY country
      ORDER BY count DESC
      LIMIT 8
    `,

    prisma.$queryRaw<{ hour: Date; views: number; visitors: number }[]>`
      SELECT DATE_TRUNC('hour', created_at) AS hour,
             COUNT(*)::int                   AS views,
             COUNT(DISTINCT visitor_id)::int AS visitors
      FROM page_views
      WHERE created_at >= NOW() - INTERVAL '24 hours'
      GROUP BY 1
      ORDER BY 1
    `,
  ])

  const todayRow = todayLive[0] ?? { total_views: 0, unique_visitors: 0, logged_in_views: 0 }
  const totalAll = dailyStats.reduce((a, d) => a + d.total_views, 0) + todayRow.total_views
  const uniqAll = dailyStats.reduce((a, d) => a + d.unique_visitors, 0) + todayRow.unique_visitors

  return (
    <VisitorsClient
      data={{
        dailyStats: dailyStats.map(d => ({
          date: d.date.toISOString().slice(0, 10),
          total_views: d.total_views,
          unique_visitors: d.unique_visitors,
          new_visitors: d.new_visitors,
          logged_in_views: d.logged_in_views,
        })),
        today: {
          date: todayStart.toISOString().slice(0, 10),
          ...todayRow,
        },
        totals30: {
          total_views: totalAll,
          unique_visitors: uniqAll,
        },
        todayTopPaths,
        last30TopPaths,
        deviceBreakdown,
        countryBreakdown,
        last24hHourly: last24hHourly.map(r => ({
          hour: r.hour.toISOString(),
          views: r.views,
          visitors: r.visitors,
        })),
      }}
    />
  )
}
