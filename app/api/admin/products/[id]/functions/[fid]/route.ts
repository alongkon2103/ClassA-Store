import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
 
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string, fid: string }> }) {
    const session = await getServerSession(authOptions)
    if (session?.user?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const { fid } = await params  // ← await params
    const { name, label_th, label_en, default_gift_id } = await req.json()
    const fn = await prisma.product_functions.update({
        where: { id: fid },
        data: { 
            ...(name && { name }), 
            label_th: label_th ?? null, 
            label_en: label_en ?? null,
            default_gift_id: default_gift_id ?? null
        },
    })
    return NextResponse.json(fn)
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string, fid: string }> }) {
    const session = await getServerSession(authOptions)
    if (session?.user?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const { fid } = await params  // ← await params
    await prisma.product_functions.delete({ where: { id: fid } })
    return NextResponse.json({ ok: true })
}