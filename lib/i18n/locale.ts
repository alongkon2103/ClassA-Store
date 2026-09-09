// ตัวช่วยเรื่อง locale ที่ใช้ร่วมกันทุกหน้า (ลูกค้า): แท็ก Intl, locale ของ date-fns,
// และป้ายชื่อแพ็กเกจ (variant) สำหรับภาษาที่ไม่มีคอลัมน์ในฐานข้อมูล (ja/zh)
import { th, enUS, ja, zhCN } from "date-fns/locale"
import type { Locale as DateFnsLocale } from "date-fns"

export const LOCALE_TAGS: Record<string, string> = { th: "th-TH", en: "en-US", ja: "ja-JP", zh: "zh-CN" }
export const OG_LOCALES: Record<string, string> = { th: "th_TH", en: "en_US", ja: "ja_JP", zh: "zh_CN" }

/** แท็กสำหรับ Intl / toLocaleDateString ตาม locale ของ next-intl */
export function localeTag(locale: string): string {
  return LOCALE_TAGS[locale] ?? "en-US"
}

const DATE_FNS_LOCALES: Record<string, DateFnsLocale> = { th, en: enUS, ja, zh: zhCN }

/** locale ของ date-fns (format / formatDistanceToNow) */
export function dateFnsLocale(locale: string): DateFnsLocale {
  return DATE_FNS_LOCALES[locale] ?? enUS
}

/** วันที่แบบสั้นตาม locale — คืน "" ถ้าไม่มีค่า/ไม่ถูกต้อง */
export function fmtDate(
  value: string | number | Date | null | undefined,
  locale: string,
  opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" },
): string {
  if (value == null || value === "") return ""
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return ""
  return d.toLocaleDateString(localeTag(locale), opts)
}

export type VariantLabelSource = {
  label_th?: string | null
  label_en?: string | null
  duration_type?: string | null
  duration_days?: number | null
  is_lifetime?: boolean | null
}

type Duration = { kind: "lifetime" } | { kind: "days"; days: number } | { kind: "months"; months: number } | { kind: "years"; years: number } | null

// อ่านระยะเวลาจากข้อมูลจริงก่อน (duration_type/duration_days/is_lifetime) — ถ้าไม่มีค่อยเดาจากข้อความป้าย EN/TH
function readDuration(v: VariantLabelSource): Duration {
  if (v.is_lifetime === true || v.duration_type === "permanent") return { kind: "lifetime" }
  const days = v.duration_days ?? null
  if (days && days > 0) return daysToDuration(days)
  const text = `${v.label_en ?? ""} ${v.label_th ?? ""}`
  if (/perma|lifetime|forever|ถาวร|ตลอดชีพ/i.test(text)) return { kind: "lifetime" }
  const yr = text.match(/(\d+)\s*(year|years|yr|ปี)/i)
  if (yr) return { kind: "years", years: Number(yr[1]) }
  if (/yearly|annual|รายปี/i.test(text)) return { kind: "years", years: 1 }
  const mo = text.match(/(\d+)\s*(month|months|mo|เดือน)/i)
  if (mo) return { kind: "months", months: Number(mo[1]) }
  if (/monthly|รายเดือน/i.test(text)) return { kind: "months", months: 1 }
  const wk = text.match(/(\d+)\s*(week|weeks|สัปดาห์)/i)
  if (wk) return daysToDuration(Number(wk[1]) * 7)
  if (/weekly|รายสัปดาห์/i.test(text)) return daysToDuration(7)
  const dy = text.match(/(\d+)\s*(day|days|วัน)/i)
  if (dy) return daysToDuration(Number(dy[1]))
  return null
}

function daysToDuration(days: number): Duration {
  if (days >= 365 && days % 365 === 0) return { kind: "years", years: days / 365 }
  if (days >= 30 && days % 30 === 0) return { kind: "months", months: days / 30 }
  return { kind: "days", days }
}

/**
 * ป้ายชื่อแพ็กเกจตามภาษา — th/en ใช้คอลัมน์ในฐานข้อมูลตรงๆ
 * ja/zh สร้างจากระยะเวลา (เช่น "1ヶ月", "永久", "7 天") ถ้าอ่านไม่ออกจึงใช้ป้าย EN
 */
export function variantLabel(v: VariantLabelSource | null | undefined, locale: string): string {
  if (!v) return ""
  const labelTh = (v.label_th ?? "").trim()
  const labelEn = (v.label_en ?? "").trim()
  if (locale === "th") return labelTh || labelEn
  if (locale !== "ja" && locale !== "zh") return labelEn || labelTh
  const d = readDuration(v)
  if (!d) return labelEn || labelTh
  if (locale === "ja") {
    if (d.kind === "lifetime") return "永久"
    if (d.kind === "years") return `${d.years}年`
    if (d.kind === "months") return `${d.months}ヶ月`
    return `${d.days}日間`
  }
  if (d.kind === "lifetime") return "永久"
  if (d.kind === "years") return `${d.years} 年`
  if (d.kind === "months") return `${d.months} 个月`
  return `${d.days} 天`
}
