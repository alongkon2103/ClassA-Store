import { redirect } from "next/navigation"

// หน้าเดิม (ตัวประกอบการ์ดฟังก์ชันต่อเกม) ถูกแทนด้วย editor ใหม่ — เปิดเกมนั้นเป็นเท็มเพลตแทน
export default async function LegacyLiveGenProductPage({ params }: { params: Promise<{ productId: string; locale: string }> }) {
  const { productId, locale } = await params
  redirect(`/${locale}/livegen?game=${encodeURIComponent(productId)}`)
}
