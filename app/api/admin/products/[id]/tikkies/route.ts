import { NextRequest, NextResponse } from "next/server"
import { validateAdmin } from "@/lib/adminAuth"
import { prisma } from "@/lib/prisma"
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await validateAdmin(["admin"])
  if (!auth.isValid) return auth.response
  try {
    const { id } = await params
    const body = await req.json()
    if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "Invalid mapping" }, { status: 400 })
    const universe = body.universeId === null || body.universeId === "" ? null : body.universeId
    if ((universe !== null && (typeof universe !== "string" || !/^[1-9][0-9]{0,31}$/.test(universe))) || !Array.isArray(body.placeIds) || body.placeIds.length > 100 || !body.placeIds.every((x: unknown) => typeof x === "string" && /^[1-9][0-9]{0,31}$/.test(x)) || (universe === null && body.placeIds.length)) return NextResponse.json({ error: "Invalid Universe ID / Place IDs" }, { status: 400 })
    const product = await prisma.products.findUnique({ where: { id }, select: { type: true } })
    if (!product || product.type !== "roblox_whitelist") return NextResponse.json({ error: "Roblox game not found" }, { status: 404 })
    await prisma.products.update({ where: { id }, data: { roblox_universe_id: universe, roblox_place_ids: [...new Set(body.placeIds as string[])], updated_at: new Date() } })
    return NextResponse.json({ ok: true, gameKey: id })
  } catch (error) { return NextResponse.json({ error: "Mapping could not be saved" }, { status: error instanceof SyntaxError ? 400 : 503 }) }
}
