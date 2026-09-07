export type Orientation = "portrait" | "landscape"
export type PanelKey = "templates" | "text" | "images" | "gifts" | "projects"
export type TextKind = "heading" | "subheading" | "body"

export type Gift = { id: number; name: string; image_url: string | null; diamonds: number }
export type Game = { id: string; slug: string; name_th: string; name_en: string; image: string | null; function_count: number }
export type ProjectSummary = { id: string; name: string; orientation: string; thumbnail: string | null; updated_at: string }
export type Asset = { id: string; url: string; filename: string | null; width: number | null; height: number | null }

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
