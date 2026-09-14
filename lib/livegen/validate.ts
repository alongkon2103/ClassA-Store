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

/** path รูปที่อัปโหลดผ่าน /api/admin/upload (ขึ้นต้น /uploads/) · อย่างอื่น = null */
export function uploadPath(v: unknown): string | null {
  const s = typeof v === "string" ? v.trim() : ""
  return s.startsWith("/uploads/") && !s.includes("..") && s.length <= 300 ? s : null
}

/** body ของ admin ตอนเพิ่มเท็มเพลต: image = รูปที่อัปโหลดผ่าน /api/admin/upload · canvas = ใช้กติกาเดียวกับโปรเจค */
export function parseTemplateBody(body: unknown):
  | { data: { name: string; kind: "image" | "canvas"; orientation: string; image_url: string | null; canvas_json?: Prisma.InputJsonValue; thumbnail: string | null; cover_url: string | null } }
  | { error: string } {
  if (!body || typeof body !== "object") return { error: "invalid_body" }
  const b = body as Record<string, unknown>
  if (b.kind === "canvas") {
    const p = parseProjectBody(b)
    if ("error" in p) return p
    return { data: { name: p.data.name, kind: "canvas", orientation: p.data.orientation, image_url: null, canvas_json: p.data.canvas_json, thumbnail: p.data.thumbnail, cover_url: uploadPath(b.cover_url) } }
  }
  if (b.kind !== "image") return { error: "invalid_kind" }
  const name = typeof b.name === "string" ? b.name.trim().slice(0, 80) : ""
  if (!name) return { error: "invalid_name" }
  const url = uploadPath(b.image_url)
  if (!url) return { error: "invalid_image" }
  const orientation = typeof b.orientation === "string" && ORIENTATIONS.has(b.orientation) ? b.orientation : "portrait"
  return { data: { name, kind: "image", orientation, image_url: url, thumbnail: null, cover_url: uploadPath(b.cover_url) } }
}
