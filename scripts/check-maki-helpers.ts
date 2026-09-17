// ตรวจตัวกรองข้อมูลที่แอดมินส่งมา (โปรแกรมที่ต้องโหลด / รูปฟังก์ชันหน้าสร้างรูปไลฟ์) — รัน: npx tsx scripts/check-maki-helpers.ts
import assert from "node:assert/strict"
import { toDownloads, toLivegenFunctions } from "../lib/maki"

const f = toLivegenFunctions([
  { name: " Wall ", image_url: "/uploads/a.webp" }, // ผ่าน (ตัดช่องว่าง)
  { name: "", image_url: "/uploads/b.webp" }, // ไม่มีชื่อ
  { name: "x", image_url: "/etc/passwd" }, // ไม่ใช่ /uploads/ หรือ http(s)
  { name: "y", image_url: "/uploads/../secret.webp" }, // path traversal
  { name: "z", image_url: "https://cdn.example.com/z.png" }, // ผ่าน
  { name: "js", image_url: "javascript:alert(1)" }, // scheme อันตราย
  "junk", null,
])
assert.deepEqual(f, [{ name: "Wall", image_url: "/uploads/a.webp" }, { name: "z", image_url: "https://cdn.example.com/z.png" }])
assert.equal(toLivegenFunctions(Array.from({ length: 80 }, (_, i) => ({ name: `f${i}`, image_url: `/uploads/${i}.webp` }))).length, 60, "สูงสุด 60")
assert.deepEqual(toLivegenFunctions("nope"), [])

const d = toDownloads([{ name: "Launcher", url: "https://a.b/c.exe" }, { name: "bad", url: "ftp://x" }, { name: "", url: "https://a.b" }, { name: "js", url: "javascript:alert(1)" }])
assert.deepEqual(d, [{ name: "Launcher", url: "https://a.b/c.exe" }])
console.log("maki helpers: OK")
