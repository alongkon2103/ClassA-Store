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
  
  const [users, pendingGrants, programs, access] = await Promise.all([
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
        _count: { select: { orders: true } },
      },
    }),
    // Pending grants for emails that haven't logged in yet (per program).
    prisma.desktop_whitelist_grants.findMany({ orderBy: { created_at: "desc" } }),
    // Desktop_program products to pick which program to manage.
    prisma.products.findMany({
      where: { type: "desktop_program" },
      orderBy: { created_at: "asc" },
      select: { id: true, name_en: true, name_th: true, program_key: true },
    }),
    // Every per-(user, product) entitlement, filtered client-side by program.
    prisma.user_program_access.findMany({ select: { user_id: true, product_id: true, status: true, expires_at: true } }),
  ])

  // Serialize for the Client Component boundary.
  const usersOut = users.map((u) => ({ ...u, lastSeen: u.lastSeen ? u.lastSeen.toISOString() : null }))
  const grantsOut = pendingGrants.map((g) => ({
    id: g.id, email: g.email, product_id: g.product_id,
    expires_at: g.expires_at.toISOString(), created_at: g.created_at.toISOString(),
  }))
  const accessOut = access.map((a) => ({
    user_id: a.user_id, product_id: a.product_id, status: a.status, expires_at: a.expires_at.toISOString(),
  }))

  return <DesktopUsersClient users={usersOut} pendingGrants={grantsOut} programs={programs} access={accessOut} />
}
