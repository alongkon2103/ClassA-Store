// lib/gifts.ts
import { prisma } from "@/lib/prisma"

export async function createGiftIfNotExists(
  id: number,
  name: string,
  diamonds: number,
  image_url?: string | null,
  trigger_type?: string
) {
  const existing = await prisma.gifts.findUnique({ where: { id } })
  if (existing) return { gift: existing, created: false }

  const maxSort = await prisma.gifts.aggregate({ _max: { sort_order: true } })

  const gift = await prisma.gifts.create({
    data: {
      id,
      name,
      diamonds,
      image_url:    image_url ?? null,
      trigger_type: trigger_type ?? 'gift',
      is_active:    true,
      sort_order:   (maxSort._max.sort_order ?? 0) + 1,
    },
  })

  console.log(`[gift] created: id=${id} name="${name}" diamonds=${diamonds}`)
  return { gift, created: true }
}