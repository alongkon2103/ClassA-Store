// พาธไฟล์บนดิสก์ของรูปที่ผู้ใช้อัปโหลดเข้า editor — URL ที่เก็บใน DB คือ /uploads/livegen/<user>/<file>
//   Dev  : <project>/public เสิร์ฟทั้งโฟลเดอร์ → /uploads/x ↔ <project>/public/uploads/x
//   Prod : nginx root = /var/www/uploads → /uploads/x ↔ /var/www/uploads/uploads/x
//          (แบบเดียวกับ /api/admin/upload ที่เขียน /var/www/uploads/<folder>/<file> แล้วคืน URL /<folder>/<file>)
import path from "path"

const PROD_ROOT = "/var/www/uploads"

export function livegenAssetDiskPath(url: string, prod = process.env.NODE_ENV === "production", cwd = process.cwd()): string {
  // เดิมตัด "/uploads/" ออกแล้วต่อกับ /var/www/uploads → ไฟล์ไปอยู่ /var/www/uploads/livegen/… ซึ่ง nginx ไม่ได้เสิร์ฟที่ URL นี้ (รูปแตกบน production)
  return path.join(prod ? PROD_ROOT : path.join(cwd, "public"), url)
}
