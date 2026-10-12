import { randomUUID } from "node:crypto"
import { prisma } from "@/lib/prisma"
import { parseWebAnnouncement } from "./webAnnouncementValidation"
import type { WebAnnouncement, WebAnnouncementInput } from "./webAnnouncements"

const PREFIX = "web_announcement:"
export const validAnnouncementId = (id: string) => /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(id)

function read(value: string): WebAnnouncement | null {
  try {
    const raw = JSON.parse(value)
    const result = parseWebAnnouncement(raw)
    if ("error" in result || !validAnnouncementId(raw.id) || typeof raw.revision !== "string" || !Number.isFinite(Date.parse(raw.createdAt)) || !Number.isFinite(Date.parse(raw.updatedAt))) return null
    return { ...result.data, id: raw.id, revision: raw.revision, createdAt: raw.createdAt, updatedAt: raw.updatedAt }
  } catch { return null }
}

export async function listWebAnnouncements(): Promise<WebAnnouncement[]> {
  // Website configuration lives in existing settings; one row per announcement
  // keeps edits independent and requires no change to desktop announcements.
  const rows = await prisma.system_configs.findMany({ where: { key: { startsWith: PREFIX } }, select: { value: true } })
  return rows.map((r) => read(r.value)).filter((a): a is WebAnnouncement => !!a).sort((a, b) => b.startsAt.localeCompare(a.startsAt))
}

export async function saveWebAnnouncement(input: WebAnnouncementInput, id?: string): Promise<WebAnnouncement | null> {
  const existing = id ? await prisma.system_configs.findUnique({ where: { key: PREFIX + id } }) : null
  if (id && !existing) return null
  const now = new Date().toISOString()
  const item: WebAnnouncement = { ...input, id: id ?? randomUUID(), revision: randomUUID(), createdAt: (existing && read(existing.value)?.createdAt) || now, updatedAt: now }
  const data = { value: JSON.stringify(item) }
  if (id) await prisma.system_configs.update({ where: { key: PREFIX + id }, data })
  else await prisma.system_configs.create({ data: { key: PREFIX + item.id, ...data } })
  return item
}

export async function deleteWebAnnouncement(id: string): Promise<boolean> {
  const result = await prisma.system_configs.deleteMany({ where: { key: PREFIX + id } })
  return result.count > 0
}
