import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getHalloweenState } from "@/lib/halloweenDraw"
import { halloweenFailure, halloweenHeaders } from "@/lib/halloweenHttp"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    return NextResponse.json(await getHalloweenState(session?.user?.id ?? null), { headers: halloweenHeaders })
  } catch (error) { return halloweenFailure(error) }
}

export async function POST() {
  return NextResponse.json({ error: "ended" }, { status: 410, headers: halloweenHeaders })
}
