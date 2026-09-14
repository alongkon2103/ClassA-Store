import { requireUser } from "@/lib/requireUser"
import { setRequestLocale } from "next-intl/server"
import AccountFrame from "@/components/account/AccountFrame"
import { getPointsBalance, getPointsConfig, pointsActive } from "@/lib/points"
import { latestIgn, listRedemptions, listRewards } from "@/lib/pointsRedeem"
import RedeemClient from "./RedeemClient"

export const dynamic = "force-dynamic"

// แลกของรางวัล = รายการที่แอดมินเปิด + ยอดแต้ม + ประวัติการแลก · IGN ล่าสุดของแต่ละเกม Roblox เติมให้ก่อนในช่องกรอก
export default async function RedeemPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  const { userId } = await requireUser(locale)
  const [cfg, balance, rewards, history] = await Promise.all([getPointsConfig(), getPointsBalance(userId), listRewards(userId), listRedemptions(userId, 50)])
  const robloxGames = [...new Set(rewards.filter((r) => r.kind === "game_days" && r.product && r.product.type !== "desktop_program").map((r) => r.product!.id))]
  const ignHints = Object.fromEntries(await Promise.all(robloxGames.map(async (id) => [id, await latestIgn(userId, id)] as const)))

  return (
    <AccountFrame active="redeem">
      <RedeemClient active={pointsActive(cfg)} balance={balance} rewards={rewards} history={history} ignHints={ignHints} />
    </AccountFrame>
  )
}
