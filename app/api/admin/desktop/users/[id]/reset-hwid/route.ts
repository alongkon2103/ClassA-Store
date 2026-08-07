import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { validateAdmin } from "@/lib/adminAuth"

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await validateAdmin(["admin"])
  if (!admin.isValid) return admin.response

  const { id } = await params

  // Unbind the device AND kill any active desktop sessions so the old machine
  // can't keep using its tokens (verifyAccessToken also rejects on the hwid
  // mismatch, but revoking makes the intent explicit and clears the UI).
  const [user] = await prisma.$transaction([
    prisma.users.update({ where: { id }, data: { hwid: null, isOnlineDesktop: false } }),
    prisma.desktop_tokens.updateMany({ where: { user_id: id, revoked: false }, data: { revoked: true } }),
  ])

  revalidatePath("/admin/desktop/users")
  return NextResponse.json(user)
}
