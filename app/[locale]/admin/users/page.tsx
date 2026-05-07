import { prisma } from "@/lib/prisma"
import UsersClient from "./UsersClient"
import { setRequestLocale } from "next-intl/server"

export default async function AdminUsersPage({
  params
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const users = await prisma.users.findMany({
    orderBy: { created_at: "desc" },
    include: {
      _count: { select: { orders: true } },
      accounts: { select: { provider: true } },
    },
  })

  return <UsersClient users={users} />
}