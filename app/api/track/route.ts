import { NextResponse } from "next/server"
import { cookies, headers } from "next/headers"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { randomUUID } from "crypto"

const VISITOR_COOKIE = "vid"
const VISITOR_COOKIE_MAX_AGE = 60 * 60 * 24 * 365
const DEDUP_WINDOW_MS = 30 * 60 * 1000

const BOT_UA = /bot|crawler|spider|crawling|preview|slurp|facebookexternalhit|whatsapp|telegrambot|discordbot|googlebot|bingbot|baiduspider/i

const recentMemory = new Map<string, number>()
const MEMORY_THROTTLE_MS = 5_000

function pickDevice(ua: string): string {
  if (/mobile|iphone|ipod|android.*mobile/i.test(ua)) return "mobile"
  if (/ipad|tablet|android(?!.*mobile)/i.test(ua)) return "tablet"
  return "desktop"
}

function sanitizePath(raw: string): string | null {
  if (!raw || typeof raw !== "string") return null
  const trimmed = raw.split("?")[0].split("#")[0]
  if (!trimmed.startsWith("/")) return null
  if (trimmed.length > 512) return trimmed.slice(0, 512)
  return trimmed
}

function pruneMemory() {
  if (recentMemory.size < 5000) return
  const cutoff = Date.now() - MEMORY_THROTTLE_MS
  for (const [k, ts] of recentMemory) {
    if (ts < cutoff) recentMemory.delete(k)
  }
}

export async function POST(req: Request) {
  try {
    const hdrs = await headers()
    const ua = hdrs.get("user-agent") ?? ""
    if (BOT_UA.test(ua)) return new NextResponse(null, { status: 204 })

    const body = await req.json().catch(() => null)
    const path = sanitizePath(body?.path)
    if (!path) return new NextResponse(null, { status: 204 })
    if (path.startsWith("/api") || path.startsWith("/_next") || path.startsWith("/uploads") || path.startsWith("/admin")) {
      return new NextResponse(null, { status: 204 })
    }

    const referrer = typeof body?.referrer === "string" ? body.referrer.slice(0, 512) : null
    const localeIn = typeof body?.locale === "string" ? body.locale.slice(0, 8) : null

    const cookieStore = await cookies()
    let visitorId = cookieStore.get(VISITOR_COOKIE)?.value
    let shouldSetCookie = false
    if (!visitorId || visitorId.length > 64) {
      visitorId = randomUUID().replace(/-/g, "")
      shouldSetCookie = true
    }

    const memKey = `${visitorId}:${path}`
    const memTs = recentMemory.get(memKey)
    if (memTs && Date.now() - memTs < MEMORY_THROTTLE_MS) {
      return new NextResponse(null, { status: 204 })
    }
    recentMemory.set(memKey, Date.now())
    pruneMemory()

    const recent = await prisma.page_views.findFirst({
      where: {
        visitor_id: visitorId,
        path,
        created_at: { gte: new Date(Date.now() - DEDUP_WINDOW_MS) },
      },
      select: { id: true },
    })

    if (recent) {
      const res = new NextResponse(null, { status: 204 })
      if (shouldSetCookie) {
        res.cookies.set(VISITOR_COOKIE, visitorId, {
          maxAge: VISITOR_COOKIE_MAX_AGE,
          httpOnly: true,
          sameSite: "lax",
          path: "/",
        })
      }
      return res
    }

    const session = await getServerSession(authOptions)
    const country = hdrs.get("x-vercel-ip-country") ?? hdrs.get("cf-ipcountry") ?? null
    const device = pickDevice(ua)

    await prisma.page_views.create({
      data: {
        visitor_id: visitorId,
        user_id: session?.user?.id ?? null,
        path,
        referrer,
        country,
        device,
        locale: localeIn,
      },
    })

    const res = new NextResponse(null, { status: 204 })
    if (shouldSetCookie) {
      res.cookies.set(VISITOR_COOKIE, visitorId, {
        maxAge: VISITOR_COOKIE_MAX_AGE,
        httpOnly: true,
        sameSite: "lax",
        path: "/",
      })
    }
    return res
  } catch (err) {
    console.error("[/api/track] error:", err)
    return new NextResponse(null, { status: 204 })
  }
}
