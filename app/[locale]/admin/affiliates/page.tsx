import { redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import AffiliatesClient from "./AffiliatesClient"

export const dynamic = "force-dynamic"

export default async function AffiliatesAdminPage() {
  // Admin-only (the API enforces it too; this stops a partnership user from
  // loading the shell via direct URL).
  const session = await getServerSession(authOptions)
  if (!session?.user || session.user.role !== "admin") redirect("/")

  return <AffiliatesClient />
}
