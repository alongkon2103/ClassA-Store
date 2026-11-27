export type FunctionCategory = "help" | "troll" | "neutral"
export type FunctionSection = FunctionCategory | "unclassified"
export type FunctionDraft = {
  name: string
  label_th: string
  label_en: string
  image_url: string
  category: FunctionCategory | ""
  default_gift_id: number | null
  default_trigger_threshold: string
}
export const LIKE_THRESHOLDS = [15, 30, 45, 60, 75, 90, 105]
export const BULK_LIMIT = 100
export const IMAGE_ACCEPT = ".png,.jpg,.jpeg,.webp,.gif"
export function categoryOf(item: { category?: string | null }): FunctionSection {
  return item.category === "help" || item.category === "troll" || item.category === "neutral" ? item.category : "unclassified"
}
export function normalizeName(name: string) { return name.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase() }
export function inferFunction(filename: string) {
  const stem = filename.replace(/\.[^.]+$/, "").trim()
  const label = stem.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 200)
  return { name: stem.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 120), label_th: label, label_en: label }
}
export function moveWithinCategory<T extends { id: string; sort_order: number; category?: string | null }>(items: T[], id: string, direction: -1 | 1): T[] {
  const index = items.findIndex(item => item.id === id)
  if (index < 0) return items
  const group = categoryOf(items[index]), slots = items.map((item, i) => categoryOf(item) === group ? i : -1).filter(i => i >= 0)
  const target = slots[slots.indexOf(index) + direction]
  if (target === undefined) return items
  const next = [...items]
  ;[next[index], next[target]] = [next[target], next[index]]
  return next.map((item, sort_order) => ({ ...item, sort_order }))
}
export type FormError = "nameRequired" | "nameLong" | "labelLong" | "giftMissing" | "thresholdInvalid" | "thresholdLike" | "imageInvalid"
export function validateFunction(form: FunctionDraft, gifts: { id: number; trigger_type: string | null }[]): FormError | null {
  if (!form.name.trim()) return "nameRequired"
  if (form.name.trim().length > 120 || /[\u0000-\u001f\u007f]/.test(form.name)) return "nameLong"
  if (form.label_th.trim().length > 200 || form.label_en.trim().length > 200) return "labelLong"
  const image = form.image_url.trim()
  if (image) {
    if (image.length > 2048 || /[\u0000-\u0020\u007f]/.test(image) || image.includes("\\") || image.startsWith("/") && image.split(/[?#]/)[0].split("/").includes("..")) return "imageInvalid"
    if (!/^\/(?!\/)/.test(image)) {
      try { const url = new URL(image); if (url.protocol !== "https:" || url.username || url.password) return "imageInvalid" } catch { return "imageInvalid" }
    }
  }
  const gift = gifts.find(item => item.id === form.default_gift_id)
  if (form.default_gift_id !== null && !gift) return "giftMissing"
  if (form.default_trigger_threshold !== "") {
    const value = Number(form.default_trigger_threshold)
    if (!/^\d+$/.test(form.default_trigger_threshold) || !Number.isSafeInteger(value) || value < 1 || value > 10000) return "thresholdInvalid"
    if (gift?.trigger_type?.toLowerCase() === "like" && !LIKE_THRESHOLDS.includes(value)) return "thresholdLike"
  }
  return null
}
export function validateImage(file: { name: string; type: string; size: number }): "imageType" | "imageSize" | null {
  if (!/\.(png|jpe?g|webp|gif)$/i.test(file.name) || file.type && !["image/png", "image/jpeg", "image/webp", "image/gif"].includes(file.type)) return "imageType"
  return file.size > 5 * 1024 * 1024 ? "imageSize" : null
}
export function functionPayload(form: FunctionDraft) {
  return { name: form.name.trim(), label_th: form.label_th.trim() || null, label_en: form.label_en.trim() || null, image_url: form.image_url.trim() || null, ...(form.category ? { category: form.category } : {}), default_gift_id: form.default_gift_id, default_trigger_threshold: form.default_trigger_threshold === "" ? null : Number(form.default_trigger_threshold) }
}
