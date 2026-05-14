import { prisma } from "@/lib/prisma"
import { NextRequest, NextResponse } from "next/server"

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await req.json()
    const { name, contact, bank_name, account_number } = body

    const partner = await prisma.partners.update({
      where: { id },
      data: {
        name,
        contact,
        bank_name,
        account_number,
        updated_at: new Date(),
      },
    })

    return NextResponse.json(partner)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    await prisma.partners.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
