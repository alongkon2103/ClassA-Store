// ใช้ในหน้า server component ที่ต้องล็อกอิน (บัญชี/ออเดอร์) — ไม่ล็อกอินเด้งไปหน้า login
import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth"

export async function requireUser(locale: string) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect(`/${locale}/login`)
  return { userId: session.user.id, session }
}
