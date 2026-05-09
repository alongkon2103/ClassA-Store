import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"

import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

type RouteContext = {
  params: Promise<{
    id: string
  }>
}

// ======================================================
// GET - ดึงค่าที่ user ตั้งไว้
// ======================================================
export async function GET(
  _req: Request,
  { params }: RouteContext
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    const { id } = await params

    const order = await prisma.orders.findUnique({
      where: { id },
      include: {
        user_function_gifts: true,
      },
    })

    if (!order || order.user_id !== session.user.id) {
      return NextResponse.json(
        { error: "Not found" },
        { status: 404 }
      )
    }

    const mapping: Record<string, number> = {}

    for (const row of order.user_function_gifts) {
      mapping[row.function_id] = row.gift_id
    }

    return NextResponse.json({ mapping })
  } catch (error) {
    console.error("GET settings error:", error)

    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    )
  }
}

// ======================================================
// POST - บันทึก mapping function -> gift
// ======================================================
export async function POST(
  req: Request,
  { params }: RouteContext
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    const { id } = await params

    const order = await prisma.orders.findUnique({
      where: { id },
    })

    if (
      !order ||
      order.user_id !== session.user.id ||
      order.status !== "paid"
    ) {
      return NextResponse.json(
        { error: "Not found" },
        { status: 404 }
      )
    }

    const body = await req.json()
    const mapping: Record<string, number> =
      body.mapping || {}

    // Upsert ทุก function
    await prisma.$transaction(
      Object.entries(mapping).map(
        ([functionId, giftId]) =>
          prisma.user_function_gifts.upsert({
            where: {
              user_id_order_id_function_id: {
                user_id: session.user.id,
                order_id: id,
                function_id: functionId,
              },
            },
            create: {
              user_id: session.user.id,
              order_id: id,
              function_id: functionId,
              gift_id: Number(giftId),
            },
            update: {
              gift_id: Number(giftId),
            },
          })
      )
    )

    // ลบรายการที่ user เอาออก
    await prisma.user_function_gifts.deleteMany({
      where: {
        user_id: session.user.id,
        order_id: id,
        function_id: {
          notIn: Object.keys(mapping),
        },
      },
    })

    return NextResponse.json({
      ok: true,
    })
  } catch (error) {
    console.error("POST settings error:", error)

    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    )
  }
}