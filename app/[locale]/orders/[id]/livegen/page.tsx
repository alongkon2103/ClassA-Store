import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"

// หน้าเดิม (ตัวประกอบการ์ดของออเดอร์) ถูกแทนด้วย editor ใหม่ — เปิดเกมของออเดอร์นั้นเป็นเท็มเพลต
export default async function LegacyOrderLiveGenPage({ params }: { params: Promise<{ id: string; locale: string }> }) {
  const { id, locale } = await params
  const order = await prisma.orders.findUnique({ where: { id }, select: { product_id: true } })
  redirect(order ? `/${locale}/livegen?game=${encodeURIComponent(order.product_id)}` : `/${locale}/livegen`)
}
