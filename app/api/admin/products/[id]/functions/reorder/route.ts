// app/api/admin/products/[id]/functions/reorder/route.ts
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await getServerSession(authOptions)
    if (session?.user?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const items: { id: string; sort_order: number }[] = await req.json()
    await prisma.$transaction(
        items.map(({ id, sort_order }) =>
            prisma.product_functions.update({ where: { id }, data: { sort_order } })
        )
    )
    return NextResponse.json({ ok: true })
}