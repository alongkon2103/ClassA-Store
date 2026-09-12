// หมวดหมู่เกม (ตาราง game_categories) ใช้ร่วมกันทั้งเกมเราและเกมพาร์ทเนอร์
// ฝั่ง server: include `category: categorySelect` แล้วส่งผ่าน visibleCategory() ก่อนถึง client
// (หมวดที่แอดมินซ่อน = เหมือนไม่มีหมวด: ไม่มีป้าย ไม่อยู่ในตัวกรอง) · ไฟล์นี้ไม่ import อะไร ใช้ได้ทั้ง server/client
export const categorySelect = { select: { id: true, name_th: true, name_en: true, sort_order: true, is_visible: true } } as const

export type CategoryLabel = { id: string; name_th: string; name_en: string; sort_order: number }

export function visibleCategory(c: (CategoryLabel & { is_visible: boolean }) | null | undefined): CategoryLabel | null {
  return c?.is_visible ? { id: c.id, name_th: c.name_th, name_en: c.name_en, sort_order: c.sort_order } : null
}

/** ชื่อหมวดตามภาษา (ja/zh ใช้ชื่ออังกฤษ) · undefined = ไม่มีป้าย */
export function categoryName(c: CategoryLabel | null | undefined, isTH: boolean): string | undefined {
  if (!c) return undefined
  return (isTH ? c.name_th : c.name_en) || c.name_th || c.name_en
}
