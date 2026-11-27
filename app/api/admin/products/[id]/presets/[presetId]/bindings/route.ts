import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { validateProductEditor } from "@/lib/adminAuth"
import { TikkiesError } from "@/lib/integrations/tikkies"
import { readPresetBindings, savePresetBindings } from "@/lib/integrations/tikkiesPresetBindings"
import { readTikkiesBody } from "@/lib/integrations/tikkiesSecurity"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
async function handle(req: NextRequest, params: Promise<{ id: string; presetId: string }>, save: boolean) {
  const { id, presetId } = await params
  const admin = await validateProductEditor(id)
  if (!admin.isValid) return admin.response
  const headers = { "Cache-Control": "no-store, private" }
  try {
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    if (req.nextUrl.search || !uuid.test(id) || !uuid.test(presetId)) throw new TikkiesError("invalid_input", 400)
    const origin = new URL(process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || req.url).origin
    const result = save ? await savePresetBindings(prisma, id, presetId, await readTikkiesBody(req, 32768), origin) : await readPresetBindings(prisma, id, presetId, origin)
    return NextResponse.json(result, { headers })
  } catch (error) {
    return NextResponse.json({ error: error instanceof TikkiesError ? error.code : "preset_unavailable" }, { status: error instanceof TikkiesError ? error.status : 503, headers })
  }
}
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string; presetId: string }> }) { return handle(req, params, false) }
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string; presetId: string }> }) { return handle(req, params, true) }
