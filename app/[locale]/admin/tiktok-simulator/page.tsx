// app/[locale]/admin/tiktok-simulator/page.tsx
import { prisma } from "@/lib/prisma"
import TikTokSimulator from "./TikTokSimulator"

export default async function TikTokSimulatorPage() {
    const gifts = await prisma.gifts.findMany({
        where: { is_active: true },
        orderBy: { sort_order: "asc" },
    })

    return <TikTokSimulator gifts={gifts} />
}