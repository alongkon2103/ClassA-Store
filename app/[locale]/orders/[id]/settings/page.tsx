// app/[locale]/orders/[id]/settings/page.tsx
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { notFound, redirect } from "next/navigation"
import { getLocale } from "next-intl/server"
import GameSettingsClient from "./GameSettingsClient"
import Navbar from "@/components/Navbar"
import Footer from "@/components/home/Footer"

export default async function GameSettingsPage({ params }: { params: Promise<{ id: string }> }) {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) redirect("/login")

    const { id } = await params  // ← await ก่อน

    const locale = await getLocale()

    const order = await prisma.orders.findUnique({
        where: { id },  // ← ใช้ id ที่ await แล้ว
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
        orderBy: { sort_order: "asc" },
    })

    const savedMapping: Record<string, number> = {}
    for (const ufg of order.user_function_gifts) {
        savedMapping[ufg.function_id] = ufg.gift_id
    }

    const productName = locale === "th"
        ? order.products.name_th
        : order.products.name_en

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
            locale={locale}
        />

      <Footer />
      </div>

    )
}