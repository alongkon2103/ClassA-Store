export type Orientation = "portrait" | "landscape"
export type PanelKey = "templates" | "functions" | "text" | "images" | "gifts" | "projects"
export type TextKind = "heading" | "subheading" | "body"

export type Gift = { id: number; name: string; image_url: string | null; diamonds: number }
// รูปฟังก์ชันของเกม (product_functions ที่มีรูป) ให้ลูกค้าเลือกวางเองในแท็บ "ฟังก์ชัน"
export type GameFunction = { id: string; name: string; label_th: string | null; label_en: string | null; image_url: string }
export type Game = { id: string; name_th: string; name_en: string; functions: GameFunction[] }
export type ProjectSummary = { id: string; name: string; orientation: string; thumbnail: string | null; updated_at: string }
export type Asset = { id: string; url: string; filename: string | null; width: number | null; height: number | null }
// เท็มเพลตที่แอดมินทำในหน้า Game Templates · preview = รูปปก ถ้าไม่มีใช้รูปตัวอย่าง (URL หรือ data URL)
export type StoreTemplate = { id: string; name: string; kind: "image" | "canvas"; orientation: Orientation; preview: string | null }
// ไฟล์ที่ปุ่ม "ไฟล์เท็มเพลต" ใน editor ส่งออก (เห็นเฉพาะแอดมิน) แล้วเอาไปอัปโหลดในหน้า admin
export const TEMPLATE_FILE_FORMAT = "aclass-livegen-template"

// สรุปวัตถุที่เลือกอยู่ สำหรับแถบเครื่องมือลอย
export type SelectionInfo = {
  kind: "text" | "image" | "other"
  multiple: boolean
  fontFamily?: string
  fontSize?: number
  fill?: string
  stroke?: string
  strokeWidth?: number
  bold?: boolean
  textAlign?: string
  opacity: number
}

export const CANVAS_SIZES: Record<Orientation, { w: number; h: number }> = {
  portrait: { w: 1080, h: 1920 },
  landscape: { w: 1920, h: 1080 },
}
