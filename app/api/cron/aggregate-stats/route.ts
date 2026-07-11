import { NextResponse } from "next/server"
import { headers } from "next/headers"
import { prisma } from "@/lib/prisma"
import { bangkokDayKey, BANGKOK_UTC_OFFSET } from "@/lib/bangkokTz"

const RAW_RETENTION_DAYS = 90

// Roll up one Bangkok calendar day ("YYYY-MM-DD"). Day boundaries are Bangkok
// midnight — NOT setUTCHours(0), which would reset the day at 07:00 Thai time.
// daily_stats.date is keyed by the UTC-midnight Date of the label.
async function rollupDay(label: string) {
  const start = new Date(`${label}T00:00:00.000${BANGKOK_UTC_OFFSET}`)
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000)
  const dateKey = new Date(`${label}T00:00:00.000Z`)

  const [agg] = await prisma.$queryRaw<{
    total_views: number
    unique_visitors: number
    logged_in_views: number
  }[]>`
    SELECT
      COUNT(*)::int                                    AS total_views,
      COUNT(DISTINCT visitor_id)::int                  AS unique_visitors,
      COUNT(*) FILTER (WHERE user_id IS NOT NULL)::int AS logged_in_views
    FROM page_views
    WHERE created_at >= ${start} AND created_at < ${end}
  `

  const [newVisitorRow] = await prisma.$queryRaw<{ new_visitors: number }[]>`
    SELECT COUNT(*)::int AS new_visitors
    FROM (
      SELECT visitor_id, MIN(created_at) AS first_seen
      FROM page_views
      GROUP BY visitor_id
    ) firsts
    WHERE first_seen >= ${start} AND first_seen < ${end}
  `

  const topPaths = await prisma.$queryRaw<{ path: string; views: number }[]>`
    SELECT path, COUNT(*)::int AS views
    FROM page_views
    WHERE created_at >= ${start} AND created_at < ${end}
    GROUP BY path
    ORDER BY views DESC
    LIMIT 10
  `

  await prisma.daily_stats.upsert({
    where: { date: dateKey },
    create: {
      date: dateKey,
      total_views: agg?.total_views ?? 0,
      unique_visitors: agg?.unique_visitors ?? 0,
      new_visitors: newVisitorRow?.new_visitors ?? 0,
      logged_in_views: agg?.logged_in_views ?? 0,
      top_paths: topPaths,
    },
    update: {
      total_views: agg?.total_views ?? 0,
      unique_visitors: agg?.unique_visitors ?? 0,
      new_visitors: newVisitorRow?.new_visitors ?? 0,
      logged_in_views: agg?.logged_in_views ?? 0,
      top_paths: topPaths,
    },
  })

  return {
    date: label,
    total_views: agg?.total_views ?? 0,
    unique_visitors: agg?.unique_visitors ?? 0,
  }
}

async function authorize(): Promise<boolean> {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const hdrs = await headers()
  const auth = hdrs.get("authorization") ?? ""
  return auth === `Bearer ${secret}`
}

export async function GET() {
  if (!(await authorize())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const now = new Date()
    const todayLabel = bangkokDayKey(now)
    const yesterdayLabel = bangkokDayKey(new Date(now.getTime() - 24 * 60 * 60 * 1000))

    const results = await Promise.all([
      rollupDay(yesterdayLabel),
      rollupDay(todayLabel),
    ])

    const todayStart = new Date(`${todayLabel}T00:00:00.000${BANGKOK_UTC_OFFSET}`)
    const pruneCutoff = new Date(todayStart.getTime() - RAW_RETENTION_DAYS * 24 * 60 * 60 * 1000)
    const pruned = await prisma.page_views.deleteMany({
      where: { created_at: { lt: pruneCutoff } },
    })

    return NextResponse.json({ ok: true, rolled: results, pruned: pruned.count })
  } catch (err: unknown) {
    console.error("[/api/cron/aggregate-stats] error:", err)
    return NextResponse.json({ error: (err as Error)?.message ?? "rollup failed" }, { status: 500 })
  }
}
