import { prisma } from "@/lib/prisma"
import { setRequestLocale } from "next-intl/server"
import WhitelistClient from "./WhitelistClient"

export default async function AdminWhitelistPage({
    params
}: {
    params: Promise<{ locale: string }>
}) {
    const { locale } = await params
    setRequestLocale(locale)

    // Initial data fetch
    const [whitelist, products, users, configs] = await Promise.all([
        prisma.user_whitelist_access.findMany({
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
        }),
        prisma.products.findMany({
            where: { is_active: true },
            select: {
                id: true,
                name_th: true,
                name_en: true,
                slug: true
            },
            orderBy: {
                name_en: 'asc'
            }
        }),
        prisma.users.findMany({
            select: {
                id: true,
                username: true,
                email: true,
                avatar: true
            },
            orderBy: {
                username: 'asc'
            }
        }),
        prisma.system_configs.findMany({
            where: {
                key: { in: ["free_trial_duration", "free_trial_is_premium"] }
            }
        })
    ])

    const configMap = configs.reduce((acc, curr) => {
        acc[curr.key] = curr.value
        return acc
    }, {} as Record<string, string>)

    return (
        <WhitelistClient 
            initialWhitelist={whitelist} 
            products={products} 
            users={users}
            config={configMap}
        />
    )
}
