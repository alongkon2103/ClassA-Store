import { prisma } from "@/lib/prisma"
import AnnouncementsClient from "./AnnouncementsClient"
import { setRequestLocale } from "next-intl/server"

export default async function AdminAnnouncementsPage({
  params
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  
  const announcements = await prisma.announcements.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      users: { select: { username: true } }
    }
  })

  return <AnnouncementsClient announcements={announcements} />
}
