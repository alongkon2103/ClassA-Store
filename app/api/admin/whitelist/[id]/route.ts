import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { validateAdmin } from "@/lib/adminAuth"

export async function DELETE(
    req: NextRequest, // Updated to NextRequest
    { params }: { params: Promise<{ id: string }> } // Updated to Promise type
) {
    const adminCheck = await validateAdmin()
    if (!adminCheck.isValid) return adminCheck.response

    try {
        // This is perfect, now TypeScript knows it's a Promise and can be awaited properly
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