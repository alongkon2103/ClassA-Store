// ฟอนต์ที่ให้เลือกใน editor — ฟอนต์ไทยก่อน ตามด้วยฟอนต์ display ภาษาอังกฤษ
// weights ต้องตรงกับที่ Google Fonts มีจริง ไม่งั้น request ทั้งลิงก์จะพัง
export const FONT_OPTIONS: { family: string; weights: number[] }[] = [
  { family: "Kanit", weights: [400, 700] },
  { family: "Mitr", weights: [400, 700] },
  { family: "Prompt", weights: [400, 700] },
  { family: "Bai Jamjuree", weights: [400, 700] },
  { family: "Sarabun", weights: [400, 700] },
  { family: "Anuphan", weights: [400, 700] },
  { family: "Noto Sans Thai", weights: [400, 700] },
  { family: "Inter", weights: [400, 700] },
  { family: "Bungee", weights: [400] },
  { family: "Bebas Neue", weights: [400] },
  { family: "Anton", weights: [400] },
]

export const DEFAULT_FONT = "Kanit"

export const FONT_LINK_HREF = `https://fonts.googleapis.com/css2?${FONT_OPTIONS
  .map((f) => `family=${f.family.replace(/ /g, "+")}:wght@${f.weights.join(";")}`)
  .join("&")}&display=swap`

/** รอให้ฟอนต์โหลดก่อนวาดลง canvas (ไม่งั้น Fabric จะวัดขนาดผิดแล้วจำค่าไว้) */
export async function ensureFont(family: string) {
  if (typeof document === "undefined" || !("fonts" in document)) return
  const weights = FONT_OPTIONS.find((f) => f.family === family)?.weights ?? [400]
  try {
    await Promise.all(weights.map((w) => document.fonts.load(`${w} 40px "${family}"`)))
  } catch {
    // ฟอนต์โหลดไม่ได้ก็วาดด้วยฟอนต์สำรอง ไม่ต้องล้ม
  }
}

export function fontWeightFor(family: string, bold: boolean) {
  const weights = FONT_OPTIONS.find((f) => f.family === family)?.weights ?? [400, 700]
  return bold && weights.includes(700) ? 700 : 400
}
