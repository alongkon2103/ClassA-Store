import { NextRequest, NextResponse } from "next/server"
import { validateAdmin } from "@/lib/adminAuth"
import { prisma } from "@/lib/prisma"
import { GameDefaultsError } from "@/lib/tikkiesGameDefaults"
import { TikkiesError } from "@/lib/integrations/tikkies"
import { readTikkiesBody } from "@/lib/integrations/tikkiesSecurity"
import { readAdminGameDefaults, saveAdminGameDefaults } from "@/lib/integrations/tikkiesGameDefaults"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
async function handle(req: NextRequest, params: Promise<{ id: string }>, write: boolean) {
  const admin = await validateAdmin(["admin"])
  if (!admin.isValid) return admin.response
  const headers = { "Cache-Control": "no-store, private" }
  try {
    const { id } = await params
    if (req.nextUrl.search) throw new GameDefaultsError("invalid_input")
    const origin = new URL(process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || req.url).origin
    const result = write ? await saveAdminGameDefaults(prisma, id, await readTikkiesBody(req, 2 * 1024 * 1024), origin) : await readAdminGameDefaults(prisma, id, origin)
    return NextResponse.json(result, { headers })
  } catch (error) {
    const known = error instanceof GameDefaultsError || error instanceof TikkiesError
    return NextResponse.json({ error: known ? error.code : "defaults_unavailable", ...(error instanceof GameDefaultsError && error.field ? { field: error.field } : {}) }, { status: known ? error.status : 503, headers })
  }
}
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) { return handle(req, params, false) }
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) { return handle(req, params, true) }
