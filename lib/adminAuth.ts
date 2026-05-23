import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { NextResponse } from "next/server"

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
