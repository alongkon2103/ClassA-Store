// app/api/admin/desktop/plugin/route.ts
//
// GET  → every desktop_program product with its current plugin metadata
// POST → upload a new base jar for one program (multipart: program, file, version)
//        Replacing it drops that program's per-account watermarked caches.

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { validateAdmin } from "@/lib/adminAuth"
import { getBasePlugin, saveBasePlugin } from "@/lib/desktopPlugin"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const admin = await validateAdmin(["admin"])
  if (!admin.isValid) return admin.response

  const products = await prisma.products.findMany({
    where: { type: "desktop_program", program_key: { not: null } },
    orderBy: { created_at: "asc" },
    select: { id: true, program_key: true, name_en: true, name_th: true },
  })
  const programs = products.map((p) => ({
    id: p.id,
    program_key: p.program_key,
    name_en: p.name_en,
    name_th: p.name_th,
    plugin: getBasePlugin(p.program_key!),
  }))
  return NextResponse.json({ programs })
}

export async function POST(req: NextRequest) {
  const admin = await validateAdmin(["admin"])
  if (!admin.isValid) return admin.response

  const form = await req.formData().catch(() => null)
  if (!form) return NextResponse.json({ error: "expected multipart form" }, { status: 400 })

  const programKey = String(form.get("program") ?? "").trim()
  const version = String(form.get("version") ?? "").trim()
  const file = form.get("file")

  const product = programKey
    ? await prisma.products.findFirst({ where: { program_key: programKey, type: "desktop_program" }, select: { program_key: true } })
    : null
  if (!product?.program_key) return NextResponse.json({ error: "unknown program" }, { status: 400 })
  if (!(file instanceof File) || file.size === 0) return NextResponse.json({ error: "missing jar file" }, { status: 400 })
  if (!version || version.length > 40) return NextResponse.json({ error: "missing/invalid version" }, { status: 400 })

  const buf = Buffer.from(await file.arrayBuffer())
  // A jar is a zip → must start with the local-file-header magic "PK\x03\x04".
  if (buf.length < 4 || buf.readUInt32LE(0) !== 0x04034b50) {
    return NextResponse.json({ error: "not a .jar/.zip file" }, { status: 400 })
  }

  const meta = saveBasePlugin(product.program_key, buf, version)
  return NextResponse.json({ ok: true, plugin: meta })
}
