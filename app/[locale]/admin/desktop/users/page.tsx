import { prisma } from "@/lib/prisma"
import DesktopUsersClient from "./DesktopUsersClient"
import { setRequestLocale } from "next-intl/server"

export default async function AdminDesktopUsersPage({
  params
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  
  const users = await prisma.users.findMany({
    orderBy: { lastSeen: "desc" },
    select: {
      id: true,
      username: true,
      email: true,
      avatar: true,
      role: true,
      hwid: true,
      lastSeen: true,
      isOnlineDesktop: true,
      nativeStatus: true,
      _count: { select: { orders: true } },
    },
  })

  return <DesktopUsersClient users={users} />
}
