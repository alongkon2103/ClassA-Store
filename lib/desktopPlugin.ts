// Desktop plugin delivery — the web side of "ปลั๊กอินโหลดจากเซิร์ฟเวอร์" (see
// AGENTS.md). Admin uploads a base ACPigPanic.jar; each authorized user downloads
// a copy with a per-account `watermark.properties` embedded, via a short-lived
// signed URL. Files live OUTSIDE public/ so the jar is never served unauthenticated.
//
// Zip handling is dependency-free (Windows prod has no `zip` CLI): a jar is a zip,
// and we append one STORED entry by rewriting the central directory ourselves.

import fs from "node:fs"
import path from "node:path"
import crypto from "node:crypto"

const PLUGIN_DIR = process.env.DESKTOP_PLUGIN_DIR || path.join(process.cwd(), "storage", "plugin")
const baseJarPath = () => path.join(PLUGIN_DIR, "base.jar")
const metaPath = () => path.join(PLUGIN_DIR, "meta.json")
const cacheDir = () => path.join(PLUGIN_DIR, "cache")

const DOWNLOAD_TTL_MS = 5 * 60 * 1000 // signed download link: 5 minutes
const SIGN_SECRET = () => process.env.NEXTAUTH_SECRET || ""

// ── metadata ─────────────────────────────────────────────────────────────────
export type PluginMeta = { version: string; sha256: string; size: number; uploaded_at: string }

export function getBasePlugin(): PluginMeta | null {
  try {
    if (!fs.existsSync(baseJarPath())) return null
    const meta = JSON.parse(fs.readFileSync(metaPath(), "utf8")) as PluginMeta
    if (!meta || !meta.version) return null
    return meta
  } catch {
    return null
  }
}

/** Store a freshly-uploaded base jar + version, and drop stale per-account caches. */
export function saveBasePlugin(jar: Buffer, version: string): PluginMeta {
  fs.mkdirSync(PLUGIN_DIR, { recursive: true })
  fs.writeFileSync(baseJarPath(), jar)
  const meta: PluginMeta = {
    version: version.trim(),
    sha256: sha256(jar),
    size: jar.length,
    uploaded_at: new Date().toISOString(),
  }
  fs.writeFileSync(metaPath(), JSON.stringify(meta, null, 2))
  // base changed → every per-account watermarked copy is stale
  try { fs.rmSync(cacheDir(), { recursive: true, force: true }) } catch { /* nothing to clear */ }
  return meta
}

// ── per-account watermarked build (cached) ───────────────────────────────────
const safe = (s: string) => s.replace(/[^\w.-]/g, "_")

export type BuiltJar = { buffer: Buffer; sha256: string }

/**
 * The watermarked jar for (account, version). Built once and cached on disk;
 * cache key includes the version so a new upload regenerates it. Returns null if
 * no base plugin is uploaded yet.
 */
export function buildWatermarkedJar(account: string, email: string | null): BuiltJar | null {
  const meta = getBasePlugin()
  if (!meta) return null

  fs.mkdirSync(cacheDir(), { recursive: true })
  const cacheFile = path.join(cacheDir(), `${safe(account)}-${safe(meta.version)}.jar`)

  if (fs.existsSync(cacheFile)) {
    const buf = fs.readFileSync(cacheFile)
    return { buffer: buf, sha256: sha256(buf) }
  }

  const base = fs.readFileSync(baseJarPath())
  const watermark = Buffer.from(
    `account=${account}\n` +
    `issued-to=${email ?? "unknown"}\n` +
    `issued-at=${new Date().toISOString().slice(0, 10)}\n`,
    "utf8",
  )
  const out = addStoredEntry(base, "watermark.properties", watermark)
  fs.writeFileSync(cacheFile, out)
  return { buffer: out, sha256: sha256(out) }
}

// ── short-lived signed download URL (HMAC, account-bound) ─────────────────────
export function signDownload(account: string, version: string): { exp: number; sig: string } {
  const exp = Date.now() + DOWNLOAD_TTL_MS
  return { exp, sig: signature(account, version, exp) }
}

export function verifyDownload(account: string, version: string, exp: number, sig: string): boolean {
  if (!Number.isFinite(exp) || exp < Date.now()) return false
  const expected = signature(account, version, exp)
  if (expected.length !== sig.length) return false
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig))
  } catch {
    return false
  }
}

function signature(account: string, version: string, exp: number): string {
  return crypto.createHmac("sha256", SIGN_SECRET())
    .update(`desktop-plugin\n${account}\n${version}\n${exp}`)
    .digest("hex")
}

// ── helpers ───────────────────────────────────────────────────────────────────
export function sha256(buf: Buffer): string {
  return crypto.createHash("sha256").update(buf).digest("hex")
}

// CRC-32 (IEEE) — table-built once. Node's zlib.crc32 isn't available on every
// supported Node, so compute it ourselves.
let CRC_TABLE: Uint32Array | null = null
function crc32(buf: Buffer): number {
  if (!CRC_TABLE) {
    CRC_TABLE = new Uint32Array(256)
    for (let n = 0; n < 256; n++) {
      let c = n
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
      CRC_TABLE[n] = c >>> 0
    }
  }
  let crc = 0xffffffff
  for (let i = 0; i < buf.length; i++) crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

/**
 * Append one STORED (uncompressed) file to a zip/jar buffer by rewriting the
 * central directory. Small files only (no zip64) — a jar is well under the
 * 4GB / 65535-entry limits. Existing entries are untouched, so the archive stays
 * valid for any reader (Java reads via the central directory).
 */
export function addStoredEntry(zip: Buffer, name: string, content: Buffer): Buffer {
  const EOCD_SIG = 0x06054b50
  let eocd = -1
  for (let i = zip.length - 22; i >= 0; i--) {
    if (zip.readUInt32LE(i) === EOCD_SIG) { eocd = i; break }
  }
  if (eocd < 0) throw new Error("addStoredEntry: not a zip (no EOCD found)")

  const totalEntries = zip.readUInt16LE(eocd + 10)
  const cdSize = zip.readUInt32LE(eocd + 12)
  const cdOffset = zip.readUInt32LE(eocd + 16)

  const nameBuf = Buffer.from(name, "utf8")
  const crc = crc32(content)
  const size = content.length

  // Local file header (30) + name + data
  const lfh = Buffer.alloc(30)
  lfh.writeUInt32LE(0x04034b50, 0)
  lfh.writeUInt16LE(20, 4)   // version needed
  lfh.writeUInt16LE(0, 6)    // flags
  lfh.writeUInt16LE(0, 8)    // method 0 = STORED
  lfh.writeUInt16LE(0, 10)   // mod time
  lfh.writeUInt16LE(0x21, 12) // mod date (1980-01-01, non-zero so tools don't warn)
  lfh.writeUInt32LE(crc, 14)
  lfh.writeUInt32LE(size, 18) // compressed
  lfh.writeUInt32LE(size, 22) // uncompressed
  lfh.writeUInt16LE(nameBuf.length, 26)
  lfh.writeUInt16LE(0, 28)   // extra len
  const localEntry = Buffer.concat([lfh, nameBuf, content])

  // Central directory header (46) + name
  const cdh = Buffer.alloc(46)
  cdh.writeUInt32LE(0x02014b50, 0)
  cdh.writeUInt16LE(20, 4)   // version made by
  cdh.writeUInt16LE(20, 6)   // version needed
  cdh.writeUInt16LE(0, 8)    // flags
  cdh.writeUInt16LE(0, 10)   // method
  cdh.writeUInt16LE(0, 12)   // mod time
  cdh.writeUInt16LE(0x21, 14) // mod date
  cdh.writeUInt32LE(crc, 16)
  cdh.writeUInt32LE(size, 20)
  cdh.writeUInt32LE(size, 24)
  cdh.writeUInt16LE(nameBuf.length, 28)
  cdh.writeUInt16LE(0, 30)   // extra len
  cdh.writeUInt16LE(0, 32)   // comment len
  cdh.writeUInt16LE(0, 34)   // disk number start
  cdh.writeUInt16LE(0, 36)   // internal attrs
  cdh.writeUInt32LE(0, 38)   // external attrs
  cdh.writeUInt32LE(cdOffset, 42) // relative offset of local header (where we insert)
  const cdEntry = Buffer.concat([cdh, nameBuf])

  const before = zip.subarray(0, cdOffset)             // existing local entries
  const centralDir = zip.subarray(cdOffset, cdOffset + cdSize)

  const newCdOffset = cdOffset + localEntry.length
  const newCdSize = cdSize + cdEntry.length
  const newTotal = totalEntries + 1

  const newEocd = Buffer.alloc(22)
  newEocd.writeUInt32LE(EOCD_SIG, 0)
  newEocd.writeUInt16LE(0, 4)
  newEocd.writeUInt16LE(0, 6)
  newEocd.writeUInt16LE(newTotal, 8)
  newEocd.writeUInt16LE(newTotal, 10)
  newEocd.writeUInt32LE(newCdSize, 12)
  newEocd.writeUInt32LE(newCdOffset, 16)
  newEocd.writeUInt16LE(0, 20)

  return Buffer.concat([before, localEntry, centralDir, cdEntry, newEocd])
}
