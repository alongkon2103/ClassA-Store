export type WebAnnouncementInput = {
  title: string
  content: string
  imageUrl: string | null
  startsAt: string
  endsAt: string | null
  enabled: boolean
}
export type WebAnnouncement = WebAnnouncementInput & {
  id: string
  revision: string
  createdAt: string
  updatedAt: string
}
export type AnnouncementStatus = "draft" | "scheduled" | "active" | "expired"

export function announcementStatus(a: WebAnnouncementInput, now = Date.now()): AnnouncementStatus {
  if (!a.enabled) return "draft"
  if (Date.parse(a.startsAt) > now) return "scheduled"
  if (a.endsAt && Date.parse(a.endsAt) <= now) return "expired"
  return "active"
}

export function nextAnnouncementChange(items: WebAnnouncementInput[], now = Date.now()): string | null {
  const dates = items.filter((a) => a.enabled).flatMap((a) => [a.startsAt, a.endsAt]).filter((d): d is string => !!d && Date.parse(d) > now)
  return dates.sort((a, b) => Date.parse(a) - Date.parse(b))[0] ?? null
}

export function toBangkokInput(iso: string): string {
  return new Date(Date.parse(iso) + 7 * 3600_000).toISOString().slice(0, 19)
}

export function fromBangkokInput(local: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(local)) return null
  const date = new Date(`${local}+07:00`)
  if (!Number.isFinite(date.getTime())) return null
  const normalized = local.length === 16 ? `${local}:00` : local
  return toBangkokInput(date.toISOString()) === normalized ? date.toISOString() : null
}
