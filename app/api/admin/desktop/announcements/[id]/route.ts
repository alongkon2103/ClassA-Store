import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { validateAdmin } from "@/lib/adminAuth"

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await validateAdmin(["admin"])
  if (!admin.isValid) return admin.response

  const { id } = await params
  const body = await req.json()

  const announcement = await prisma.announcements.update({
    where: { id },
    data: {
      title: body.title,
      content: body.content,
      imageUrl: body.imageUrl,
      isActive: body.isActive,
      updatedAt: new Date()
    }
  })

  revalidatePath("/admin/desktop/announcements")
  return NextResponse.json(announcement)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await validateAdmin(["admin"])
  if (!admin.isValid) return admin.response

  const { id } = await params

  await prisma.announcements.delete({ where: { id } })

  revalidatePath("/admin/desktop/announcements")
  return NextResponse.json({ ok: true })
}
