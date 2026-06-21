// Bangkok-timezone helpers for analytics/dashboard.
//
// Why: Postgres `DATE_TRUNC('day', paid_at)` and JS `startOfDay()` both use
// the *server's* timezone — on Vercel that's UTC. A sale at 02:00 Bangkok
// is 19:00 UTC the previous day, so without correction it gets bucketed
// into the wrong calendar day and the chart shows it under yesterday.
//
// All store revenue/order reporting must be in Asia/Bangkok regardless of
// where the Node or Postgres server happens to run.

import { Prisma } from "@prisma/client"

export const BANGKOK_TZ = "Asia/Bangkok"
export const BANGKOK_UTC_OFFSET = "+07:00"

// SQL granularity unit accepted by DATE_TRUNC.
export type BangkokGranularity = "hour" | "day" | "month"

// Returns the UTC instant of the Bangkok-local start of the day that `date`
// falls into. Works regardless of process.env.TZ.
export function bangkokDayStart(date: Date): Date {
  const ymd = new Intl.DateTimeFormat("en-CA", {
    timeZone: BANGKOK_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date)
  return new Date(`${ymd}T00:00:00.000${BANGKOK_UTC_OFFSET}`)
}

// Returns the UTC instant of the Bangkok-local start of the month that
// `date` falls into.
export function bangkokMonthStart(date: Date): Date {
  const ym = new Intl.DateTimeFormat("en-CA", {
    timeZone: BANGKOK_TZ,
    year: "numeric",
    month: "2-digit",
  }).format(date)
  return new Date(`${ym}-01T00:00:00.000${BANGKOK_UTC_OFFSET}`)
}

// Parse a YYYY-MM-DD string as a Bangkok day boundary (UTC instant).
// `end=true` returns the last millisecond of the day.
export function parseBangkokDay(s: string | undefined, end: boolean): Date | null {
  if (!s) return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null
  const suffix = end ? `T23:59:59.999${BANGKOK_UTC_OFFSET}` : `T00:00:00.000${BANGKOK_UTC_OFFSET}`
  const d = new Date(`${s}${suffix}`)
  return Number.isNaN(d.getTime()) ? null : d
}

// Builds a SQL expression that buckets a timestamptz column into Bangkok-
// local hour/day/month and returns a timestamptz pointing at the UTC instant
// of that bucket's start. Safe to drop into ORDER BY / GROUP BY / SELECT.
//
//   DATE_TRUNC('day', col AT TIME ZONE 'Asia/Bangkok') AT TIME ZONE 'Asia/Bangkok'
//
// First `AT TIME ZONE` converts utc→local naive timestamp; DATE_TRUNC works
// on that local wall-clock; second `AT TIME ZONE` interprets the naive
// result as Bangkok local and yields the proper UTC instant. Works on all
// supported Postgres versions (no PG16-only 3-arg DATE_TRUNC needed).
export function bangkokBucketSql(
  granularity: BangkokGranularity,
  column: string = "paid_at",
): Prisma.Sql {
  // `granularity` is a fixed enum, never user input — safe to inline.
  // `column` defaults to `paid_at`; callers passing something else must
  // ensure it's a trusted identifier.
  return Prisma.raw(
    `DATE_TRUNC('${granularity}', ${column} AT TIME ZONE '${BANGKOK_TZ}') AT TIME ZONE '${BANGKOK_TZ}'`,
  )
}
