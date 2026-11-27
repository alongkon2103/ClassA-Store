import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { validateProductEditor } from "@/lib/adminAuth"
import { TikkiesError } from "@/lib/integrations/tikkies"
import { appendProductPreset } from "@/lib/integrations/tikkiesPreset"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const admin = await validateProductEditor(id)
  if (!admin.isValid) return admin.response

  const headers = { "Cache-Control": "no-store, private" }
  try {
    let input: unknown
    try { input = await req.json() } catch { throw new TikkiesError("invalid_input", 400) }
    const preset = await appendProductPreset(prisma, id, input)
    return NextResponse.json(preset, { status: 201, headers })
  } catch (error) {
    return NextResponse.json({ error: error instanceof TikkiesError ? error.code : "preset_unavailable" }, { status: error instanceof TikkiesError ? error.status : 503, headers })
  }
}
