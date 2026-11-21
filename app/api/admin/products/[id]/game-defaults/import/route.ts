import { NextRequest, NextResponse } from "next/server"
import { validateAdmin } from "@/lib/adminAuth"
import { prisma } from "@/lib/prisma"
import { GameDefaultsError } from "@/lib/tikkiesGameDefaults"
import { TikkiesError } from "@/lib/integrations/tikkies"
import { readTikkiesBody } from "@/lib/integrations/tikkiesSecurity"
import { importAdminGameDefaults } from "@/lib/integrations/tikkiesGameDefaults"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await validateAdmin(["admin"])
  if (!admin.isValid) return admin.response
  const headers = { "Cache-Control": "no-store, private" }
  try {
    const { id } = await params
    if (req.nextUrl.search) throw new GameDefaultsError("invalid_input")
    const origin = new URL(process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || req.url).origin
    return NextResponse.json(await importAdminGameDefaults(prisma, id, await readTikkiesBody(req, 2 * 1024 * 1024), origin), { headers })
  } catch (error) {
    const known = error instanceof GameDefaultsError || error instanceof TikkiesError
    return NextResponse.json({ error: known ? error.code : "defaults_unavailable", ...(error instanceof GameDefaultsError && error.field ? { field: error.field } : {}) }, { status: known ? error.status : 503, headers })
  }
}
