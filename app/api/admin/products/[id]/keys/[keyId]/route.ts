import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { validateAdmin } from "@/lib/adminAuth"

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ keyId: string }> }
) {
  const admin = await validateAdmin(["admin"])
  if (!admin.isValid) return admin.response

  const { keyId } = await params

  const key = await prisma.game_keys.findUnique({ where: { id: keyId } })
  if (!key) return NextResponse.json({ error: "Not found" }, { status: 404 })

  if (key.status === "assigned") {
    return NextResponse.json(
      { error: "Cannot delete assigned key" },
      { status: 400 }
    )
  }

  await prisma.game_keys.delete({ where: { id: keyId } })
  return NextResponse.json({ ok: true })
}