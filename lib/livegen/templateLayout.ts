// จัดฟังก์ชันของเกมลง "สองฝั่ง" ของภาพไลฟ์: ซ้าย = ฝั่งลบ (โทษ/หักแต้ม) · ขวา = ฝั่งบวก (ช่วย/เพิ่มแต้ม)
// ระบบไม่มีฟิลด์ขั้วบวก/ลบ เลยเดาจากป้าย/ชื่อ เช่น "+100", "-5 WIN", "up3", "down2", "winminus"
// ตัวที่เดาไม่ได้ (กาชา, เต้น, Fly …) เป็นกลาง → เติมให้ฝั่งที่สั้นกว่า ถ้าเป็นกลางทั้งหมดก็แบ่งครึ่งตามลำดับเดิม
export type FnLite = { name: string; label_th: string | null; label_en: string | null }
export type Polarity = "neg" | "pos" | "neutral"

export function polarityOf(fn: FnLite): Polarity {
  const label = (fn.label_en || fn.label_th || fn.name || "").trim()
  if (/^[+＋]/.test(label)) return "pos"
  if (/^[-−–]/.test(label)) return "neg"
  const name = fn.name.trim().toLowerCase()
  if (/^(up|plus|add|gain|win)\b|^up\d|plus/.test(name)) return "pos"
  if (/^(down|minus|sub|lose|loss)\b|^down\d|minus/.test(name)) return "neg"
  return "neutral"
}

// ค่าสำหรับเรียงในฝั่ง: แต้ม (5, 50, 150 …) มาก่อน แล้วค่อยเป็น WIN (1 WIN, 5 WIN …) เรียงน้อย → มาก
export function orderKey(fn: FnLite): number {
  const label = (fn.label_en || fn.label_th || fn.name || "").trim()
  const m = label.match(/(\d+(?:[.,]\d+)?)/)
  const num = m ? Number(m[1].replace(",", "")) : Number.MAX_SAFE_INTEGER / 4
  const unit = /win/i.test(label) ? 1 : 0
  return unit * 1e9 + num
}

export function splitSides<T extends FnLite>(fns: T[]): { left: T[]; right: T[] } {
  const neg = fns.filter((f) => polarityOf(f) === "neg").sort((a, b) => orderKey(a) - orderKey(b))
  const pos = fns.filter((f) => polarityOf(f) === "pos").sort((a, b) => orderKey(a) - orderKey(b))
  const neutral = fns.filter((f) => polarityOf(f) === "neutral")
  if (neg.length === 0 && pos.length === 0) {
    const half = Math.ceil(fns.length / 2)
    return { left: fns.slice(0, half), right: fns.slice(half) }
  }
  const left = [...neg], right = [...pos]
  for (const f of neutral) (left.length <= right.length ? left : right).push(f)
  return { left, right }
}
