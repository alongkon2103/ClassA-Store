// ตรวจ body ของ API โปรเจค — กันของแปลก/ใหญ่เกินก่อนลง DB
import type { Prisma } from "@prisma/client"

const ORIENTATIONS = new Set(["portrait", "landscape"])
const MAX_JSON_BYTES = 2 * 1024 * 1024 // รูปเป็น URL ไม่ใช่ data URL — 2MB เหลือเฟือ
const MAX_THUMB_BYTES = 300 * 1024

export function parseProjectBody(body: unknown):
  | { data: { name: string; orientation: string; canvas_json: Prisma.InputJsonValue; thumbnail: string | null; product_id: string | null } }
  | { error: string } {
  if (!body || typeof body !== "object") return { error: "invalid_body" }
  const b = body as Record<string, unknown>

  const name = typeof b.name === "string" ? b.name.trim().slice(0, 80) : ""
  if (!name) return { error: "invalid_name" }

  const orientation = typeof b.orientation === "string" && ORIENTATIONS.has(b.orientation) ? b.orientation : "portrait"

  if (!b.canvas_json || typeof b.canvas_json !== "object") return { error: "invalid_canvas" }
  const json = JSON.stringify(b.canvas_json)
  if (json.length > MAX_JSON_BYTES) return { error: "canvas_too_large" }
  if (json.includes("data:image")) return { error: "data_url_not_allowed" }

  let thumbnail: string | null = null
  if (typeof b.thumbnail === "string" && b.thumbnail.startsWith("data:image/")) {
    if (b.thumbnail.length > MAX_THUMB_BYTES) return { error: "thumbnail_too_large" }
    thumbnail = b.thumbnail
  }

  const product_id = typeof b.product_id === "string" && /^[0-9a-f-]{36}$/i.test(b.product_id) ? b.product_id : null

  return { data: { name, orientation, canvas_json: b.canvas_json as Prisma.InputJsonValue, thumbnail, product_id } }
}
