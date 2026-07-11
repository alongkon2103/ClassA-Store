import { redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import AffiliateDashboard from "./AffiliateDashboard"

export const dynamic = "force-dynamic"

export default async function AffiliatePage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect("/login")

  // Gate on actually having an affiliate profile (role may lag; the profile is
  // the source of truth for "is this person an affiliate").
  const profile = await prisma.affiliate_profiles.findUnique({
    where: { user_id: session.user.id },
    select: { user_id: true },
  })
  if (!profile) redirect("/")

  return <AffiliateDashboard />
}
