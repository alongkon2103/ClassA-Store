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

// Bangkok-local calendar day of an instant, as "YYYY-MM-DD". Use this as the
// join key between server-bucketed data and chart axes so the browser's own
// timezone can never shift a sale onto the wrong day.
export function bangkokDayKey(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: BANGKOK_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date)
}

// Returns the UTC instant of the Bangkok-local start of the day that `date`
// falls into. Works regardless of process.env.TZ.
export function bangkokDayStart(date: Date): Date {
  return new Date(`${bangkokDayKey(date)}T00:00:00.000${BANGKOK_UTC_OFFSET}`)
}

// Returns the UTC instant of the Bangkok-local start of the hour that `date`
// falls into.
export function bangkokHourStart(date: Date): Date {
  const hh = new Intl.DateTimeFormat("en-GB", {
    timeZone: BANGKOK_TZ,
    hour: "2-digit",
    hourCycle: "h23",
  }).format(date)
  return new Date(`${bangkokDayKey(date)}T${hh}:00:00.000${BANGKOK_UTC_OFFSET}`)
}

// Bangkok period start for a given granularity — the JS-side equivalent of
// the old SQL DATE_TRUNC bucketing. Bucketing MUST happen in JS, not SQL:
// the production DB server's clock is misconfigured (stores instants 7h
// early) and the Prisma driver's read path shifts them 7h forward again, so
// values are only correct AFTER they cross the driver. SQL-side DATE_TRUNC
// operates on the raw (shifted) values and lands sales on the wrong day.
export function bangkokBucketStart(date: Date, granularity: BangkokGranularity): Date {
  if (granularity === "hour") return bangkokHourStart(date)
  if (granularity === "month") return bangkokMonthStart(date)
  return bangkokDayStart(date)
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

// Fill gaps between time-series buckets with ฿0 rows. Without this a
// day/hour with no sales simply vanishes from the series and a line chart
// glides straight across it — reads as "steady sales" when it was actually a
// zero day. Hour/day steps are fixed-size (Thailand has no DST); months walk
// the Bangkok calendar. Rows must be sorted ascending by bucket.
export function zeroFillBuckets(
  rows: { bucket: Date; total: number; count: number }[],
  granularity: BangkokGranularity,
): { bucket: Date; total: number; count: number }[] {
  if (rows.length === 0) return rows
  const byTime = new Map(rows.map((r) => [r.bucket.getTime(), r]))
  const last = rows[rows.length - 1].bucket.getTime()
  const out: { bucket: Date; total: number; count: number }[] = []
  if (granularity === "month") {
    let cur = rows[0].bucket
    while (cur.getTime() <= last) {
      out.push(byTime.get(cur.getTime()) ?? { bucket: cur, total: 0, count: 0 })
      const ym = new Intl.DateTimeFormat("en-CA", {
        timeZone: BANGKOK_TZ,
        year: "numeric",
        month: "2-digit",
      }).format(cur)
      const [y, m] = ym.split("-").map(Number)
      const nextY = m === 12 ? y + 1 : y
      const nextM = m === 12 ? 1 : m + 1
      cur = new Date(`${nextY}-${String(nextM).padStart(2, "0")}-01T00:00:00.000${BANGKOK_UTC_OFFSET}`)
    }
  } else {
    const stepMs = granularity === "hour" ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000
    for (let ts = rows[0].bucket.getTime(); ts <= last; ts += stepMs) {
      out.push(byTime.get(ts) ?? { bucket: new Date(ts), total: 0, count: 0 })
    }
  }
  return out
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
