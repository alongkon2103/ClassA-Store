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

const BASE_UPLOAD_DIR = "/var/www/uploads"

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get("file") as File
    const type = formData.get("type") as string

    if (!file) return NextResponse.json({ error: "No file" }, { status: 400 })

    const imageTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"]
    const presetTypes = ["application/zip", "application/x-zip-compressed", "application/json", "application/octet-stream", "text/plain"]
    const allowedTypes = type === "image" || type === "gift" ? imageTypes : [...imageTypes, ...presetTypes]

    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: "Invalid file type" }, { status: 400 })
    }

    // --- ส่วนที่แก้ไขเรื่อง Type ---
    const bytes = await file.arrayBuffer()
    // 1. สร้าง Buffer ตัวต้นฉบับให้ชัดเจน (ใช้ const เพื่อล็อค Type)
    const initialBuffer = Buffer.from(new Uint8Array(bytes))
    
    // 2. ตัวแปรสำหรับเก็บข้อมูลสุดท้ายที่จะเขียนลง Disk
    let finalBuffer: Buffer = initialBuffer 
    
    let ext = file.name.split(".").pop()
    const finalFilename = `${Date.now()}-${Math.random().toString(36).slice(2)}`

    // 3. ตรวจสอบเงื่อนไขเพื่อแปลงไฟล์
    if (imageTypes.includes(file.type) && file.type !== "image/gif" && type !== "preset") {
      // ส่ง initialBuffer เข้า sharp ตรงๆ (TypeScript จะไม่บ่นเพราะ type ชัดเจนแล้ว)
      finalBuffer = await sharp(initialBuffer)
        .webp({ quality: 80 })
        .toBuffer()
      
      ext = "webp"
    }
    // ----------------------------

    const filenameWithExt = `${finalFilename}.${ext}`
    const folder = type === "preset" ? "presets" : type === "gift" ? "gifts" : "uploads"

    const uploadDir = path.join(BASE_UPLOAD_DIR, folder)
    await mkdir(uploadDir, { recursive: true })
    
    // เขียนไฟล์โดยใช้ finalBuffer
    await writeFile(path.join(uploadDir, filenameWithExt), finalBuffer)

    return NextResponse.json({
      url: `/${folder}/${filenameWithExt}`,
      filename: file.name,
      filesize: finalBuffer.length,
    })
  } catch (err) {
    console.error("Upload error:", err)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}