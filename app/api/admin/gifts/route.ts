// app/api/admin/gifts/route.ts

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { validateAdmin } from "@/lib/adminAuth"

export async function GET() {
  const admin = await validateAdmin()
  if (!admin.isValid) return admin.response

  try {
    const gifts = await prisma.gifts.findMany({
      orderBy: [
        { sort_order: "asc" },
        { id: "asc" },
      ],
    })

    return NextResponse.json(gifts)
  } catch (error) {
    console.error("GET gifts error:", error)
    return NextResponse.json(
      { error: "Failed to fetch gifts" },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  const admin = await validateAdmin()
  if (!admin.isValid) return admin.response

  try {
    const body = await req.json()

    const id = Number(body.id)
    const name = body.name?.trim()
    const diamonds = Number(body.diamonds)
    const image_url = body.image_url || null
    const trigger_type = body.trigger_type || "Gift"

    if (!id || !name || diamonds === undefined) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      )
    }

    // เช็ค id ซ้ำ
    const existing = await prisma.gifts.findUnique({
      where: { id },
    })

    if (existing) {
      return NextResponse.json(
        { error: "Gift ID already exists" },
        { status: 400 }
      )
    }

    const maxSort = await prisma.gifts.aggregate({
      _max: {
        sort_order: true,
      },
    })

    const gift = await prisma.gifts.create({
      data: {
        id,
        name,
        diamonds,
        image_url,
        trigger_type,
        sort_order: (maxSort._max.sort_order ?? 0) + 1,
      },
    })

    return NextResponse.json(gift)
  } catch (error) {
    console.error("POST gift error:", error)
    return NextResponse.json(
      { error: "Failed to create gift" },
      { status: 500 }
    )
  }
}