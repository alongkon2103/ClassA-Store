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
  
  const [users, pendingGrants] = await Promise.all([
    prisma.users.findMany({
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
        nativeExpiry: true,
        _count: { select: { orders: true } },
      },
    }),
    // Whitelist granted to an email that hasn't logged into the program yet.
    prisma.desktop_whitelist_grants.findMany({ orderBy: { created_at: "desc" } }),
  ])

  // Serialize dates for the Client Component boundary.
  const usersOut = users.map((u) => ({
    ...u,
    lastSeen: u.lastSeen ? u.lastSeen.toISOString() : null,
    nativeExpiry: u.nativeExpiry ? u.nativeExpiry.toISOString() : null,
  }))
  const grantsOut = pendingGrants.map((g) => ({
    id: g.id,
    email: g.email,
    expires_at: g.expires_at.toISOString(),
    created_at: g.created_at.toISOString(),
  }))

  return <DesktopUsersClient users={usersOut} pendingGrants={grantsOut} />
}
