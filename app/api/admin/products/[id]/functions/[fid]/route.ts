import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

export async function PATCH(
  req: Request,
  {
    params,
  }: {
    params: Promise<{ id: string; fid: string }>
  }
) {
  try {
    const session = await getServerSession(authOptions)

    if (session?.user?.role !== "admin") {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      )
    }

    const { id, fid } = await params
    const body = await req.json()
    const { name, label_th, label_en, default_gift_id } = body

    // ตรวจสอบว่า function นี้อยู่ใน product ที่ระบุจริง
    const existing = await prisma.product_functions.findFirst({
      where: {
        id: fid,
        product_id: id,
      },
    })

    if (!existing) {
      return NextResponse.json(
        {
          error: "Function not found",
          product_id: id,
          function_id: fid,
        },
        { status: 404 }
      )
    }

    const fn = await prisma.product_functions.update({
      where: {
        id: fid,
      },
      data: {
        ...(name !== undefined && { name }),
        label_th: label_th ?? null,
        label_en: label_en ?? null,
        default_gift_id: default_gift_id ?? null,
      },
    })

    return NextResponse.json(fn)
  } catch (error) {
    console.error("PATCH function error:", error)

    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  _req: Request,
  {
    params,
  }: {
    params: Promise<{ id: string; fid: string }>
  }
) {
  try {
    const session = await getServerSession(authOptions)

    if (session?.user?.role !== "admin") {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      )
    }

    const { id, fid } = await params

    const existing = await prisma.product_functions.findFirst({
      where: {
        id: fid,
        product_id: id,
      },
    })

    if (!existing) {
      return NextResponse.json(
        {
          error: "Function not found",
          product_id: id,
          function_id: fid,
        },
        { status: 404 }
      )
    }

    await prisma.product_functions.delete({
      where: {
        id: fid,
      },
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("DELETE function error:", error)

    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    )
  }
}