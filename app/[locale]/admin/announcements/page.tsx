import { setRequestLocale } from "next-intl/server"
import { requireAdminPage } from "@/lib/adminAuth"
import { listWebAnnouncements } from "@/lib/webAnnouncementStore"
import AnnouncementsClient from "./AnnouncementsClient"
import type { WebAnnouncement } from "@/lib/webAnnouncements"

export const dynamic = "force-dynamic"

export default async function WebsiteAnnouncementsPage({ params }: { params: Promise<{ locale: string }> }) {
  await requireAdminPage()
  const { locale } = await params
  setRequestLocale(locale)
  let items: WebAnnouncement[] = []
  let initialError = false
  try { items = await listWebAnnouncements() }
  catch { initialError = true }
  return <AnnouncementsClient initialItems={items} initialError={initialError} />
}
