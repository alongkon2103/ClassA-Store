import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
 
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await getServerSession(authOptions)
    if (session?.user?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const { id } = await params  // ← await params
    const { name, label_th, label_en, sort_order, default_gift_id } = await req.json()
    if (!name) return NextResponse.json({ error: "name required" }, { status: 400 })

    const fn = await prisma.product_functions.create({
        data: { 
            product_id: id, 
            name, 
            label_th: label_th ?? null, 
            label_en: label_en ?? null, 
            sort_order: sort_order ?? 0,
            default_gift_id: default_gift_id ?? null
        },
    })
    return NextResponse.json(fn, { status: 201 })
}