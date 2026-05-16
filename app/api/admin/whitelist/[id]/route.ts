import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { validateAdmin } from "@/lib/adminAuth"

export async function DELETE(
    req: Request,
    { params }: { params: { id: string } }
) {
    const adminCheck = await validateAdmin()
    if (!adminCheck.isValid) return adminCheck.response

    try {
        const { id } = await params

        await prisma.user_whitelist_access.delete({
            where: { id }
        })

        return NextResponse.json({ message: "Whitelist record deleted successfully" })
    } catch (error) {
        console.error("[WHITELIST_DELETE]", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
