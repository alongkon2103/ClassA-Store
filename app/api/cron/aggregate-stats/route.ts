import { NextResponse } from "next/server"
import { headers } from "next/headers"
import { prisma } from "@/lib/prisma"

const RAW_RETENTION_DAYS = 90

function todayDate(): Date {
  const d = new Date()
  d.setUTCHours(0, 0, 0, 0)
  return d
}

async function rollupDate(date: Date) {
  const start = new Date(date)
  const end = new Date(date)
  end.setUTCDate(end.getUTCDate() + 1)

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
    where: { date: start },
    create: {
      date: start,
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
    date: start.toISOString().slice(0, 10),
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
    const today = todayDate()
    const yesterday = new Date(today)
    yesterday.setUTCDate(yesterday.getUTCDate() - 1)

    const results = await Promise.all([
      rollupDate(yesterday),
      rollupDate(today),
    ])

    const pruneCutoff = new Date(today)
    pruneCutoff.setUTCDate(pruneCutoff.getUTCDate() - RAW_RETENTION_DAYS)
    const pruned = await prisma.page_views.deleteMany({
      where: { created_at: { lt: pruneCutoff } },
    })

    return NextResponse.json({ ok: true, rolled: results, pruned: pruned.count })
  } catch (err: any) {
    console.error("[/api/cron/aggregate-stats] error:", err)
    return NextResponse.json({ error: err?.message ?? "rollup failed" }, { status: 500 })
  }
}
