import { writeFile, mkdir } from "fs/promises"
import { NextRequest, NextResponse } from "next/server"
import path from "path"
import sharp from "sharp"
import { validateAdmin } from "@/lib/adminAuth"

// Dev  → <project_root>/public/uploads/...  (เข้าผ่าน /uploads/...)
// Prod → /var/www/uploads/...
const BASE_UPLOAD_DIR =
  process.env.NODE_ENV === "production"
    ? "/var/www/uploads"
    : path.join(process.cwd(), "public", "uploads")

const imageTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]

const videoTypes = [
  "video/mp4",
  "video/webm",
  "video/quicktime",
]

const presetTypes = [
  "application/zip",
  "application/x-zip-compressed",
  "application/json",
  "application/octet-stream",
  "text/plain",
]

// ใช้ extension เป็น fallback กรณี browser ส่ง file.type ไม่ถูกต้อง
const extToMime: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
}

export async function POST(req: NextRequest) {
  const adminCheck = await validateAdmin()
  if (!adminCheck.isValid) return adminCheck.response

  try {
    const formData = await req.formData()
    const file = formData.get("file") as File | null
    const type = (formData.get("type") as string | null) ?? "image"

    if (!file) {
      return NextResponse.json(
        { error: "No file" },
        { status: 400 }
      )
    }

    // ตรวจสอบ MIME โดยใช้ extension เป็น fallback
    const fileExt = file.name.split(".").pop()?.toLowerCase() ?? ""

    const resolvedMime =
      imageTypes.includes(file.type) || videoTypes.includes(file.type)
        ? file.type
        : (extToMime[fileExt] ?? file.type)

    // image และ gift รับเฉพาะรูป
    // video รับเฉพาะวิดีโอ
    // preset รับทั้งรูปและไฟล์ preset
    const allowedTypes =
      type === "image" || type === "gift"
        ? imageTypes
        : type === "video"
          ? videoTypes
          : [...imageTypes, ...presetTypes]

    if (!allowedTypes.includes(resolvedMime)) {
      console.warn(
        `[upload] rejected - file.type="${file.type}" resolved="${resolvedMime}" ext="${fileExt}"`
      )

      return NextResponse.json(
        { error: "Invalid file type" },
        { status: 400 }
      )
    }

    // จำกัดขนาดไฟล์
    const maxSize =
      type === "preset"
        ? 100 * 1024 * 1024 // 100 MB
        : type === "video"
          ? 20 * 1024 * 1024 // 20 MB
          : 5 * 1024 * 1024  // 5 MB (image/gift)

    if (file.size > maxSize) {
      const limitLabel =
        type === "preset" ? "100MB" : type === "video" ? "20MB" : "5MB"
      return NextResponse.json(
        { error: `File too large (max ${limitLabel})` },
        { status: 400 }
      )
    }

    // อ่านไฟล์
    const bytes = await file.arrayBuffer()
    const initialBuffer = Buffer.from(new Uint8Array(bytes))

    let finalBuffer: Buffer = initialBuffer
    let ext = fileExt || "bin"

    /**
     * แปลงเป็น WebP เฉพาะ:
     * - type === "image"
     * - เป็นรูป
     * - ไม่ใช่ GIF
     *
     * type === "gift" → เก็บนามสกุลเดิม
     * type === "preset" → เก็บนามสกุลเดิม
     */
    if (
      type === "image" &&
      imageTypes.includes(resolvedMime) &&
      resolvedMime !== "image/gif"
    ) {
      finalBuffer = await sharp(initialBuffer)
        .webp({ quality: 80 })
        .toBuffer()

      ext = "webp"
    }

    // ตั้งชื่อไฟล์ใหม่
    const uniqueName = `${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}`

    const filenameWithExt = `${uniqueName}.${ext}`

    // เลือกโฟลเดอร์
    const folder =
      type === "preset"
        ? "presets"
        : type === "gift"
          ? "gifts"
          : "uploads"

    // สร้างโฟลเดอร์และบันทึกไฟล์
    const uploadDir = path.join(BASE_UPLOAD_DIR, folder)

    await mkdir(uploadDir, { recursive: true })

    await writeFile(
      path.join(uploadDir, filenameWithExt),
      finalBuffer
    )

    // สร้าง URL สำหรับเรียกใช้งาน
    const urlPath =
      process.env.NODE_ENV === "production"
        ? `/${folder}/${filenameWithExt}`
        : `/uploads/${folder}/${filenameWithExt}`

    return NextResponse.json({
      url: urlPath,
      filename: file.name,        // ชื่อไฟล์ต้นฉบับ
      stored_filename: filenameWithExt, // ชื่อที่เก็บจริง
      filesize: finalBuffer.length,
      mime: resolvedMime,
      type,
    })
  } catch (err) {
    console.error("Upload error:", err)

    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    )
  }
}