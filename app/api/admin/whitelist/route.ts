import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { validateAdmin } from "@/lib/adminAuth"
import { addDays } from "date-fns"

export async function GET() {
    const adminCheck = await validateAdmin()
    if (!adminCheck.isValid) return adminCheck.response

    try {
        const whitelist = await prisma.user_whitelist_access.findMany({
            include: {
                products: {
                    select: {
                        id: true,
                        name_th: true,
                        name_en: true,
                        slug: true
                    }
                }
            },
            orderBy: {
                updated_at: 'desc'
            }
        })

        return NextResponse.json(whitelist)
    } catch (error) {
        console.error("[WHITELIST_GET]", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}

export async function POST(req: Request) {
    const adminCheck = await validateAdmin()
    if (!adminCheck.isValid) return adminCheck.response

    try {
        const body = await req.json()
        const { ign, productId, isPremium, durationDays } = body

        if (!ign || !productId || durationDays === undefined) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
        }

        // Calculate expiration date
        // If durationDays is -1, set it to 100 years from now (permanent-like)
        let expiresAt: Date
        if (durationDays === -1) {
            expiresAt = addDays(new Date(), 365 * 100)
        } else {
            expiresAt = addDays(new Date(), durationDays)
        }

        const record = await prisma.user_whitelist_access.upsert({
            where: {
                ign_product_id: {
                    ign: ign,
                    product_id: productId
                }
            },
            update: {
                is_premium: isPremium,
                expires_at: expiresAt,
                updated_at: new Date()
            },
            create: {
                ign: ign,
                product_id: productId,
                is_premium: isPremium,
                expires_at: expiresAt
            }
        })

        return NextResponse.json(record)
    } catch (error) {
        console.error("[WHITELIST_POST]", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
