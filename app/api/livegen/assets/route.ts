// รูปที่ผู้ใช้อัปโหลดเข้า editor — GET รายการ / POST อัปโหลด (แปลงเป็น webp ≤ 2MB)
// Dev  → <project>/public/uploads/livegen/<user>/…  (เข้าผ่าน /uploads/…)
// Prod → /var/www/uploads/livegen/<user>/…           (nginx เสิร์ฟ /uploads/…)
import { mkdir, writeFile } from "fs/promises"
import path from "path"
import { randomUUID } from "crypto"
import sharp from "sharp"
import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getFeatureFlags } from "@/lib/featureFlags"

export const runtime = "nodejs"

const BASE_UPLOAD_DIR =
  process.env.NODE_ENV === "production" ? "/var/www/uploads" : path.join(process.cwd(), "public", "uploads")
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"])
const MAX_INPUT = 12 * 1024 * 1024 // ไฟล์ต้นทาง
const MAX_OUTPUT = 2 * 1024 * 1024 // หลังแปลง webp
const MAX_ASSETS = 300

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  const assets = await prisma.livegen_assets.findMany({
    where: { user_id: session.user.id },
    orderBy: { created_at: "desc" },
    select: { id: true, url: true, filename: true, width: true, height: true, created_at: true },
  })
  return NextResponse.json({ assets })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  const flags = await getFeatureFlags()
  if (!flags.livegen_enabled) return NextResponse.json({ error: "disabled" }, { status: 404 })
  const userId = session.user.id

  const count = await prisma.livegen_assets.count({ where: { user_id: userId } })
  if (count >= MAX_ASSETS) return NextResponse.json({ error: "too_many_assets" }, { status: 429 })

  const form = await req.formData().catch(() => null)
  const file = form?.get("file")
  if (!(file instanceof File)) return NextResponse.json({ error: "no_file" }, { status: 400 })
  if (!IMAGE_TYPES.has(file.type)) return NextResponse.json({ error: "invalid_type" }, { status: 400 })
  if (file.size > MAX_INPUT) return NextResponse.json({ error: "file_too_large" }, { status: 400 })

  const input = Buffer.from(await file.arrayBuffer())
  // ย่อให้ด้านยาวสุด 2000px (พอสำหรับ 1080×1920) แล้วบีบเป็น webp — ถ้ายังใหญ่ค่อยลดคุณภาพลง
  const encode = (quality: number) =>
    sharp(input, { animated: false }).rotate().resize({ width: 2000, height: 2000, fit: "inside", withoutEnlargement: true }).webp({ quality }).toBuffer({ resolveWithObject: true })
  let out = await encode(82)
  if (out.data.length > MAX_OUTPUT) out = await encode(60)
  if (out.data.length > MAX_OUTPUT) return NextResponse.json({ error: "file_too_large" }, { status: 413 })

  const dir = path.join(BASE_UPLOAD_DIR, "livegen", userId)
  await mkdir(dir, { recursive: true })
  const name = `${Date.now()}-${randomUUID().slice(0, 8)}.webp`
  await writeFile(path.join(dir, name), out.data)
  const url = `/uploads/livegen/${userId}/${name}`

  const row = await prisma.livegen_assets.create({
    data: { user_id: userId, url, filename: file.name.slice(0, 120), width: out.info.width, height: out.info.height, size: out.data.length },
    select: { id: true, url: true, filename: true, width: true, height: true, created_at: true },
  })
  return NextResponse.json({ ok: true, asset: row })
}
