import { safeAnnouncementUrl, sanitizeAnnouncementHtml } from "./announcementHtml"
import type { WebAnnouncementInput } from "./webAnnouncements"

function isoDate(value: unknown): string | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return null
  const calendar = new Date(`${value.slice(0, 10)}T00:00:00Z`)
  if (!Number.isFinite(calendar.getTime()) || calendar.toISOString().slice(0, 10) !== value.slice(0, 10) || Number(value.slice(11, 13)) >= 24) return null
  const date = new Date(value)
  return Number.isFinite(date.getTime()) ? date.toISOString() : null
}

export function parseWebAnnouncement(body: unknown): { data: WebAnnouncementInput } | { error: string } {
  if (!body || typeof body !== "object") return { error: "invalid_body" }
  const b = body as Record<string, unknown>
  if (typeof b.title !== "string" || !b.title.trim() || b.title.trim().length > 200) return { error: "invalid_title" }
  if (typeof b.content !== "string" || b.content.length > 100_000) return { error: "invalid_content" }
  if (typeof b.enabled !== "boolean") return { error: "invalid_enabled" }
  const startsAt = isoDate(b.startsAt)
  const endsAt = b.endsAt == null || b.endsAt === "" ? null : isoDate(b.endsAt)
  if (!startsAt || (b.endsAt != null && b.endsAt !== "" && !endsAt)) return { error: "invalid_dates" }
  if (endsAt && endsAt <= startsAt) return { error: "invalid_range" }
  const imageUrl = b.imageUrl == null || b.imageUrl === "" ? null : safeAnnouncementUrl(b.imageUrl)
  if (b.imageUrl != null && b.imageUrl !== "" && !imageUrl) return { error: "invalid_image" }
  const content = sanitizeAnnouncementHtml(b.content)
  if (content.length > 100_000) return { error: "invalid_content" }
  return { data: { title: b.title.trim(), content, imageUrl, startsAt, endsAt, enabled: b.enabled } }
}
