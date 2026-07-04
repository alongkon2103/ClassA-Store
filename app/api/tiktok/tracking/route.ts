import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"
import { authOptions } from "@/lib/auth"

const TIKTOK_SERVICE_URL = process.env.NEXT_PUBLIC_TIKTOK_API_URL || "http://localhost:4000"
const TIKTOK_SERVICE_KEY = process.env.NEXT_PUBLIC_TIKTOK_API_KEY || "test"

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

        const { username, cookie } = await req.json()
        if (!username) return NextResponse.json({ error: "Username required" }, { status: 400 })

        // Forward to tiktok-service
        const res = await fetch(`${TIKTOK_SERVICE_URL}/toggle`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-api-key": TIKTOK_SERVICE_KEY
            },
            body: JSON.stringify({ username, cookie })
        })

        const data = await res.json()
        if (!res.ok) {
            return NextResponse.json({ error: data.error || "Failed to toggle tracking" }, { status: res.status })
        }

        return NextResponse.json(data)
    } catch (error) {
        console.error("TikTok tracking error:", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url)
        const username = searchParams.get("username")

        const res = await fetch(`${TIKTOK_SERVICE_URL}/status`, {
            headers: { "x-api-key": TIKTOK_SERVICE_KEY }
        })

        const data = await res.json()
        if (!res.ok) return NextResponse.json({ error: "Failed to fetch status" }, { status: res.status })

        if (username) {
            const worker = data.workers.find((w: { username: string; status: string }) => w.username === username.toLowerCase())
            return NextResponse.json({ status: worker ? worker.status : "stopped" })
        }

        return NextResponse.json(data)
    } catch {
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
