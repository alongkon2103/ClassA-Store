import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { drawHalloween, getHalloweenState } from "@/lib/halloweenDraw"
import { halloweenBody, halloweenFailure, halloweenHeaders } from "@/lib/halloweenHttp"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    return NextResponse.json(await getHalloweenState(session?.user?.id ?? null), { headers: halloweenHeaders })
  } catch (error) { return halloweenFailure(error) }
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: halloweenHeaders })
  try {
    const body = await halloweenBody(req)
    if (Object.keys(body).length) throw new Error("invalid_input")
    return NextResponse.json({ draw: await drawHalloween(session.user.id) }, { headers: halloweenHeaders })
  } catch (error) { return halloweenFailure(error) }
}
