import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { validateAdmin } from "@/lib/adminAuth"

export async function GET() {
  const admin = await validateAdmin(["admin"])
  if (!admin.isValid) return admin.response

  const announcements = await prisma.announcements.findMany({
    orderBy: { createdAt: "desc" },
    include: { users: { select: { username: true } } }
  })

  return NextResponse.json(announcements)
}

export async function POST(req: NextRequest) {
  const admin = await validateAdmin(["admin"])

  if (!admin.isValid || !admin.session) {
    return admin.response
  }

  const body = await req.json()

  const announcement = await prisma.announcements.create({
    data: {
      title: body.title,
      content: body.content,
      imageUrl: body.imageUrl,
      isActive: body.isActive ?? true,
      createdById: admin.session.user.id,
      updatedAt: new Date(),
    },
  })

  revalidatePath("/admin/desktop/announcements")
  return NextResponse.json(announcement)
}