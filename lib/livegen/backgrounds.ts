// พื้นหลังสำเร็จรูปในแท็บเท็มเพลต — ไล่เฉดที่เข้ากับธีมร้าน ไม่ใช่รูปภาพ
// ชื่อพื้นหลังแปลผ่าน messages (Editor.bg_<id>) ไม่ได้เก็บในนี้
export type BgPreset =
  | { id: "transparent"; kind: "none" }
  | { id: string; kind: "solid"; color: string }
  | { id: string; kind: "gradient"; stops: [string, string] }

export const BACKGROUNDS: BgPreset[] = [
  { id: "transparent", kind: "none" },
  { id: "white", kind: "solid", color: "#ffffff" },
  { id: "black", kind: "solid", color: "#0b0f1a" },
  { id: "ocean", kind: "gradient", stops: ["#0f1a3a", "#2563eb"] },
  { id: "neon", kind: "gradient", stops: ["#0ea5e9", "#a855f7"] },
  { id: "sunset", kind: "gradient", stops: ["#ef4444", "#f59e0b"] },
  { id: "purple", kind: "gradient", stops: ["#4c1d95", "#a78bfa"] },
  { id: "mint", kind: "gradient", stops: ["#064e3b", "#22c55e"] },
  { id: "pink", kind: "gradient", stops: ["#831843", "#f472b6"] },
  { id: "gold", kind: "gradient", stops: ["#78350f", "#facc15"] },
  { id: "midnight", kind: "gradient", stops: ["#020617", "#1e293b"] },
]

/** CSS สำหรับพรีวิวในแท็บ */
export function bgPreviewStyle(p: BgPreset): React.CSSProperties {
  if (p.kind === "none") {
    return { backgroundImage: "conic-gradient(#cbd5e1 0 25%, #f8fafc 0 50%, #cbd5e1 0 75%, #f8fafc 0)", backgroundSize: "12px 12px" }
  }
  if (p.kind === "solid") return { background: p.color }
  return { background: `linear-gradient(160deg, ${p.stops[0]}, ${p.stops[1]})` }
}
