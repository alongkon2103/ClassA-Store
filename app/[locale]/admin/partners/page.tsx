import { prisma } from "@/lib/prisma"
import { setRequestLocale } from "next-intl/server"
import PartnerManagerClient from "./PartnerManagerClient"

export default async function PartnerManagementPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)

  const partners = await prisma.partners.findMany({
    orderBy: { created_at: "desc" },
  })

  // Convert dates to strings for client component
  const safePartners = partners.map((p) => ({
    ...p,
    created_at: p.created_at?.toISOString() || "",
    updated_at: p.updated_at?.toISOString() || "",
  }))

  return <PartnerManagerClient initialPartners={safePartners} />
}
