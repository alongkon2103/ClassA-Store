import { writeFile, mkdir } from "fs/promises"
import { NextRequest, NextResponse } from "next/server"
import path from "path"

// ✅ เปลี่ยนตรงนี้ — เก็บไฟล์นอก project
const BASE_UPLOAD_DIR = "/var/www/uploads"

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const file = formData.get("file") as File
  const type = formData.get("type") as string

  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 })

  const imageTypes  = ["image/jpeg", "image/png", "image/webp", "image/gif"]
  const presetTypes = [
    "application/zip", "application/x-zip-compressed",
    "application/json", "application/octet-stream",
    "text/plain",
  ]
  const allowedTypes = type === "image" || type === "gift" ? imageTypes : [...imageTypes, ...presetTypes]

  if (!allowedTypes.includes(file.type)) {
    return NextResponse.json({ error: "Invalid file type" }, { status: 400 })
  }

  const maxSize = type === "preset" ? 100 * 1024 * 1024 : 5 * 1024 * 1024
  if (file.size > maxSize) {
    return NextResponse.json({ error: `File too large (max ${type === "preset" ? "100MB" : "5MB"})` }, { status: 400 })
  }

  const bytes    = await file.arrayBuffer()
  const buffer   = Buffer.from(bytes)
  const ext      = file.name.split(".").pop()
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
  const folder   = type === "preset" ? "presets" : type === "gift" ? "gifts" : "uploads"

  const uploadDir = path.join(BASE_UPLOAD_DIR, folder)
  await mkdir(uploadDir, { recursive: true })
  await writeFile(path.join(uploadDir, filename), buffer)

  return NextResponse.json({
    url:      `/${folder}/${filename}`,
    filename: file.name,
    filesize: file.size,
  })
}