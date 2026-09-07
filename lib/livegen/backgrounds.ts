// พื้นหลังสำเร็จรูปในแท็บเท็มเพลต — ไล่เฉดที่เข้ากับธีมร้าน ไม่ใช่รูปภาพ
export type BgPreset =
  | { id: "transparent"; kind: "none"; label_th: string; label_en: string }
  | { id: string; kind: "solid"; color: string; label_th: string; label_en: string }
  | { id: string; kind: "gradient"; stops: [string, string]; label_th: string; label_en: string }

export const BACKGROUNDS: BgPreset[] = [
  { id: "transparent", kind: "none", label_th: "โปร่งใส", label_en: "Transparent" },
  { id: "white", kind: "solid", color: "#ffffff", label_th: "ขาว", label_en: "White" },
  { id: "black", kind: "solid", color: "#0b0f1a", label_th: "ดำ", label_en: "Black" },
  { id: "ocean", kind: "gradient", stops: ["#0f1a3a", "#2563eb"], label_th: "น้ำเงิน", label_en: "Ocean" },
  { id: "neon", kind: "gradient", stops: ["#0ea5e9", "#a855f7"], label_th: "นีออน", label_en: "Neon" },
  { id: "sunset", kind: "gradient", stops: ["#ef4444", "#f59e0b"], label_th: "ซันเซ็ต", label_en: "Sunset" },
  { id: "purple", kind: "gradient", stops: ["#4c1d95", "#a78bfa"], label_th: "ม่วง", label_en: "Purple" },
  { id: "mint", kind: "gradient", stops: ["#064e3b", "#22c55e"], label_th: "มิ้นต์", label_en: "Mint" },
  { id: "pink", kind: "gradient", stops: ["#831843", "#f472b6"], label_th: "ชมพู", label_en: "Pink" },
  { id: "gold", kind: "gradient", stops: ["#78350f", "#facc15"], label_th: "ทอง", label_en: "Gold" },
  { id: "midnight", kind: "gradient", stops: ["#020617", "#1e293b"], label_th: "มิดไนท์", label_en: "Midnight" },
]

/** CSS สำหรับพรีวิวในแท็บ */
export function bgPreviewStyle(p: BgPreset): React.CSSProperties {
  if (p.kind === "none") {
    return { backgroundImage: "conic-gradient(#cbd5e1 0 25%, #f8fafc 0 50%, #cbd5e1 0 75%, #f8fafc 0)", backgroundSize: "12px 12px" }
  }
  if (p.kind === "solid") return { background: p.color }
  return { background: `linear-gradient(160deg, ${p.stops[0]}, ${p.stops[1]})` }
}
