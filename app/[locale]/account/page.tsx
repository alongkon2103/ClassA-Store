import { prisma } from "@/lib/prisma"
import { requireUser } from "@/lib/requireUser"
import { setRequestLocale } from "next-intl/server"
import AccountFrame from "@/components/account/AccountFrame"
import AccountInfoClient from "./AccountInfoClient"

export const dynamic = "force-dynamic"

export default async function AccountPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  const { userId, session } = await requireUser(locale)

  const [user, orders, favorites, reviews] = await Promise.all([
    prisma.users.findUnique({
      where: { id: userId },
      select: { username: true, email: true, avatar: true, role: true, created_at: true },
    }),
    prisma.orders.count({ where: { user_id: userId, status: "paid" } }),
    prisma.product_favorites.count({ where: { user_id: userId, saved: true } }),
    prisma.product_reviews.count({ where: { user_id: userId } }),
  ])

  return (
    <AccountFrame active="account">
      <AccountInfoClient
        user={{
          username: user?.username ?? session.user.name ?? "",
          email: user?.email ?? session.user.email ?? null,
          avatar: user?.avatar ?? session.user.image ?? null,
          role: String(user?.role ?? "user"),
          created_at: user?.created_at?.toISOString() ?? null,
        }}
        provider={session.user.provider ?? null}
        stats={{ orders, favorites, reviews }}
      />
    </AccountFrame>
  )
}
