
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
    try {
        const session = await getServerSession(authOptions)
        if (session?.user?.role !== "admin") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const configs = await prisma.system_configs.findMany()
        const configMap = configs.reduce((acc, curr) => {
            acc[curr.key] = curr.value
            return acc
        }, {} as Record<string, string>)

        return NextResponse.json(configMap)
    } catch (error) {
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions)
        if (session?.user?.role !== "admin") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const body = await req.json()
        
        // Support bulk update if body is an array or object of key-values
        if (Array.isArray(body)) {
            for (const item of body) {
                if (item.key) {
                    await prisma.system_configs.upsert({
                        where: { key: item.key },
                        update: { value: String(item.value) },
                        create: { key: item.key, value: String(item.value) },
                    })
                }
            }
        } else if (body.configs && typeof body.configs === 'object') {
            // Support { configs: { key1: val1, key2: val2 } }
            for (const [key, value] of Object.entries(body.configs)) {
                await prisma.system_configs.upsert({
                    where: { key },
                    update: { value: String(value) },
                    create: { key, value: String(value) },
                })
            }
        } else {
            // Original single key logic
            const { key, value } = body
            if (!key) {
                return NextResponse.json({ error: "Key is required" }, { status: 400 })
            }
            await prisma.system_configs.upsert({
                where: { key },
                update: { value: String(value) },
                create: { key, value: String(value) },
            })
        }

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error("Config save error:", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
