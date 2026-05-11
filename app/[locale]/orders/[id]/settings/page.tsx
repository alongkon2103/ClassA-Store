// app/[locale]/orders/[id]/settings/page.tsx
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { notFound, redirect } from "next/navigation"
import { getLocale } from "next-intl/server"
import GameSettingsClient from "./GameSettingsClient"
import Navbar from "@/components/Navbar"
import Footer from "@/components/home/Footer"

type Props = {
    params: Promise<{ id: string }>
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export default async function GameSettingsPage({ params }: Props) {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) redirect("/login")

    const { id } = await params

    if (!UUID_REGEX.test(id)) notFound()

    const locale = await getLocale()

    const order = await prisma.orders.findUnique({
        where: { id },
        include: {
            products: {
                include: {
                    product_functions: { orderBy: { sort_order: "asc" } },
                },
            },
            user_function_gifts: {
                include: { gifts: true },
            },
        },
    })

    if (!order || order.user_id !== session.user.id || order.status !== "paid") {
        notFound()
    }

    const gifts = await prisma.gifts.findMany({
        where: { is_active: true },
        orderBy: { diamonds: "asc" },
    })

    const savedMapping: Record<string, number> = {}
    for (const ufg of order.user_function_gifts) {
        savedMapping[ufg.function_id] = ufg.gift_id
    }

    const productName = locale === "th" ? order.products.name_th : order.products.name_en

    return (
        <div>
            <Navbar />
            <GameSettingsClient
                orderId={order.id}
                productName={productName}
                whitelistedUsername={order.whitelisted_username}
                functions={order.products.product_functions}
                gifts={gifts}
                savedMapping={savedMapping}
                savedTiktokUsername={order.tiktok_username}
                locale={locale}
            />
            <Footer />
        </div>
    )
}