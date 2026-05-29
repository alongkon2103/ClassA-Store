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

  // Set status to KICKED. The heartbeat system in the desktop app
  // will pick this up and force a logout.
  const user = await prisma.users.update({
    where: { id },
    data: { nativeStatus: "KICKED" },
  })

  revalidatePath("/admin/desktop/users")
  return NextResponse.json(user)
}
