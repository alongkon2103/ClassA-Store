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
                    product_functions: {
                        orderBy: { sort_order: "asc" },
                    },
                    product_variants: true, // ดึง variants ของ product นี้มาด้วย
                },
            },
            user_function_gifts: {
                include: {
                    gifts: true,
                },
            },
            product_variants: true, // variant ที่ถูกเลือกใน order (ถ้ามี)
        },
    })

    if (
        !order ||
        order.user_id !== session.user.id ||
        (order.status !== "paid" && order.status !== "Admin Buy")
    ) {
        notFound()
    }
    // หา variant_type = "premium" จาก products.product_variants
    const premiumAddonPrice = Number(
        order.products?.product_variants?.find(
            (variant) => variant.variant_type === "premium"
        )?.premium_addon_price ?? 0
    )

    const gifts = await prisma.gifts.findMany({
        where: { is_active: true },
        orderBy: { diamonds: "asc" },
    })

    // Pass the raw UFG rows so the client can render active/standby pools
    // with multiple gifts per function (matches Electron InteractiveMapping).
    const savedMappings = order.user_function_gifts.map((ufg) => ({
        id: ufg.id,
        function_id: ufg.function_id,
        gift_id: ufg.gift_id,
        is_enabled: ufg.is_enabled,
        trigger_threshold: ufg.trigger_threshold,
        gifts: ufg.gifts,
    }))

    const downloadConfigs = await prisma.system_configs.findMany({
        where: { key: { in: ["app_download_url", "app_download_name"] } },
    })
    const downloadConfigMap = Object.fromEntries(downloadConfigs.map(c => [c.key, c.value]))

    const productName = locale === "th" ? order.products.name_th : order.products.name_en

    return (
        <div>
            <Navbar />
            <GameSettingsClient
                orderId={order.id}
                orderType={order.order_type}
                expiresAt={order.expires_at?.toISOString()}
                productName={productName}
                productSlug={order.products.slug}
                whitelistedUsername={order.whitelisted_username}
                tutorialVideoUrl={order.products.tutorial_video_url}
                functions={order.products.product_functions}
                gifts={gifts}
                savedMappings={savedMappings}
                savedTiktokUsername={order.tiktok_username}
                locale={locale}
                isPremium={!!order.is_premium_order}
                premiumAddonPrice={premiumAddonPrice}
                downloadUrl={downloadConfigMap["app_download_url"] ?? null}
                downloadName={downloadConfigMap["app_download_name"] ?? null}

            />
            <Footer />
        </div>
    )
}