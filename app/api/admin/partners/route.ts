import { prisma } from "@/lib/prisma"
import { NextRequest, NextResponse } from "next/server"
import { validateAdmin } from "@/lib/adminAuth"

export async function GET() {
  const admin = await validateAdmin(["admin"])
  if (!admin.isValid) return admin.response

  try {
    const partners = await prisma.partners.findMany({
      orderBy: { created_at: "desc" },
    })
    return NextResponse.json(partners)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const admin = await validateAdmin(["admin"])
  if (!admin.isValid) return admin.response

  try {
    const body = await req.json()
    const { name, contact, bank_name, account_number } = body

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 })
    }

    const partner = await prisma.partners.create({
      data: {
        name,
        contact,
        bank_name,
        account_number,
      },
    })

    return NextResponse.json(partner)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
