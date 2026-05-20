// app/api/admin/gifts/[id]/route.ts

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

type Params = {
  params: Promise<{
    id: string
  }>
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const giftId = Number(id)

    if (isNaN(giftId)) {
      return NextResponse.json(
        { error: "Invalid gift id" },
        { status: 400 }
      )
    }

    const body = await req.json()

    const data: any = {}

    if (body.name !== undefined) {
      data.name = body.name.trim()
    }

    if (body.diamonds !== undefined) {
      data.diamonds = Number(body.diamonds)
    }

    if (body.image_url !== undefined) {
      data.image_url = body.image_url || null
    }

    if (body.trigger_type !== undefined) {
      data.trigger_type = body.trigger_type || "Gift"
    }

    if (body.is_active !== undefined) {
      data.is_active = Boolean(body.is_active)
    }

    if (body.sort_order !== undefined) {
      data.sort_order = Number(body.sort_order)
    }

    // ไม่ให้แก้ id
    delete data.id

    const updated = await prisma.gifts.update({
      where: { id: giftId },
      data,
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error("PATCH gift error:", error)
    return NextResponse.json(
      { error: "Failed to update gift" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: Params
) {
  try {
    const { id } = await params
    const giftId = Number(id)

    if (isNaN(giftId)) {
      return NextResponse.json(
        { error: "Invalid gift id" },
        { status: 400 }
      )
    }

    // ลบ user_function_gifts ที่อ้างถึง gift นี้ก่อน
    await prisma.user_function_gifts.deleteMany({
      where: {
        gift_id: giftId,
      },
    })

    // ลบ gift
    await prisma.gifts.delete({
      where: {
        id: giftId,
      },
    })

    return NextResponse.json({
      success: true,
    })
  } catch (error) {
    console.error("DELETE gift error:", error)
    return NextResponse.json(
      { error: "Failed to delete gift" },
      { status: 500 }
    )
  }
}