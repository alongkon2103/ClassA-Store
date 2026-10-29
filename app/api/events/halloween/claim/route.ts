import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { claimHalloween } from "@/lib/halloweenDraw"
import { halloweenBody, halloweenFailure, halloweenHeaders } from "@/lib/halloweenHttp"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: halloweenHeaders })
  try {
    const body = await halloweenBody(req)
    if (Object.keys(body).some(k => !["draw_id", "ign"].includes(k)) || typeof body.draw_id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.draw_id) || (body.ign !== undefined && body.ign !== null && (typeof body.ign !== "string" || body.ign.length > 20))) throw new Error("invalid_input")
    return NextResponse.json({ draw: await claimHalloween(session.user.id, body.draw_id, typeof body.ign === "string" ? body.ign : null) }, { headers: halloweenHeaders })
  } catch (error) { return halloweenFailure(error) }
}
