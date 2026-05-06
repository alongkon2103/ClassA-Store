import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { bank_name, account_name, account_number, promptpay_no, qr_code_url, is_active } = body

  if (!bank_name || !account_name || !account_number) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
  }

  const bank = await prisma.bank_accounts.create({
    data: {
      bank_name, account_name, account_number,
      promptpay_no: promptpay_no || null,
      qr_code_url:  qr_code_url  || null,
      is_active:    is_active    ?? true,
    },
  })

  return NextResponse.json(bank, { status: 201 })
}