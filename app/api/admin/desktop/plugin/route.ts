// app/api/admin/desktop/plugin/route.ts
//
// GET  → current plugin metadata (version, sha256, size, uploaded_at) or null
// POST → upload a new base jar (multipart: file=<jar>, version=<string>).
//        Replacing it drops every per-account watermarked cache.

import { NextRequest, NextResponse } from "next/server"
import { validateAdmin } from "@/lib/adminAuth"
import { getBasePlugin, saveBasePlugin } from "@/lib/desktopPlugin"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const admin = await validateAdmin(["admin"])
  if (!admin.isValid) return admin.response
  return NextResponse.json({ plugin: getBasePlugin() })
}

export async function POST(req: NextRequest) {
  const admin = await validateAdmin(["admin"])
  if (!admin.isValid) return admin.response

  const form = await req.formData().catch(() => null)
  if (!form) return NextResponse.json({ error: "expected multipart form" }, { status: 400 })

  const file = form.get("file")
  const version = String(form.get("version") ?? "").trim()

  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "missing jar file" }, { status: 400 })
  }
  if (!version || version.length > 40) {
    return NextResponse.json({ error: "missing/invalid version" }, { status: 400 })
  }

  const buf = Buffer.from(await file.arrayBuffer())
  // A jar is a zip → must start with the local-file-header magic "PK\x03\x04".
  if (buf.length < 4 || buf.readUInt32LE(0) !== 0x04034b50) {
    return NextResponse.json({ error: "not a .jar/.zip file" }, { status: 400 })
  }

  const meta = saveBasePlugin(buf, version)
  return NextResponse.json({ ok: true, plugin: meta })
}
