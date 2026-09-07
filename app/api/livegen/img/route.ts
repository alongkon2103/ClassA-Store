// proxy รูปของขวัญที่อยู่บน CDN ของ TikTok — CDN ไม่ส่ง CORS header ทำให้ canvas โหลดแล้ว export ไม่ได้ (tainted)
// ดึงผ่านเซิร์ฟเวอร์เราแทน (อนุญาตเฉพาะโฮสต์ของ TikTok กันเอาไปใช้เป็น open proxy)
import { NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"
const ALLOWED = [/(^|\.)tiktokcdn\.com$/, /(^|\.)tiktokcdn-us\.com$/, /(^|\.)tiktokcdn-eu\.com$/, /(^|\.)tiktok\.com$/]
const MAX_BYTES = 5 * 1024 * 1024

export async function GET(req: NextRequest) {
  const u = req.nextUrl.searchParams.get("u") ?? ""
  let url: URL
  try { url = new URL(u) } catch { return NextResponse.json({ error: "bad_url" }, { status: 400 }) }
  if (url.protocol !== "https:" || !ALLOWED.some((re) => re.test(url.hostname))) {
    return NextResponse.json({ error: "host_not_allowed" }, { status: 400 })
  }

  const upstream = await fetch(url, { headers: { Accept: "image/*" }, next: { revalidate: 86400 } }).catch(() => null)
  if (!upstream || !upstream.ok) return NextResponse.json({ error: "upstream" }, { status: 502 })
  const type = upstream.headers.get("content-type") ?? ""
  if (!type.startsWith("image/")) return NextResponse.json({ error: "not_image" }, { status: 502 })
  const buf = Buffer.from(await upstream.arrayBuffer())
  if (buf.length > MAX_BYTES) return NextResponse.json({ error: "too_large" }, { status: 502 })

  return new NextResponse(buf, {
    headers: { "Content-Type": type, "Cache-Control": "public, max-age=86400, s-maxage=604800", "Access-Control-Allow-Origin": "*" },
  })
}
