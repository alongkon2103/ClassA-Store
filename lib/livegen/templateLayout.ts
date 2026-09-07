// จัดฟังก์ชันของเกมลง "สองฝั่ง" ของภาพไลฟ์ตามลำดับที่แอดมินเรียงไว้ (sort_order):
// ครึ่งแรก → ฝั่งซ้าย · ครึ่งหลัง → ฝั่งขวา (ถ้าเป็นเลขคี่ ซ้ายได้เกินมา 1)
// ไม่เดาขั้วบวก/ลบจากชื่อ — เจ้าของร้านเรียงลำดับใน admin ให้ตรงกับที่อยากโชว์อยู่แล้ว
export function splitSides<T>(fns: T[]): { left: T[]; right: T[] } {
  const half = Math.ceil(fns.length / 2)
  return { left: fns.slice(0, half), right: fns.slice(half) }
}
