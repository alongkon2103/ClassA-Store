// import { writeFile, mkdir } from "fs/promises"
// import { NextRequest, NextResponse } from "next/server"
// import path from "path"

// // ✅ เปลี่ยนตรงนี้ — เก็บไฟล์นอก project
// const BASE_UPLOAD_DIR = "/var/www/uploads"

// export async function POST(req: NextRequest) {
//   const formData = await req.formData()
//   const file = formData.get("file") as File
//   const type = formData.get("type") as string

//   if (!file) return NextResponse.json({ error: "No file" }, { status: 400 })

//   const imageTypes  = ["image/jpeg", "image/png", "image/webp", "image/gif"]
//   const presetTypes = [
//     "application/zip", "application/x-zip-compressed",
//     "application/json", "application/octet-stream",
//     "text/plain",
//   ]
//   const allowedTypes = type === "image" || type === "gift" ? imageTypes : [...imageTypes, ...presetTypes]

//   if (!allowedTypes.includes(file.type)) {
//     return NextResponse.json({ error: "Invalid file type" }, { status: 400 })
//   }

//   const maxSize = type === "preset" ? 100 * 1024 * 1024 : 5 * 1024 * 1024
//   if (file.size > maxSize) {
//     return NextResponse.json({ error: `File too large (max ${type === "preset" ? "100MB" : "5MB"})` }, { status: 400 })
//   }

//   const bytes    = await file.arrayBuffer()
//   const buffer   = Buffer.from(bytes)
//   const ext      = file.name.split(".").pop()
//   const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
//   const folder   = type === "preset" ? "presets" : type === "gift" ? "gifts" : "uploads"

//   const uploadDir = path.join(BASE_UPLOAD_DIR, folder)
//   await mkdir(uploadDir, { recursive: true })
//   await writeFile(path.join(uploadDir, filename), buffer)

//   return NextResponse.json({
//     url:      `/${folder}/${filename}`,
//     filename: file.name,
//     filesize: file.size,
//   })
// }
import { writeFile, mkdir } from "fs/promises"
import { NextRequest, NextResponse } from "next/server"
import path from "path"
import sharp from "sharp"

// Dev  → <project_root>/public/uploads/...  (เสิร์ฟได้ที่ /uploads/...)
// Prod → /var/www/uploads/...
const BASE_UPLOAD_DIR =
  process.env.NODE_ENV === "production"
    ? "/var/www/uploads"
    : path.join(process.cwd(), "public", "uploads")

const imageTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"]
const presetTypes = [
  "application/zip",
  "application/x-zip-compressed",
  "application/json",
  "application/octet-stream",
  "text/plain",
]

// Fallback: resolve MIME จาก extension กรณี browser ส่ง file.type ผิด/ว่าง
const extToMime: Record<string, string> = {
  jpg:  "image/jpeg",
  jpeg: "image/jpeg",
  png:  "image/png",
  webp: "image/webp",
  gif:  "image/gif",
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get("file") as File
    const type = formData.get("type") as string

    if (!file) return NextResponse.json({ error: "No file" }, { status: 400 })

    // Resolve MIME — ใช้ extension เป็น fallback
    const fileExt = file.name.split(".").pop()?.toLowerCase() ?? ""
    const resolvedMime = imageTypes.includes(file.type)
      ? file.type
      : (extToMime[fileExt] ?? file.type)

    const allowedTypes =
      type === "image" || type === "gift"
        ? imageTypes
        : [...imageTypes, ...presetTypes]

    if (!allowedTypes.includes(resolvedMime)) {
      console.warn(`[upload] rejected — file.type="${file.type}" resolved="${resolvedMime}" ext="${fileExt}"`)
      return NextResponse.json({ error: "Invalid file type" }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    const initialBuffer = Buffer.from(new Uint8Array(bytes))

    let finalBuffer: Buffer = initialBuffer
    let ext = fileExt

    // แปลงรูปเป็น webp (ยกเว้น gif และ preset)
    if (imageTypes.includes(resolvedMime) && resolvedMime !== "image/gif" && type !== "preset") {
      finalBuffer = await sharp(initialBuffer).webp({ quality: 80 }).toBuffer()
      ext = "webp"
    }

    const finalFilename = `${Date.now()}-${Math.random().toString(36).slice(2)}`
    const filenameWithExt = `${finalFilename}.${ext}`
    const folder = type === "preset" ? "presets" : type === "gift" ? "gifts" : "uploads"

    const uploadDir = path.join(BASE_UPLOAD_DIR, folder)
    await mkdir(uploadDir, { recursive: true })
    await writeFile(path.join(uploadDir, filenameWithExt), finalBuffer)

    // URL path สำหรับ dev และ prod
    const urlPath =
      process.env.NODE_ENV === "production"
        ? `/${folder}/${filenameWithExt}`
        : `/uploads/${folder}/${filenameWithExt}`

    return NextResponse.json({
      url:      urlPath,
      filename: file.name,
      filesize: finalBuffer.length,
    })
  } catch (err) {
    console.error("Upload error:", err)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}