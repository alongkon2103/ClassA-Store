// app/admin/gifts/page.tsx

import GiftManagerAdmin from "./GiftManagerAdmin"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export default async function GiftsAdminPage() {
  const gifts = await prisma.gifts.findMany({
    orderBy: [
      { sort_order: "asc" },
      { id: "asc" },
    ],
  })

  const initialGifts = gifts.map((gift) => ({
    id: gift.id,
    name: gift.name,
    image_url: gift.image_url,
    diamonds: gift.diamonds,
    is_active: gift.is_active,
    sort_order: gift.sort_order,
  }))

  return (
    <div className="p-6">
      <GiftManagerAdmin initialGifts={initialGifts} />
    </div>
  )
}