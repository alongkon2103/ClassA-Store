import fs from "fs/promises"
import path from "path"
import { Pool } from "pg"
import crypto from "crypto"

// ==============================
// Types
// ==============================
interface Gift {
  name: string
  diamonds?: number
  image_url: string
  image_file?: string
}

// ==============================
// PostgreSQL Connection
// ==============================
const pool = new Pool({
  connectionString: "postgres://gamestore_dev:NWv4aD9KpRYyIBIy%21%40%23012@127.0.0.1:5432/gamestore_db",
})

// ==============================
// Config
// ==============================
const JSON_FILE = path.join(process.cwd(), "scripts/gifts_th.json")
const TARGET_DIR = "/var/www/uploads/uploads"
const URL_PREFIX = "/uploads"

// ==============================
// Generate random filename
// ==============================
function generateFileName(originalUrl: string): string {
  let ext = ".webp"

  try {
    ext = path.extname(new URL(originalUrl).pathname) || ".webp"
  } catch {
    ext = ".webp"
  }

  return `${Date.now()}-${crypto.randomUUID()}${ext}`
}

// ==============================
// Download image
// ==============================
async function downloadImage(
  url: string,
  targetPath: string
): Promise<void> {
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }

  const arrayBuffer = await response.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  await fs.writeFile(targetPath, buffer)
}

// ==============================
// Main
// ==============================
async function run(): Promise<void> {
  await fs.mkdir(TARGET_DIR, { recursive: true })

  // โหลดไฟล์ JSON
  const raw = await fs.readFile(JSON_FILE, "utf8")
  const gifts: Gift[] = JSON.parse(raw)

  let downloaded = 0
  let processed = 0
  let failed = 0

  for (const gift of gifts) {
    const {
      name,
      diamonds = 0,
      image_url,
    } = gift

    if (!name || !image_url) {
      console.log("⚠️ Skip invalid gift:", gift)
      continue
    }

    try {
      // สร้างชื่อไฟล์ใหม่
      const newFileName = generateFileName(image_url)
      const targetPath = path.join(TARGET_DIR, newFileName)
      const localUrl = `${URL_PREFIX}/${newFileName}`

      // ดาวน์โหลดรูป
      await downloadImage(image_url, targetPath)
      downloaded++

      // บันทึกลง PostgreSQL
      await pool.query(
        `
        INSERT INTO gifts (
          name,
          diamonds,
          image_url,
          is_active,
          sort_order
        )
        VALUES ($1, $2, $3, true, 0)
        ON CONFLICT (name)
        DO UPDATE SET
          diamonds = EXCLUDED.diamonds,
          image_url = EXCLUDED.image_url
        `,
        [name, diamonds, localUrl]
      )

      processed++

      console.log(`✔ ${name} (${diamonds}) -> ${localUrl}`)
    } catch (error) {
      failed++

      const message =
        error instanceof Error ? error.message : String(error)

      console.error(`❌ ${name}: ${message}`)
    }
  }

  console.log("\n======================")
  console.log("Import Complete")
  console.log("======================")
  console.log(`Downloaded : ${downloaded}`)
  console.log(`Processed  : ${processed}`)
  console.log(`Failed     : ${failed}`)

  await pool.end()
}

// Run script
run().catch(async (error) => {
  console.error("Fatal Error:", error)
  await pool.end()
  process.exit(1)
})