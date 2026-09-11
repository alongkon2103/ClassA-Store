// YouTube helpers ใช้ร่วมกันทั้งสินค้าเราและเกมพาร์ทเนอร์ (Maki ส่ง preview_url เป็น youtu.be/…)
export function youtubeId(url: string): string | null {
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{11})/)
  return m ? m[1] : null
}
export function youtubeEmbed(url: string): string | null {
  const id = youtubeId(url)
  return id ? `https://www.youtube.com/embed/${id}` : null
}
export function youtubeThumb(id: string) {
  return `https://img.youtube.com/vi/${id}/hqdefault.jpg`
}
