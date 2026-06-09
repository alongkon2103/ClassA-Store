import { NextResponse } from "next/server"
import { lookupRobloxUser } from "@/lib/roblox"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  const url      = new URL(req.url)
  const username = url.searchParams.get("username") ?? ""

  if (!username.trim()) {
    return NextResponse.json({ ok: false, reason: "invalid" }, { status: 400 })
  }

  const result = await lookupRobloxUser(username)
  return NextResponse.json(result)
}
