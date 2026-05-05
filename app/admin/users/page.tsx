import { prisma } from "@/lib/prisma"
import UsersClient from "./UsersClient"

export default async function AdminUsersPage() {
  const users = await prisma.users.findMany({
    orderBy: { created_at: "desc" },
    include: {
      _count: { select: { orders: true } },
      accounts: { select: { provider: true } },
    },
  })

  return <UsersClient users={users} />
}