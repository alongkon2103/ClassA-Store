import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import AdminUpgradeDashboard from "./AdminUpgradeDashboard"

export default async function AdminUpgradePage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/login")
  if (session.user.role !== "admin") redirect("/")

  const upgrades = await prisma.premium_upgrades.findMany({
    orderBy: { upgraded_at: "desc" },
    select: {
      id: true,
      order_id: true,
      user_id: true,
      product_id: true,
      amount: true,
      payment_method: true,
      stripe_session_id: true,
      upgraded_at: true,
      orders: {
        select: {
          whitelisted_username: true,
          tiktok_username: true,
        },
      },
      users: {
        select: {
          username: true,
          email: true,
          avatar: true,
        },
      },
      products: {
        select: {
          name_th: true,
          name_en: true,
        },
      },
    },
  })

  const serialized = upgrades.map((u) => ({
    ...u,
    amount: Number(u.amount),
    upgraded_at: u.upgraded_at.toISOString(),
  }))

  return <AdminUpgradeDashboard upgrades={serialized} />
}