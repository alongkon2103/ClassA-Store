// ตรวจว่าไฟล์ที่อัปโหลดเข้า editor ถูกเขียนลงตำแหน่งที่ URL ของมันถูกเสิร์ฟจริง — รัน: npx tsx scripts/check-livegen-asset-paths.ts
// หลักฐานการ map ของ production: /api/admin/upload เขียน /var/www/uploads/<folder>/<file> แล้วใช้ URL /<folder>/<file> (เปิดได้จริง)
// → nginx root = /var/www/uploads ดังนั้น URL ใด ๆ ↔ /var/www/uploads + URL
import assert from "node:assert/strict"
import path from "node:path"
import { livegenAssetDiskPath } from "../lib/livegen/assetPaths"

const url = "/uploads/livegen/11111111-2222-3333-4444-555555555555/1700000000000-abcd1234.webp"
assert.equal(livegenAssetDiskPath(url, false, "/proj"), path.join("/proj/public", url), "dev: public/ + url")
assert.equal(livegenAssetDiskPath(url, true, "/proj"), path.join("/var/www/uploads", url), "prod: nginx root + url")
console.log("livegen asset paths: OK")
