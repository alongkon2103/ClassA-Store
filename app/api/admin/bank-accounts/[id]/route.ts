import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await req.json()

  const bank = await prisma.bank_accounts.update({
    where: { id },
    data: { ...body, updated_at: new Date() },
  })

  return NextResponse.json(bank)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  await prisma.bank_accounts.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}