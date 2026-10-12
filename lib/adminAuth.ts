import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { NextResponse } from "next/server"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"

/**
 * Validates if the current session belongs to an authorized role.
 * Returns the session if valid, otherwise returns a NextResponse error.
 */
export async function validateAdmin(allowedRoles: string[] = ["admin", "partnership"]) {
    const session = await getServerSession(authOptions)

    if (!session || !session.user || !allowedRoles.includes(session.user.role)) {
        return {
            isValid: false,
            response: NextResponse.json({ error: "Unauthorized: Access denied" }, { status: 403 })
        }
    }

    return {
        isValid: true,
        session
    }
}

/**
 * validateAdmin() plus the ownership rule of /api/admin/products/[id]:
 * "partnership" may only touch products they created.
 */
export async function validateProductEditor(productId: string) {
    const admin = await validateAdmin()
    if (!admin.isValid || admin.session?.user.role !== "partnership") return admin

    const product = await prisma.products.findUnique({
        where: { id: productId },
        select: { created_by_id: true }
    })
    if (!product || product.created_by_id !== admin.session.user.id) {
        return {
            isValid: false,
            response: NextResponse.json({ error: "Forbidden: You can only edit your own products" }, { status: 403 })
        }
    }
    return admin
}

/**
 * Role check for admin pages. The admin layout's check is not enough on its own:
 * layouts don't re-render on client navigation, so every page that loads data
 * must check for itself.
 */
export async function requireAdminPage(allowedRoles: string[] = ["admin"]) {
    const session = await getServerSession(authOptions)
    if (!session?.user || !allowedRoles.includes(session.user.role)) redirect("/")
    return session
}
