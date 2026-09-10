import { requireUser } from "@/lib/requireUser"
import { setRequestLocale } from "next-intl/server"
import AccountFrame from "@/components/account/AccountFrame"
import { getPointsSummary } from "@/lib/points"
import CoinsClient from "./CoinsClient"

export const dynamic = "force-dynamic"

// Coins ของฉัน = ยอด AC Points + กติกาการได้แต้ม + ประวัติ (เฟส 1 ยังไม่มีการแลก)
export default async function CoinsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  const { userId } = await requireUser(locale)
  const summary = await getPointsSummary(userId, { entries: 100 })

  return (
    <AccountFrame active="coins">
      <CoinsClient summary={summary} />
    </AccountFrame>
  )
}
