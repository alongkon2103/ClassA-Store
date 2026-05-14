import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { NextResponse } from "next/server"

/**
 * Validates if the current session belongs to an admin.
 * Returns the session if valid, otherwise returns a NextResponse error.
 */
export async function validateAdmin() {
    const session = await getServerSession(authOptions)

    if (!session || !session.user || session.user.role !== "admin") {
        return {
            isValid: false,
            response: NextResponse.json({ error: "Unauthorized: Admin access required" }, { status: 403 })
        }
    }

    return {
        isValid: true,
        session
    }
}
